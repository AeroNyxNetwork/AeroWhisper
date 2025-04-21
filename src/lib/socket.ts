import { EventEmitter } from 'events';
import { MessageType } from '../types/chat';
import { encryptPacket, decryptPacket, signChallenge } from '../utils/crypto';

interface ReconnectionConfig {
  initialDelay: number;
  maxDelay: number;
  maxAttempts: number;
  jitter: boolean;
}

/**
 * AeroNyx Socket - Manages WebSocket connections with error handling,
 * reconnection logic, and secure messaging
 */
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
  private sessionId: string | null = null;
  private serverUrl: string = process.env.NEXT_PUBLIC_AERONYX_SERVER_URL || 'wss://aeronyx-server.example.com';
  private connectionListeners: Set<() => void> = new Set();
  private pendingMessages: Array<{type: string, data: any}> = [];
  
  // Reconnection configuration with exponential backoff
  private reconnectionConfig: ReconnectionConfig = {
    initialDelay: 1000, // Start with 1 second delay
    maxDelay: 30000,    // Max delay of 30 seconds
    maxAttempts: 10,    // Max 10 reconnection attempts
    jitter: true        // Add randomness to prevent thundering herd
  };
  
  constructor(config?: Partial<ReconnectionConfig>) {
    super();
    
    // Override default reconnection config if provided
    if (config) {
      this.reconnectionConfig = {
        ...this.reconnectionConfig,
        ...config
      };
    }
    
    // Set max listeners to avoid memory leaks
    this.setMaxListeners(20);
  }
  
  /**
   * Connect to AeroNyx server with retry logic and connection timeout
   * @param chatId Chat room ID
   * @param publicKey User's public key
   */
  async connect(chatId: string, publicKey: string): Promise<void> {
    if (this.socket && this.isConnected) {
      return;
    }
    
    this.chatId = chatId;
    this.publicKey = publicKey;
    this.connecting = true;
    
    // Reset reconnection attempts when manually connecting
    this.reconnectAttempts = 0;
    
    return new Promise((resolve, reject) => {
      try {
        // Use environment variable for server URL if available
        const serverUrl = `${this.serverUrl}/chat/${chatId}`;
        
        console.log(`Connecting to WebSocket server at: ${serverUrl}`);
        this.emit('connectionStatus', 'connecting');
        
        this.socket = new WebSocket(serverUrl);
        
        // Add timeout for connection attempt
        const connectionTimeout = setTimeout(() => {
          if (this.connecting) {
            const timeoutError = new Error('WebSocket connection timed out');
            console.error('Connection timeout:', timeoutError);
            this.emit('error', {
              type: 'connection',
              message: 'Connection to secure chat server timed out. This might be due to network issues or server unavailability.',
              code: 'TIMEOUT',
              retry: true
            });
            
            if (this.socket) {
              this.socket.close();
              this.socket = null;
            }
            
            this.connecting = false;
            reject(timeoutError);
            
            // Auto-retry on timeout if not max attempts
            if (this.reconnectAttempts < this.reconnectionConfig.maxAttempts) {
              this.scheduleReconnect();
            }
          }
        }, 10000); // 10 second timeout
        
        this.socket.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('WebSocket connection established');
          this.sendAuthMessage();
          this.reconnectAttempts = 0;
        };
        
        this.socket.onmessage = (event) => {
          clearTimeout(connectionTimeout);
          this.handleServerMessage(event.data);
        };
        
        this.socket.onclose = (event) => {
          clearTimeout(connectionTimeout);
          this.isConnected = false;
          this.emit('connectionStatus', 'disconnected');
          
          console.log(`WebSocket connection closed: ${event.code} - ${event.reason}`);
          
          // Check for common certificate and security error codes
          if (event.code === 1006 || event.code === 1015) {
            const errorMsg = 'Connection closed due to security issues. This might be related to a certificate problem.';
            console.error(errorMsg);
            
            this.emit('error', {
              type: 'security',
              message: errorMsg,
              code: `WS_CLOSED_${event.code}`,
              details: `You might need to visit ${this.serverUrl.replace('wss://', 'https://')} directly in your browser and accept the certificate.`,
              retry: false
            });
          }
          
          if (this.connecting) {
            const closeError = new Error(`Connection closed during handshake: ${event.code} - ${event.reason}`);
            reject(closeError);
            this.connecting = false;
          }
          
          // Attempt to reconnect automatically for common error codes
          const reconnectCodes = [1000, 1001, 1006, 1012, 1013];
          if (reconnectCodes.includes(event.code) && 
              this.reconnectAttempts < this.reconnectionConfig.maxAttempts) {
            this.scheduleReconnect();
          }
        };
        
        this.socket.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error('WebSocket error:', error);
          
          const errorDetails = {
            type: 'connection',
            message: 'Failed to establish a secure connection to the chat server.',
            code: 'WS_ERROR',
            details: 'This might be due to network issues, server unavailability, or certificate problems.',
            retry: true,
            originalError: error
          };
          
          this.emit('error', errorDetails);
          
          if (this.connecting) {
            reject(new Error('WebSocket connection error'));
            this.connecting = false;
          }
        };
      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        this.connecting = false;
        
        this.emit('error', {
          type: 'connection',
          message: 'Failed to initiate connection to the secure chat server.',
          code: 'INIT_ERROR',
          details: error instanceof Error ? error.message : 'Unknown error',
          retry: true
        });
        
        reject(error);
        
        // Attempt to reconnect if initialization fails
        if (this.reconnectAttempts < this.reconnectionConfig.maxAttempts) {
          this.scheduleReconnect();
        }
      }
    });
  }
  
  /**
   * Send authentication message to the server
   */
  private sendAuthMessage() {
    if (!this.socket || !this.publicKey) return;
    
    const authMessage = {
      type: 'Auth',
      public_key: this.publicKey,
      version: '1.0.0',
      features: ['chacha20poly1305', 'webrtc'],
      nonce: Date.now().toString(),
    };
    
    try {
      this.socket.send(JSON.stringify(authMessage));
    } catch (error) {
      console.error('Error sending auth message:', error);
      this.emit('error', {
        type: 'auth',
        message: 'Failed to send authentication message',
        code: 'AUTH_ERROR',
        retry: true
      });
    }
  }
  
  /**
   * Handle messages from the server
   */
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
          try {
            const parsedMessage = JSON.parse(result);
            this.processMessage(parsedMessage);
          } catch (error) {
            console.error('Error parsing Blob message:', error);
          }
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
      this.emit('error', {
        type: 'message',
        message: 'Failed to parse server message',
        code: 'PARSE_ERROR',
        retry: false
      });
    }
  }
  
  /**
   * Process parsed message
   */
  private processMessage(message: any) {
    if (!message || !message.type) {
      console.warn('Received message with no type', message);
      return;
    }
    
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
  
  /**
   * Handle authentication challenge
   */
  private async handleChallenge(message: { id: string, data: number[] | string }) {
    try {
      // Convert challenge data to Uint8Array
      let challengeData: Uint8Array;
      if (Array.isArray(message.data)) {
        challengeData = new Uint8Array(message.data);
      } else if (typeof message.data === 'string') {
        // Try to parse as base58 or base64
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
        throw new Error('No keypair found for authentication');
      }
      
      const keypair = JSON.parse(storedKeypair);
      const secretKey = await import('bs58').then(bs58 => bs58.decode(keypair.secretKey));
      
      // Sign challenge with proper signature
      const signature = await signChallenge(challengeData, secretKey);
      
      // Send challenge response
      const response = {
        type: 'ChallengeResponse',
        signature,
        public_key: this.publicKey,
        challenge_id: message.id,
      };
      
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(response));
      } else {
        console.error('Socket not open when trying to send challenge response');
        throw new Error('Socket connection not available');
      }
    } catch (error) {
      console.error('Error handling challenge:', error);
      this.emit('error', {
        type: 'auth',
        message: 'Failed to authenticate with server',
        code: 'AUTH_CHALLENGE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
        retry: true
      });
      
      // Attempt reconnection
      this.scheduleReconnect();
    }
  }
  
  /**
   * Handle IP assignment message after successful authentication
   */
  private handleIpAssign(message: { ip_address: string, session_id: string, session_key?: string, key_nonce?: string }) {
    try {
      // Store the session ID
      this.sessionId = message.session_id;
      
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
      
      // Send any messages that were queued while disconnected
      this.processPendingMessages();
      
      // Notify all waiting connection listeners
      this.connectionListeners.forEach(listener => listener());
      this.connectionListeners.clear();
    } catch (error) {
      console.error('Error handling IP assignment:', error);
      this.emit('error', {
        type: 'connection',
        message: 'Failed to complete connection setup',
        code: 'IP_ASSIGN_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
        retry: true
      });
      
      this.scheduleReconnect();
    }
  }
  
  /**
   * Handle encrypted data packet
   */
  private handleDataPacket(message: { encrypted: string, nonce: string, counter: number }) {
    try {
      if (!this.sessionKey) {
        throw new Error('No session key available to decrypt message');
      }
      
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
      } catch (decryptError) {
        console.error('Failed to decrypt data packet:', decryptError);
        
        // For development/testing, still emit some data even if decryption fails
        if (process.env.NODE_ENV === 'development') {
          this.simulateDataReceived(message);
        } else {
          throw decryptError;
        }
      }
      
      // Forward raw data for WebRTC signaling
      this.emit('data', message);
    } catch (error) {
      console.error('Error handling data packet:', error);
      this.emit('error', {
        type: 'data',
        message: 'Failed to process data packet',
        code: 'DATA_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
        retry: false
      });
    }
  }
  
  /**
   * Handle server ping message
   */
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
  
  /**
   * Handle error message from server
   */
  private handleError(message: { message: string, code?: number }) {
    console.error('Server error:', message.message, message.code);
    this.emit('error', {
      type: 'server',
      message: message.message,
      code: message.code ? `SERVER_${message.code}` : 'SERVER_ERROR',
      retry: message.code ? message.code < 5000 : true // Retry for non-fatal errors
    });
    
    // For certain error codes, we might want to reconnect
    if (message.code && [1001, 1002, 1003].includes(message.code)) {
      this.scheduleReconnect();
    }
  }
  
  /**
   * Handle disconnect message from server
   */
  private handleDisconnect(message: { reason: number, message: string }) {
    this.isConnected = false;
    this.emit('disconnected', message.reason, message.message);
    this.stopPingInterval();
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    // If reason is non-fatal, attempt to reconnect
    if (message.reason < 4000) { // Non-fatal error codes
      this.scheduleReconnect();
    }
  }
  
  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval() {
    this.stopPingInterval();
    
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 30000); // Send ping every 30 seconds
  }
  
  /**
   * Stop ping interval
   */
  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  /**
   * Send ping to keep connection alive
   */
  private sendPing() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    
    try {
      const ping = {
        type: 'Ping',
        timestamp: Date.now(),
        sequence: this.messageCounter++,
      };
      
      this.socket.send(JSON.stringify(ping));
    } catch (error) {
      console.error('Error sending ping:', error);
      // If we can't send a ping, the connection might be dead
      this.checkConnectionHealth();
    }
  }
  
  /**
   * Check if the connection is healthy
   */
  private checkConnectionHealth() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      // Connection appears fine
      return;
    }
    
    // Connection unhealthy, attempt to reconnect
    this.isConnected = false;
    this.emit('connectionStatus', 'disconnected');
    
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {
        // Ignore errors when closing an already broken socket
      }
      this.socket = null;
    }
    
    this.scheduleReconnect();
  }
  
  /**
   * Schedule reconnection attempt with exponential backoff
   */
  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    // Don't reconnect if we've reached max attempts
    if (this.reconnectAttempts >= this.reconnectionConfig.maxAttempts) {
      console.log(`Max reconnection attempts (${this.reconnectionConfig.maxAttempts}) reached`);
      this.emit('error', {
        type: 'connection',
        message: `Failed to reconnect after ${this.reconnectionConfig.maxAttempts} attempts`,
        code: 'MAX_RECONNECT',
        retry: false
      });
      return;
    }
    
    // Calculate backoff delay with exponential increase
    const baseDelay = Math.min(
      this.reconnectionConfig.maxDelay,
      this.reconnectionConfig.initialDelay * Math.pow(2, this.reconnectAttempts)
    );
    
    // Add jitter to prevent thundering herd
    const jitter = this.reconnectionConfig.jitter ? 
      (Math.random() * 0.3 + 0.85) : // 0.85-1.15 randomization factor
      1;
    
    const delay = Math.floor(baseDelay * jitter);
    
    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
    
    this.emit('reconnecting', {
      attempt: this.reconnectAttempts + 1,
      maxAttempts: this.reconnectionConfig.maxAttempts,
      delay
    });
    
    this.reconnectTimeout = setTimeout(() => {
      if (this.chatId && this.publicKey) {
        this.reconnectAttempts++;
        this.connect(this.chatId, this.publicKey).catch(error => {
          console.error('Reconnection attempt failed:', error);
        });
      }
    }, delay);
  }
  
  /**
   * Send a message to the chat
   * @returns Promise that resolves when the message is sent (or queued if offline)
   */
  async sendMessage(message: MessageType): Promise<boolean> {
    // If not connected, queue message and return false
    if (!this.socket || !this.isConnected || !this.sessionKey) {
      this.queueMessage('message', message);
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
      
      // Queue message for retry
      this.queueMessage('message', message);
      
      this.emit('error', {
        type: 'message',
        message: 'Failed to send message',
        code: 'SEND_ERROR',
        retry: true,
        originalError: error
      });
      
      return false;
    }
  }
  
  /**
   * Queue a message to be sent when connection is restored
   */
  private queueMessage(type: string, data: any) {
    this.pendingMessages.push({ type, data });
    
    // Limit queue size to prevent memory issues
    if (this.pendingMessages.length > 100) {
      this.pendingMessages.shift(); // Remove oldest message
    }
    
    console.log(`Message queued. Total pending messages: ${this.pendingMessages.length}`);
  }
  
  /**
   * Process any pending messages
   */
  private processPendingMessages() {
    if (this.pendingMessages.length === 0) return;
    
    console.log(`Processing ${this.pendingMessages.length} pending messages`);
    
    // Create a copy and clear the queue to prevent requeuing the same messages
    const messagesToSend = [...this.pendingMessages];
    this.pendingMessages = [];
    
    // Send each message
    messagesToSend.forEach(async ({ type, data }) => {
      try {
        if (type === 'message') {
          await this.sendMessage(data);
        } else if (type === 'data') {
          await this.send(data);
        }
      } catch (error) {
        console.error('Error sending queued message:', error);
      }
    });
  }
  
  /**
   * Send arbitrary data
   * @returns Promise that resolves when the data is sent
   */
  async send(data: any): Promise<boolean> {
    if (!this.socket || !this.isConnected || !this.sessionKey) {
      this.queueMessage('data', data);
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
      
      this.queueMessage('data', data);
      
      this.emit('error', {
        type: 'data',
        message: 'Failed to send data',
        code: 'SEND_DATA_ERROR',
        retry: true,
        originalError: error
      });
      
      return false;
    }
  }
  
  /**
   * Wait for connection to be established
   * @param timeoutMs Timeout in milliseconds (default 10000 - 10 seconds)
   * @returns Promise that resolves when connected or rejects on timeout
   */
  waitForConnection(timeoutMs: number = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      // If already connected, resolve immediately
      if (this.isConnected) {
        resolve();
        return;
      }
      
      // Add listener for connection
      const connectionListener = () => {
        resolve();
      };
      
      this.connectionListeners.add(connectionListener);
      
      // Add timeout
      const timeout = setTimeout(() => {
        this.connectionListeners.delete(connectionListener);
        reject(new Error('Timed out waiting for connection'));
      }, timeoutMs);
      
      // Also listen for the 'connected' event directly
      const connectedHandler = () => {
        clearTimeout(timeout);
        this.connectionListeners.delete(connectionListener);
        this.off('connected', connectedHandler);
        resolve();
      };
      
      this.once('connected', connectedHandler);
    });
  }
  
  /**
   * Request chat information
   */
  async requestChatInfo(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!this.isConnected) {
        try {
          await this.waitForConnection();
        } catch (error) {
          reject(new Error('Not connected when requesting chat info'));
          return;
        }
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
      const success = await this.send({ type: 'request-chat-info' });
      
      if (!success) {
        clearTimeout(timeout);
        this.off('chatInfo', listener);
        reject(new Error('Failed to send request'));
      }
    });
  }
  
  /**
   * Request participants list
   */
  async requestParticipants(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!this.isConnected) {
        try {
          await this.waitForConnection();
        } catch (error) {
          reject(new Error('Not connected when requesting participants'));
          return;
        }
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
      const success = await this.send({ type: 'request-participants' });
      
      if (!success) {
        clearTimeout(timeout);
        this.off('participants', listener);
        reject(new Error('Failed to send request'));
      }
    });
  }
  
  /**
   * Leave the chat gracefully
   */
  async leaveChat(): Promise<void> {
    if (!this.socket || !this.isConnected) {
      return;
    }
    
    try {
      const leaveMessage = {
        type: 'Disconnect',
        reason: 0, // User initiated
        message: 'User left the chat',
      };
      
      // Send disconnect message if socket is open
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(leaveMessage));
      }
    } catch (error) {
      console.error('Error sending leave message:', error);
    } finally {
      // Always clean up resources
      this.disconnect();
    }
  }
  
  /**
   * Delete the chat (if creator)
   */
  async deleteChat(): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error('Not connected');
    }
    
    return new Promise(async (resolve, reject) => {
      try {
        const success = await this.send({ type: 'delete-chat' });
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
  
  /**
   * Disconnect from the server
   */
  disconnect() {
    this.isConnected = false;
    this.stopPingInterval();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket) {
      // Only try to close if the socket is not already closed
      if (this.socket.readyState !== WebSocket.CLOSED && 
          this.socket.readyState !== WebSocket.CLOSING) {
        try {
          this.socket.close(1000, "Normal closure");
        } catch (e) {
          console.error('Error closing socket:', e);
        }
      }
      this.socket = null;
    }
    
    this.sessionKey = null;
    this.emit('connectionStatus', 'disconnected');
  }
  
  /**
   * Check if connected
   */
  isActive(): boolean {
    return this.isConnected && 
           !!this.socket && 
           this.socket.readyState === WebSocket.OPEN;
  }
  
  /**
   * Get connection status
   */
  getConnectionState(): 'connected' | 'connecting' | 'disconnected' {
    if (this.isConnected) return 'connected';
    if (this.connecting) return 'connecting';
    return 'disconnected';
  }
  
  /**
   * For development and testing: simulate connection (mock server)
   */
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
      
      // Notify all waiting connection listeners
      this.connectionListeners.forEach(listener => listener());
      this.connectionListeners.clear();
    }, 500);
  }
  
  /**
   * For development and testing: simulate receiving data
   */
  private simulateDataReceived(message: any) {
    // Only simulate in development mode
    if (process.env.NODE_ENV !== 'development') return;
    
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
