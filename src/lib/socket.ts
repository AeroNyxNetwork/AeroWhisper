import { EventEmitter } from 'events';
import { MessageType } from '../types/chat';
import { encryptPacket, decryptPacket } from '../utils/crypto';

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
        // Determine server URL - in production, this would be configurable
        const serverUrl = `wss://aeronyx-server.example.com/chat/${chatId}`;
        
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
  private handleServerMessage(data: any) {
    try {
      // Parse JSON data
      const message = typeof data === 'string' ? JSON.parse(data) : data;
      
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
    } catch (error) {
      console.error('Error handling server message:', error);
    }
  }
  
  // Handle challenge message
  private async handleChallenge(message: any) {
    // In a real implementation, we would sign the challenge with the private key
    // This is a simplified version
    
    try {
      // Convert challenge data to Uint8Array
      const challengeData = new Uint8Array(message.data);
      
      // Get keypair from localStorage
      const storedKeypair = localStorage.getItem('aero-keypair');
      if (!storedKeypair) {
        throw new Error('No keypair found');
      }
      
      const keypair = JSON.parse(storedKeypair);
      
      // Sign challenge - this would use nacl.sign.detached in real implementation
      const signatureBuffer = new Uint8Array(64); // Dummy signature
      const signature = Buffer.from(signatureBuffer).toString('base64');
      
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
  private handleIpAssign(message: any) {
    try {
      // In real implementation, we would decrypt session key
      // For now, use a dummy key
      this.sessionKey = new Uint8Array(32);
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
  private handleDataPacket(message: any) {
    try {
      if (!this.sessionKey) return;
      
      // Decrypt the message
      // In real implementation, we would use decryptPacket
      
      // For now, assume it's a JSON-encoded message
      const decryptedMessage = {
        type: 'message',
        content: 'Decrypted message content',
        senderId: 'sender-id',
        senderName: 'Sender Name',
        timestamp: new Date().toISOString(),
      };
      
      // Emit appropriate event based on message type
      if (decryptedMessage.type === 'message') {
        this.emit('message', {
          id: `msg-${Date.now()}`,
          content: decryptedMessage.content,
          senderId: decryptedMessage.senderId,
          senderName: decryptedMessage.senderName,
          timestamp: decryptedMessage.timestamp,
          isEncrypted: true,
          status: 'received',
        });
      } else if (decryptedMessage.type === 'participants') {
        this.emit('participants', decryptedMessage.participants);
      } else if (decryptedMessage.type === 'chatInfo') {
        this.emit('chatInfo', decryptedMessage.chatInfo);
      } else if (decryptedMessage.type === 'webrtc-signal') {
        this.emit('webrtcSignal', decryptedMessage);
      }
      
      // Forward raw data for WebRTC signaling
      this.emit('data', message);
    } catch (error) {
      console.error('Error handling data packet:', error);
    }
  }
  
  // Handle ping message
  private handlePing(message: any) {
    try {
      // Send pong response
      if (this.socket) {
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
  private handleError(message: any) {
    console.error('Server error:', message.message);
    this.emit('error', new Error(message.message));
  }
  
  // Handle disconnect message
  private handleDisconnect(message: any) {
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
      // In real implementation, we would encrypt the message
      // For now, create a data packet with dummy encryption
      
      const dataPacket = {
        type: 'Data',
        encrypted: [], // Would contain encrypted data
        nonce: [], // Would contain nonce
        counter: this.messageCounter++,
        padding: null,
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
      // In real implementation, we would encrypt the data
      // For now, create a data packet with dummy encryption
      
      const dataPacket = {
        type: 'Data',
        encrypted: [], // Would contain encrypted data
        nonce: [], // Would contain nonce
        counter: this.messageCounter++,
        padding: null,
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
      this.send({ type: 'request-chat-info' });
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
      this.send({ type: 'request-participants' });
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
        this.send({ type: 'delete-chat' });
        resolve();
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
}
