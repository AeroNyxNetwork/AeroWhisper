import { EventEmitter } from 'events';
import { MessageType } from '../types/chat';
import { encryptPacket, decryptPacket, signChallenge } from '../utils/crypto';

export class AeroNyxSocket extends EventEmitter {
  private socket: WebSocket | null = null;
  private sessionKey: Uint8Array | null = null;
  private publicKey: string | null = null;
  private chatId: string | null = null;
  private isConnected: boolean = false;
  private messageCounter: number = 0;
  private connecting: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private serverUrl: string = process.env.NEXT_PUBLIC_AERONYX_SERVER_URL || 'wss://aeronyx-server.example.com';
  
  constructor() {
    super();
  }
  
  // Connect to AeroNyx server
  async connect(chatId: string, publicKey: string): Promise<void> {
    if (this.socket && this.isConnected) {
      return;
    }
    
    this.chatId = chatId;
    this.publicKey = publicKey;
    this.connecting = true;
    
    return new Promise((resolve, reject) => {
      try {
        // Use environment variable for server URL if available
        const serverUrl = `${this.serverUrl}/chat/${chatId}`;
        
        // For development/testing purposes, we can simulate the connection
        if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_MOCK_SERVER === 'true') {
          // Simulate connection with mock data
          this.simulateConnection();
          resolve();
          return;
        }
        
        this.socket = new WebSocket(serverUrl);
        
        this.socket.onopen = () => {
          this.sendAuthMessage();
          this.reconnectAttempts = 0;
        };
        
        this.socket.onmessage = (event) => {
          this.handleServerMessage(event.data);
        };
        
        this.socket.onclose = () => {
          this.isConnected = false;
          this.emit('connectionStatus', 'disconnected');
          
          if (this.connecting) {
            reject(new Error('Connection closed during handshake'));
            this.connecting = false;
          }
          
          // Attempt to reconnect
          this.scheduleReconnect();
        };
        
        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          
          if (this.connecting) {
            reject(error);
            this.connecting = false;
          }
          
          this.emit('error', error);
        };
      } catch (error) {
        this.connecting = false;
        reject(error);
      }
    });
  }
  
  // Send authentication message to the server
  private sendAuthMessage() {
    if (!this.socket || !this.publicKey) return;
    
    const authMessage = {
      type: 'Auth',
      public_key: this.publicKey,
      version: '1.0.0',
      features: ['chacha20poly1305', 'webrtc'],
      nonce: Date.now().toString(),
    };
    
    this.socket.send(JSON.stringify(authMessage));
  }
  
  // Handle messages from the server
  private handleServerMessage(data: string | ArrayBuffer | Blob) {
    try {
      // Parse JSON data
      let message: any;
      if (typeof data === 'string') {
        message = JSON.parse(data);
      } else if (data instanceof Blob) {
        // Handle Blob data (for binary WebSocket messages)
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const parsedMessage = JSON.parse(result);
          this.processMessage(parsedMessage);
        };
        reader.readAsText(data);
        return;
      } else {
        // Handle ArrayBuffer
        const decoder = new TextDecoder();
        message = JSON.parse(decoder.decode(data));
      }
      
      this.processMessage(message);
    } catch (error) {
      console.error('Error handling server message:', error);
    }
  }
  
  // Process parsed message
  private processMessage(message: any) {
    switch (message.type) {
      case 'Challenge':
        this.handleChallenge(message);
        break;
      
      case 'IpAssign':
        this.handleIpAssign(message);
        break;
      
      case 'Data':
        this.handleDataPacket(message);
        break;
      
      case 'Ping':
        this.handlePing(message);
        break;
      
      case 'Error':
        this.handleError(message);
        break;
      
      case 'Disconnect':
        this.handleDisconnect(message);
        break;
        
      default:
        console.warn('Unknown message type:', message.type);
    }
  }
  
  // Handle challenge message
  private async handleChallenge(message: { id: string, data: number[] | string }) {
    try {
      // Convert challenge data to Uint8Array
      let challengeData: Uint8Array;
      if (Array.isArray(message.data)) {
        challengeData = new Uint8Array(message.data);
      } else if (typeof message.data === 'string') {
        // Assuming base64 or base58 encoded string
        try {
          // Try to parse as base58
          const bs58 = await import('bs58');
          challengeData = bs58.decode(message.data);
        } catch {
          // Fallback to base64
          const buffer = Buffer.from(message.data, 'base64');
          challengeData = new Uint8Array(buffer);
        }
      } else {
        throw new Error('Invalid challenge data format');
      }
      
      // Get keypair from localStorage
      const storedKeypair = localStorage.getItem('aero-keypair');
      if (!storedKeypair) {
        throw new Error('No keypair found');
      }
      
      const keypair = JSON.parse(storedKeypair);
      const secretKey = await import('bs58').then(bs58 => bs58.decode(keypair.secretKey));
      
      // Sign challenge with real signature
      const signature = await signChallenge(challengeData, secretKey);
      
      // Send challenge response
      const response = {
        type: 'ChallengeResponse',
        signature,
        public_key: this.publicKey,
        challenge_id: message.id,
      };
      
      if (this.socket) {
        this.socket.send(JSON.stringify(response));
      }
    } catch (error) {
      console.error('Error handling challenge:', error);
      this.emit('error', error);
    }
  }
  
  // Handle IP assignment message
  private handleIpAssign(message: { ip_address: string, session_id: string, session_key?: string, key_nonce?: string }) {
    try {
      // In a real implementation, we would decrypt the session key
      // For now, generate a random session key for testing
      if (message.session_key) {
        // TODO: Implement proper session key decryption using shared secret
        // this.sessionKey = decryptSessionKey(message.session_key, message.key_nonce, sharedSecret);
      } else {
        // For testing, generate a random key
        const nacl = require('tweetnacl');
        this.sessionKey = new Uint8Array(nacl.secretbox.keyLength);
        window.crypto.getRandomValues(this.sessionKey);
      }
      
      this.isConnected = true;
      this.connecting = false;
      
      this.emit('connectionStatus', 'connected');
      
      // Start ping interval to keep connection alive
      this.startPingInterval();
      
      // Notify successful connection
      this.emit('connected', {
        ip: message.ip_address,
        sessionId: message.session_id,
      });
    } catch (error) {
      console.error('Error handling IP assignment:', error);
      this.emit('error', error);
    }
  }
  
  // Handle data packet
  private handleDataPacket(message: { encrypted: string, nonce: string, counter: number }) {
    try {
      if (!this.sessionKey) return;
      
      // Decrypt the message using our session key
      try {
        const decryptedData = decryptPacket(message.encrypted, message.nonce, this.sessionKey);
        
        // Emit appropriate event based on message type
        if (decryptedData.type === 'message') {
          this.emit('message', {
            id: decryptedData.id || `msg-${Date.now()}`,
            content: decryptedData.content,
            senderId: decryptedData.senderId,
            senderName: decryptedData.senderName,
            timestamp: decryptedData.timestamp || new Date().toISOString(),
            isEncrypted: true,
            status: 'received',
          });
        } else if (decryptedData.type === 'participants') {
          this.emit('participants', decryptedData.participants);
        } else if (decryptedData.type === 'chatInfo') {
          this.emit('chatInfo', decryptedData.chatInfo);
        } else if (decryptedData.type === 'webrtc-signal') {
          this.emit('webrtcSignal', decryptedData);
        }
      } catch (error) {
        console.error('Failed to decrypt data packet:', error);
        
        // For development/testing, still emit some data even if decryption fails
        if (process.env.NODE_ENV === 'development') {
          this.simulateDataReceived(message);
        }
      }
      
      // Forward raw data for WebRTC signaling
      this.emit('data', message);
    } catch (error) {
      console.error('Error handling data packet:', error);
    }
  }
  
  // Handle ping message
  private handlePing(message: { timestamp: number, sequence: number }) {
    try {
      // Send pong response
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const pong = {
          type: 'Pong',
          echo_timestamp: message.timestamp,
          server_timestamp: Date.now(),
          sequence: message.sequence,
        };
        
        this.socket.send(JSON.stringify(pong));
      }
    } catch (error) {
      console.error('Error handling ping:', error);
    }
  }
  
  // Handle error message
  private handleError(message: { message: string, code?: number }) {
    console.error('Server error:', message.message);
    this.emit('error', new Error(message.message));
  }
  
  // Handle disconnect message
  private handleDisconnect(message: { reason: number, message: string }) {
    this.isConnected = false;
    this.emit('disconnected', message.reason, message.message);
    this.stopPingInterval();
    
    if (this.socket) {
      this.socket.close();
    }
  }
  
  // Start ping interval to keep connection alive
  private startPingInterval() {
    this.stopPingInterval();
    
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 30000); // Send ping every 30 seconds
  }
  
  // Stop ping interval
  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  // Send ping to keep connection alive
  private sendPing() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    
    const ping = {
      type: 'Ping',
      timestamp: Date.now(),
      sequence: this.messageCounter++,
    };
    
    this.socket.send(JSON.stringify(ping));
  }
  
  // Schedule reconnection attempt
  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts));
    
    this.reconnectTimeout = setTimeout(() => {
      if (this.chatId && this.publicKey) {
        this.reconnectAttempts++;
        this.connect(this.chatId, this.publicKey).catch(console.error);
      }
    }, delay);
  }
  
  // Send a message to the chat
  async sendMessage(message: MessageType): Promise<boolean> {
    if (!this.socket || !this.isConnected || !this.sessionKey) {
      return false;
    }
    
    try {
      // Create the message data object
      const messageData = {
        type: 'message',
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        senderName: message.senderName,
        timestamp: message.timestamp,
      };
      
      // Encrypt the message data with our session key
      const { encrypted, nonce } = encryptPacket(messageData, this.sessionKey);
      
      // Create data packet with encrypted content
      const dataPacket = {
        type: 'Data',
        encrypted,
        nonce,
        counter: this.messageCounter++,
        padding: null, // Optional padding for length concealment
      };
      
      this.socket.send(JSON.stringify(dataPacket));
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }
  
  // Send arbitrary data
  send(data: any): boolean {
    if (!this.socket || !this.isConnected || !this.sessionKey) {
      return false;
    }
    
    try {
      // Encrypt the data with our session key
      const { encrypted, nonce } = encryptPacket(data, this.sessionKey);
      
      // Create data packet with encrypted content
      const dataPacket = {
        type: 'Data',
        encrypted,
        nonce,
        counter: this.messageCounter++,
        padding: null, // Optional padding for length concealment
      };
      
      this.socket.send(JSON.stringify(dataPacket));
      return true;
    } catch (error) {
      console.error('Error sending data:', error);
      return false;
    }
  }
  
  // Request chat information
  async requestChatInfo(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('Not connected'));
        return;
      }
      
      // Set up one-time listener for chatInfo
      const listener = (chatInfo: any) => {
        resolve();
        this.off('chatInfo', listener);
      };
      
      this.once('chatInfo', listener);
      
      // Set timeout for the request
      const timeout = setTimeout(() => {
        this.off('chatInfo', listener);
        reject(new Error('Request timed out'));
      }, 5000);
      
      // Send request
      const success = this.send({ type: 'request-chat-info' });
      
      if (!success) {
        clearTimeout(timeout);
        this.off('chatInfo', listener);
        reject(new Error('Failed to send request'));
      }
    });
  }
  
  // Request participants list
  async requestParticipants(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('Not connected'));
        return;
      }
      
      // Set up one-time listener for participants
      const listener = (participants: any) => {
        resolve();
        this.off('participants', listener);
      };
      
      this.once('participants', listener);
      
      // Set timeout for the request
      const timeout = setTimeout(() => {
        this.off('participants', listener);
        reject(new Error('Request timed out'));
      }, 5000);
      
      // Send request
      const success = this.send({ type: 'request-participants' });
      
      if (!success) {
        clearTimeout(timeout);
        this.off('participants', listener);
        reject(new Error('Failed to send request'));
      }
    });
  }
  
  // Leave the chat
  async leaveChat(): Promise<void> {
    if (!this.socket || !this.isConnected) {
      return;
    }
    
    const leaveMessage = {
      type: 'Disconnect',
      reason: 0, // User initiated
      message: 'User left the chat',
    };
    
    this.socket.send(JSON.stringify(leaveMessage));
    this.disconnect();
  }
  
  // Delete the chat (if creator)
  async deleteChat(): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error('Not connected');
    }
    
    return new Promise((resolve, reject) => {
      try {
        const success = this.send({ type: 'delete-chat' });
        if (success) {
          resolve();
        } else {
          reject(new Error('Failed to send delete request'));
        }
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Disconnect from the server
  disconnect() {
    this.isConnected = false;
    this.stopPingInterval();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.emit('connectionStatus', 'disconnected');
  }
  
  // Check if connected
  isActive(): boolean {
    return this.isConnected && !!this.socket;
  }
  
  // For development and testing: simulate connection (mock server)
  private simulateConnection() {
    // Mock successful connection
    setTimeout(() => {
      this.isConnected = true;
      this.connecting = false;
      this.sessionKey = new Uint8Array(32);
      window.crypto.getRandomValues(this.sessionKey);
      
      this.emit('connectionStatus', 'connected');
      this.emit('connected', {
        ip: '127.0.0.1',
        sessionId: `mock-session-${Date.now()}`
      });
      
      // Simulate receiving chat info
      setTimeout(() => {
        this.emit('chatInfo', {
          id: this.chatId,
          name: 'Mock Chat Room',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          isEphemeral: true,
          useP2P: true,
          createdBy: 'mock-creator-id'
        });
      }, 200);
      
      // Simulate receiving participants list
      setTimeout(() => {
        this.emit('participants', [
          {
            id: this.publicKey,
            publicKey: this.publicKey,
            displayName: 'You',
            isActive: true,
            lastSeen: new Date()
          },
          {
            id: 'mock-user-1',
            publicKey: 'mock-public-key-1',
            displayName: 'Mock User 1',
            isActive: true,
            lastSeen: new Date()
          }
        ]);
      }, 400);
      
      // Start ping interval (just for simulation)
      this.startPingInterval();
    }, 500);
  }
  
  // For development and testing: simulate receiving data
  private simulateDataReceived(message: any) {
    // Mock message based on counter for variety
    const mockContent = `This is a simulated message #${message.counter || 0}`;
    const mockSenderId = message.counter % 2 === 0 ? 'mock-user-1' : this.publicKey || 'unknown';
    const mockSenderName = mockSenderId === this.publicKey ? 'You' : 'Mock User 1';
    
    this.emit('message', {
      id: `mock-msg-${Date.now()}`,
      content: mockContent,
      senderId: mockSenderId,
      senderName: mockSenderName,
      timestamp: new Date().toISOString(),
      isEncrypted: true,
      status: 'received',
    });
  }
}
