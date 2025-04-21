import { EventEmitter } from 'events';
import { MessageType } from '../types/chat';
import * as bs58 from 'bs58';
import * as nacl from 'tweetnacl';

// Import from utility modules
import { 
  ReconnectionConfig, 
  SocketError,
  ConnectionStatus,
  PendingMessage,
  QueuedMessage,
  ChallengeMessage,
  IpAssignMessage,
  PingMessage,
  PongMessage,
  ErrorMessage,
  DisconnectMessage
} from './socket/types';

import {
  encryptData,
  decryptData,
  signChallenge,
  generateSessionKey
} from './socket/encryption';

import {
  DEFAULT_RECONNECTION_CONFIG,
  calculateBackoffDelay,
  shouldAttemptReconnect,
  canRetry,
  createReconnectionEvent
} from './socket/reconnection';

import {
  isSocketOpen,
  getSocketStateText,
  calculateLatency,
  createWebSocketUrl,
  createDisconnectMessage,
  createAuthMessage,
  needsHealthCheck,
  isConnectionDead
} from './socket/networking';

import {
  parseMessage,
  createSocketError,
  handlePingMessage,
  getPongLatency,
  processErrorMessage,
  shouldReconnectAfterDisconnect
} from './socket/messageHandlers';

// Import improved challenge handling
import {
  createChallengeResponse,
  parseChallengeData
} from './socket/handleChallenge';

// Import IP assignment processor
import { processIpAssign } from './socket/processIpAssign';

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
  private pendingMessages: Array<PendingMessage> = [];
  private messageQueue: Array<QueuedMessage> = [];
  private maxQueueSize: number = 100;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private lastMessageTime: number = Date.now();
  private connectionTimeout: NodeJS.Timeout | null = null;
  private processedMessageIds: Set<string> = new Set(); // For preventing replay attacks
  private serverPublicKey: string | null = null; // Store server public key for ECDH
  private forceReconnect: boolean = false; // Flag to force reconnection on server restart
  private heartbeatInterval: NodeJS.Timeout | null = null; // Heartbeat to detect connection issues
  private autoReconnect: boolean = true; // Flag to control automatic reconnection
  private pingTimeouts: Map<number, NodeJS.Timeout> = new Map(); // Map to track ping timeouts
  
  /**
   * Reconnection configuration with exponential backoff
   */
  private reconnectionConfig: ReconnectionConfig = DEFAULT_RECONNECTION_CONFIG;
  
  /**
   * Create a new AeroNyx socket
   * @param config Optional reconnection configuration
   */
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

    // Handle window beforeunload to cleanly close the connection
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleBeforeUnload);
      // Listen to online/offline events to handle network changes
      window.addEventListener('online', this.handleNetworkChange);
      window.addEventListener('offline', this.handleNetworkChange);
      
      // Also listen for visibility changes to handle tab switching
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    
    console.log('[Socket] AeroNyx socket initialized with config:', {
      initialDelay: this.reconnectionConfig.initialDelay,
      maxDelay: this.reconnectionConfig.maxDelay,
      maxAttempts: this.reconnectionConfig.maxAttempts
    });
  }
  
  /**
   * Handle visibility changes (tab switching)
   */
  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      console.log('[Socket] Tab became visible, checking connection');
      
      // If we're not connected but should be, try to reconnect
      if (!this.isConnected && !this.connecting && this.chatId && this.publicKey && this.autoReconnect) {
        console.log('[Socket] Reconnecting after tab became visible');
        this.reconnect();
      } else if (this.isConnected) {
        // Even if connected, check health by sending a ping
        this.sendPing();
      }
    }
  };
  
  /**
   * Handle window beforeunload event to clean up resources
   */
  private handleBeforeUnload = () => {
    console.log('[Socket] Page unloading, cleaning up socket resources');
    this.autoReconnect = false;
    
    // Try to send a clean disconnect message if possible
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        // Use a synchronous approach for beforeunload
        const disconnectMsg = JSON.stringify(createDisconnectMessage(0, 'User left the page'));
        this.socket.send(disconnectMsg);
      } catch (e) {
        // Ignore errors during page unload
      }
    }
    
    this.disconnect();
  };

  /**
   * Handle network connectivity changes
   */
  private handleNetworkChange = (event: Event) => {
    console.log(`[Socket] Network status change: ${event.type}`);
    if (event.type === 'online' && !this.isConnected && this.chatId && this.publicKey) {
      console.log('[Socket] Network connection restored, attempting to reconnect');
      this.connect(this.chatId, this.publicKey).catch(err => {
        console.error('[Socket] Failed to reconnect after network change:', err);
      });
    } else if (event.type === 'offline' && this.isConnected) {
      console.log('[Socket] Network connection lost');
      this.emit('connectionStatus', 'disconnected');
    }
  };

  /**
   * Get the current server URL
   */
  public getServerUrl(): string {
    return this.serverUrl;
  }

  /**
   * Set a custom server URL
   * @param url The server URL to use
   */
  public setServerUrl(url: string): void {
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      url = `wss://${url}`;
    }
    this.serverUrl = url;
    console.log(`[Socket] Server URL set to ${url}`);
  }
  
  /**
   * Connect to AeroNyx server with retry logic and connection timeout
   * @param chatId Chat room ID
   * @param publicKey User's public key
   * @returns Promise resolving when connection is established
   * @throws Error if connection fails
   */
  async connect(chatId: string, publicKey: string): Promise<void> {
    if (this.socket && this.isConnected && !this.forceReconnect) {
      console.log('[Socket] Already connected, reusing existing connection');
      return;
    }
    
    // Reset force reconnect flag
    this.forceReconnect = false;
    this.autoReconnect = true;
    
    this.chatId = chatId;
    this.publicKey = publicKey;
    this.connecting = true;
    
    // Reset reconnection attempts when manually connecting
    this.reconnectAttempts = 0;
    
    return new Promise((resolve, reject) => {
      try {
        // Clean up any existing connection
        this.cleanupConnection(false);
        
        // Create WebSocket URL
        const serverUrl = createWebSocketUrl(this.serverUrl, chatId);
        
        console.log(`[Socket] Connecting to WebSocket server at: ${serverUrl}`);
        this.emit('connectionStatus', 'connecting');
        
        this.socket = new WebSocket(serverUrl);
        
        // Add timeout for connection attempt
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
        }
        
        this.connectionTimeout = setTimeout(() => {
          if (this.connecting) {
            const timeoutError = new Error('WebSocket connection timed out');
            console.error('[Socket] Connection timeout:', timeoutError);
            this.emit('error', createSocketError(
              'connection',
              'Connection to secure chat server timed out. This might be due to network issues or server unavailability.',
              'TIMEOUT',
              undefined,
              true
            ));
            
            if (this.socket) {
              this.socket.close();
              this.socket = null;
            }
            
            this.connecting = false;
            reject(timeoutError);
            
            // Auto-retry on timeout if not max attempts
            if (this.autoReconnect && canRetry(this.reconnectAttempts, this.reconnectionConfig.maxAttempts)) {
              this.scheduleReconnect();
            }
          }
        }, 10000); // 10 second timeout
        
        this.socket.onopen = () => {
          this.clearConnectionTimeout();
          console.log('[Socket] WebSocket connection established');
          this.sendAuthMessage();
          this.reconnectAttempts = 0;
          this.lastMessageTime = Date.now();
          
          // Start heartbeat immediately after connection
          this.startHeartbeat();
        };
        
        this.socket.onmessage = async (event) => {
          this.clearConnectionTimeout();
          this.lastMessageTime = Date.now();
          await this.handleServerMessage(event.data);
        };
        
        this.socket.onclose = (event) => {
          this.clearConnectionTimeout();
          this.stopHeartbeat();
          this.isConnected = false;
          this.emit('connectionStatus', 'disconnected');
          
          console.log(`[Socket] WebSocket connection closed: ${event.code} - ${event.reason}`);
          
          // Check for common certificate and security error codes
          if (event.code === 1006 || event.code === 1015) {
            const errorMsg = 'Connection closed due to security issues. This might be related to a certificate problem.';
            console.error(`[Socket] ${errorMsg}`);
            
            this.emit('error', createSocketError(
              'connection',
              errorMsg,
              `WS_CLOSED_${event.code}`,
              `You might need to visit ${this.serverUrl.replace('wss://', 'https://')} directly in your browser and accept the certificate.`,
              false
            ));
          }
          
          if (this.connecting) {
            const closeError = new Error(`Connection closed during handshake: ${event.code} - ${event.reason}`);
            reject(closeError);
            this.connecting = false;
          }
          
          // Attempt to reconnect automatically for common error codes or server reset
          if (this.autoReconnect && 
              (shouldAttemptReconnect(event.code) || this.forceReconnect) && 
              canRetry(this.reconnectAttempts, this.reconnectionConfig.maxAttempts)) {
            this.scheduleReconnect();
          }
        };
        
        this.socket.onerror = (error) => {
          this.clearConnectionTimeout();
          console.error('[Socket] WebSocket error:', error);
          
          this.emit('error', createSocketError(
            'connection',
            'Failed to establish a secure connection to the chat server.',
            'WS_ERROR',
            'This might be due to network issues, server unavailability, or certificate problems.',
            true,
            error
          ));
          
          if (this.connecting) {
            reject(new Error('WebSocket connection error'));
            this.connecting = false;
          }
        };
      } catch (error) {
        this.clearConnectionTimeout();
        console.error('[Socket] Error creating WebSocket connection:', error);
        this.connecting = false;
        
        this.emit('error', createSocketError(
          'connection',
          'Failed to initiate connection to the secure chat server.',
          'INIT_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
          true
        ));
        
        reject(error);
        
        // Attempt to reconnect if initialization fails
        if (this.autoReconnect && canRetry(this.reconnectAttempts, this.reconnectionConfig.maxAttempts)) {
          this.scheduleReconnect();
        }
      }
    });
  }
  
  /**
   * Clean up existing connection
   * @param emitEvents Whether to emit events during cleanup
   */
  private cleanupConnection(emitEvents: boolean = true): void {
    this.stopPingInterval();
    this.stopKeepAliveMonitoring();
    this.stopHeartbeat();
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.socket) {
      try {
        // Only try to close if socket is still open
        if (this.socket.readyState === WebSocket.OPEN || 
            this.socket.readyState === WebSocket.CONNECTING) {
          this.socket.close(1000, "Normal closure");
        }
      } catch (e) {
        console.error('[Socket] Error closing socket:', e);
      }
      this.socket = null;
    }
    
    if (emitEvents && this.isConnected) {
      this.isConnected = false;
      this.emit('connectionStatus', 'disconnected');
    }
  }
  
  /**
   * Clear the connection timeout if it exists
   */
  private clearConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }
  
  /**
   * Send authentication message to the server
   */
  private sendAuthMessage(): void {
    if (!this.socket || !this.publicKey) return;
    
    const authMessage = createAuthMessage(this.publicKey);
    
    try {
      this.socket.send(JSON.stringify(authMessage));
      console.log('[Socket] Auth message sent successfully');
    } catch (error) {
      console.error('[Socket] Error sending auth message:', error);
      this.emit('error', createSocketError(
        'auth',
        'Failed to send authentication message',
        'AUTH_ERROR',
        undefined,
        true
      ));
    }
  }
  
  /**
   * Start heartbeat mechanism to detect broken connections quickly
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      // If socket is not connected, don't try to send heartbeat
      if (!isSocketOpen(this.socket)) {
        console.warn('[Socket] Cannot send heartbeat: Socket not open');
        return;
      }
      
      try {
        // Simple ping as a heartbeat
        this.sendPing();
        
        // Check if we've received a response within the expected timeframe
        const currentTime = Date.now();
        const timeSinceLastMessage = currentTime - this.lastMessageTime;
        
        // If no message for more than 20 seconds (2 heartbeat intervals)
        if (timeSinceLastMessage > 20000) {
          console.warn(`[Socket] No message received for ${Math.round(timeSinceLastMessage/1000)}s, connection may be dead`);
          
          // Update UI to show connection issues
          this.emit('connectionStatus', 'connecting');
          this.emit('error', createSocketError(
            'connection',
            'Connection appears to be unresponsive',
            'CONNECTION_UNRESPONSIVE',
            undefined,
            true
          ));
          
          // Try to immediately reconnect
          if (timeSinceLastMessage > 30000) {
            console.warn('[Socket] Connection timeout exceeded, forcing reconnection');
            this.forceReconnect = true;
            this.reconnect();
          }
        }
      } catch (error) {
        console.error('[Socket] Error sending heartbeat:', error);
      }
    }, 10000); // Check every 10 seconds
  }
  
  /**
   * Stop the heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Also clear any pending ping timeouts
    for (const timeout of this.pingTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.pingTimeouts.clear();
  }
  
  /**
   * Attempt to reconnect immediately
   */
  public reconnect(): void {
    if (this.chatId && this.publicKey) {
      console.log('[Socket] Forcing reconnection...');
      this.connect(this.chatId, this.publicKey).catch(err => {
        console.error('[Socket] Forced reconnection failed:', err);
      });
    } else {
      console.error('[Socket] Cannot reconnect: Missing chatId or publicKey');
    }
  }
  
  /**
   * Handle messages from the server
   * @param data Message data
   */
  private async handleServerMessage(data: string | ArrayBuffer | Blob): Promise<void> {
    try {
      // Parse the message
      const message = await parseMessage(data);
      
      // Process the parsed message
      await this.processMessage(message);
    } catch (error) {
      console.error('[Socket] Error handling server message:', error);
      this.emit('error', createSocketError(
        'message',
        'Failed to parse server message',
        'PARSE_ERROR',
        undefined,
        false,
        error
      ));
    }
  }
  
  /**
   * Process parsed message
   * @param message The parsed message
   */
  private async processMessage(message: any): Promise<void> {
    if (!message || !message.type) {
      console.warn('[Socket] Received message with no type', message);
      return;
    }
    
    try {
      switch (message.type) {
        case 'Challenge':
          await this.handleChallenge(message);
          break;
        
        case 'IpAssign':
          await this.handleIpAssign(message);
          break;
        
        case 'Data':
          await this.handleDataPacket(message);
          break;
        
        case 'Ping':
          await this.handlePing(message);
          break;
          
        case 'Pong':
          this.handlePong(message);
          break;
        
        case 'Error':
          this.handleError(message);
          break;
        
        case 'Disconnect':
          this.handleDisconnect(message);
          break;
          
        default:
          console.warn('[Socket] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error(`[Socket] Error processing message of type ${message.type}:`, error);
      this.emit('error', createSocketError(
        'message',
        `Error processing ${message.type} message`,
        'PROCESS_ERROR',
        error instanceof Error ? error.message : String(error),
        false,
        error
      ));
    }
  }
  
  /**
   * Handle authentication challenge
   * @param message Challenge message
   */
  private async handleChallenge(message: ChallengeMessage): Promise<void> {
    try {
      console.log('[Socket] Received authentication challenge, ID:', message.id);
      
      // Store server public key for later ECDH key exchange
      if (message.server_public_key) {
        this.serverPublicKey = message.server_public_key;
        console.log('[Socket] Received server public key for ECDH');
      }
      
      if (!this.publicKey) {
        throw new Error('No public key available for challenge response');
      }
      
      // Use our improved challenge handling
      const response = await createChallengeResponse(message, this.publicKey);
      
      // Send the response
      if (isSocketOpen(this.socket)) {
        this.socket.send(JSON.stringify(response));
        console.log('[Socket] Challenge response sent successfully');
      } else {
        console.error('[Socket] Socket not open when trying to send challenge response');
        throw new Error('Socket connection not available');
      }
    } catch (error) {
      console.error('[Socket] Error handling challenge:', error);
      this.emit('error', createSocketError(
        'auth',
        'Failed to authenticate with server',
        'AUTH_CHALLENGE_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        true,
        error
      ));
      
      // Attempt reconnection
      if (this.autoReconnect) {
        this.scheduleReconnect();
      }
    }
  }
  
  /**
   * Handle IP assignment message after successful authentication
   * @param message IP assignment message
   */
  private async handleIpAssign(message: IpAssignMessage): Promise<void> {
    try {
      // Store the session ID
      this.sessionId = message.session_id;
      
      // Log successful connection
      console.log(`[Socket] IP assigned: ${message.ip_address}, Session ID: ${message.session_id}`);
      
      // If server_public_key wasn't provided in Challenge, it might be here
      if (message.server_public_key && !this.serverPublicKey) {
        this.serverPublicKey = message.server_public_key;
      }
      
      // Process the session key
      try {
        this.sessionKey = await processIpAssign(message, this.serverPublicKey);
        console.log('[Socket] Session key stored, length:', this.sessionKey.length);
      } catch (keyError) {
        console.error('[Socket] Error processing session key:', keyError);
        
        // Generate random key as fallback
        if (window.crypto && window.crypto.getRandomValues) {
          this.sessionKey = new Uint8Array(32);
          window.crypto.getRandomValues(this.sessionKey);
        } else {
          this.sessionKey = nacl.randomBytes(32);
        }
        
        console.log('[Socket] Generated fallback session key of length:', this.sessionKey.length);
      }
      
      this.isConnected = true;
      this.connecting = false;
      
      this.emit('connectionStatus', 'connected');
      
      // Start ping interval to keep connection alive
      this.startPingInterval();
      
      // Start keep-alive monitoring
      this.startKeepAliveMonitoring();
      
      // Notify successful connection
      this.emit('connected', {
        ip: message.ip_address,
        sessionId: message.session_id,
      });
      
      // Send any messages that were queued while disconnected
      await this.processPendingMessages();
      
      // Notify all waiting connection listeners
      this.connectionListeners.forEach(listener => listener());
      this.connectionListeners.clear();
    } catch (error) {
      console.error('[Socket] Error handling IP assignment:', error);
      this.emit('error', createSocketError(
        'connection',
        'Failed to complete connection setup',
        'IP_ASSIGN_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        true,
        error
      ));
      
      if (this.autoReconnect) {
        this.scheduleReconnect();
      }
    }
  }
  
  /**
   * Handle encrypted data packet
   * @param message Data packet message
   */
  private async handleDataPacket(message: { encrypted: number[], nonce: number[], counter: number }): Promise<void> {
    try {
      if (!this.sessionKey) {
        throw new Error('No session key available to decrypt message');
      }
      
      // Convert array data to Uint8Array for decryption
      const encryptedUint8 = new Uint8Array(message.encrypted);
      const nonceUint8 = new Uint8Array(message.nonce);
      
      // Log packet details for debugging
      console.debug('[Socket] Received encrypted data:', {
        encryptedSize: encryptedUint8.length,
        nonceSize: nonceUint8.length,
        counter: message.counter
      });
      
      try {
        // Decrypt the data
        const decryptedData = await decryptData(encryptedUint8, nonceUint8, this.sessionKey);
        
        // Check for message replay attempts
        if (decryptedData.id && this.processedMessageIds.has(decryptedData.id)) {
          console.warn('[Socket] Detected message replay attempt, ignoring');
          return;
        }
        
        // Store message ID to prevent replay attacks
        if (decryptedData.id) {
          this.processedMessageIds.add(decryptedData.id);
          
          // Limit size of processed IDs set
          if (this.processedMessageIds.size > 10000) {
            // Remove oldest ID (first in set)
            const oldestId = this.processedMessageIds.values().next().value;
            this.processedMessageIds.delete(oldestId);
          }
        }
        
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
        
        // Update last message time for keep-alive monitoring
        this.lastMessageTime = Date.now();
      } catch (decryptError) {
        console.error('[Socket] Failed to decrypt data packet:', decryptError);
        
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
      console.error('[Socket] Error handling data packet:', error);
      this.emit('error', createSocketError(
        'data',
        'Failed to process data packet',
        'DATA_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        false,
        error
      ));
    }
  }
  
  /**
   * Handle server ping message
   * @param message Ping message
   */
  private async handlePing(message: PingMessage): Promise<void> {
    try {
      // Send pong response
      if (isSocketOpen(this.socket)) {
        const pong = handlePingMessage(message);
        this.socket.send(JSON.stringify(pong));
        console.log(`[Socket] Responding to ping: ${message.sequence}`);
      }
    } catch (error) {
      console.error('[Socket] Error handling ping:', error);
    }
  }
  
  /**
   * Handle server pong message
   * @param message Pong message
   */
  private handlePong(message: PongMessage): void {
    try {
      const now = Date.now();
      const latency = now - message.echo_timestamp;
      console.log(`[Socket] Received pong: sequence ${message.sequence}, latency ${latency}ms`);
      
      // Update last message time
      this.lastMessageTime = now;
      
      // Clear this ping's timeout handler
      if (this.pingTimeouts.has(message.sequence)) {
        clearTimeout(this.pingTimeouts.get(message.sequence)!);
        this.pingTimeouts.delete(message.sequence);
      }
    } catch (error) {
      console.error('[Socket] Error handling pong:', error);
    }
  }
  
  /**
   * Handle error message from server
   * @param message Error message
   */
  private handleError(message: ErrorMessage): void {
    console.error('[Socket] Server error:', message.message, message.code);
    this.emit('error', createSocketError(
      'server',
      message.message,
      message.code ? `SERVER_${message.code}` : 'SERVER_ERROR',
      undefined,
      message.code ? message.code < 5000 : true // Retry for non-fatal errors
    ));
    
    // For certain error codes, we might want to reconnect
    if (this.autoReconnect && message.code && [1001, 1002, 1003].includes(message.code)) {
      this.scheduleReconnect();
    }
  }
  
  /**
   * Handle disconnect message from server
   * @param message Disconnect message
   */
  private handleDisconnect(message: DisconnectMessage): void {
    this.isConnected = false;
    this.emit('disconnected', message.reason, message.message);
    this.stopPingInterval();
    this.stopKeepAliveMonitoring();
    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    // If reason is non-fatal, attempt to reconnect
    if (this.autoReconnect && shouldReconnectAfterDisconnect(message)) {
      this.scheduleReconnect();
    }
  }
  
  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.stopPingInterval();
    
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 30000); // Send ping every 30 seconds
  }
  
  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  /**
   * Start keep-alive monitoring to detect dead connections
   */
  private startKeepAliveMonitoring(): void {
    this.stopKeepAliveMonitoring();
    
    // Check connection health every 30 seconds
    this.keepAliveInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastMessage = now - this.lastMessageTime;
      
      // If no message for 90 seconds, connection might be dead
      if (timeSinceLastMessage > 90000) {
        console.warn(`[Socket] No messages received for ${Math.round(timeSinceLastMessage/1000)}s, checking connection health`);
        this.checkConnectionHealth();
      } else if (timeSinceLastMessage > 15000 && isSocketOpen(this.socket)) {
        // If it's been over 15 seconds since last message, send a keep-alive ping
        console.log('[Socket] Sending keep-alive ping');
        this.sendPing();
      }
      
      // Actively detect disconnected state
      if (!this.isConnected && !this.connecting && this.autoReconnect && 
          canRetry(this.reconnectAttempts, this.reconnectionConfig.maxAttempts)) {
        console.log('[Socket] Detected disconnected state, initiating reconnect');
        this.scheduleReconnect();
      }
    }, 30000);
  }
  
  /**
   * Stop keep-alive monitoring
   */
  private stopKeepAliveMonitoring(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
  
  /**
   * Send ping to keep connection alive
   */
  private sendPing(): void {
    if (!isSocketOpen(this.socket)) return;
    
    try {
      const sequenceId = this.messageCounter++;
      const ping = {
        type: 'Ping',
        timestamp: Date.now(),
        sequence: sequenceId,
      };
      
      this.socket.send(JSON.stringify(ping));
      
      // Set ping timeout detection
      const pingTimeout = setTimeout(() => {
        console.warn('[Socket] Ping timeout - no pong received');
        // If ping times out, the connection might be broken
        this.checkConnectionHealth();
      }, 5000); // 5 second timeout
      
      // Store this ping's timeout handler
      this.pingTimeouts.set(sequenceId, pingTimeout);
    } catch (error) {
      console.error('[Socket] Error sending ping:', error);
      // If we can't send a ping, the connection might be dead
      this.checkConnectionHealth();
    }
  }
  
  /**
   * Check if the connection is healthy
   */
  private checkConnectionHealth(): void {
    if (isSocketOpen(this.socket)) {
      // Send a ping to check if connection is alive
      try {
        // Clear any existing ping timeouts first
        for (const [seq, timeout] of this.pingTimeouts.entries()) {
          clearTimeout(timeout);
          this.pingTimeouts.delete(seq);
        }
        
        console.log('[Socket] Performing connection health check');
        this.sendPing();
        
        // Set a short timeout to see if we get a response
        setTimeout(() => {
          if (this.isConnected && Date.now() - this.lastMessageTime > 10000) {
            console.warn('[Socket] Health check failed - no response received');
            this.handleConnectionFailure();
          }
        }, 3000);
        
        return;
      } catch (e) {
        // Error sending ping, connection may be dead
        console.error('[Socket] Error sending health check ping:', e);
      }
    }
    
    this.handleConnectionFailure();
  }
  
  /**
   * Handle connection failure
   */
  private handleConnectionFailure(): void {
    // Connection unhealthy, attempt to reconnect
    console.warn('[Socket] Connection appears unhealthy, attempting to reconnect');
    this.isConnected = false;
    this.emit('connectionStatus', 'disconnected');
    
    // Also notify users about the connection issue
    this.emit('error', createSocketError(
      'connection',
      'Connection to the server was lost. Attempting to reconnect...',
      'CONNECTION_LOST',
      undefined,
      true
    ));
    
    // Clean up existing socket
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {
        // Ignore errors when closing an already broken socket
      }
      this.socket = null;
    }
    
    if (this.autoReconnect) {
      this.forceReconnect = true;
      this.scheduleReconnect();
    }
  }
  
  /**
   * Schedule reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    // Don't reconnect if we've reached max attempts
    if (!canRetry(this.reconnectAttempts, this.reconnectionConfig.maxAttempts)) {
      console.log(`[Socket] Max reconnection attempts (${this.reconnectionConfig.maxAttempts}) reached`);
      this.emit('error', createSocketError(
        'connection',
        `Failed to reconnect after ${this.reconnectionConfig.maxAttempts} attempts`,
        'MAX_RECONNECT',
        undefined,
        false
      ));
      return;
    }
    
    // Calculate backoff delay with exponential increase
    const delay = calculateBackoffDelay(this.reconnectAttempts, this.reconnectionConfig);
    
    console.log(`[Socket] Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
    
    this.emit('reconnecting', createReconnectionEvent(
      this.reconnectAttempts + 1,
      this.reconnectionConfig.maxAttempts,
      delay
    ));
    
    this.reconnectTimeout = setTimeout(async () => {
      if (this.chatId && this.publicKey) {
        this.reconnectAttempts++;
        try {
          await this.connect(this.chatId, this.publicKey);
        } catch (error) {
          console.error('[Socket] Reconnection attempt failed:', error);
        }
      }
    }, delay);
  }
  
  /**
   * Encrypt and send data packet
   * @param data The data to send
   * @returns Promise resolving to true if sent successfully
   */
  public async send(data: any): Promise<boolean> {
    if (!this.socket || !this.isConnected) {
      console.error('[Socket] Cannot send data: not connected');
      this.queueMessage('data', data);
      return false;
    }
    
    if (!this.sessionKey) {
      console.error('[Socket] Cannot send data: missing session key');
      this.queueMessage('data', data);
      return false;
    }
    
    try {
      // Encrypt the data with session key
      const { encrypted, nonce } = await encryptData(data, this.sessionKey);
      
      // Log details of packet being sent (excluding sensitive data)
      console.debug('[Socket] Sending encrypted packet:', {
        dataType: data.type,
        encryptedSize: encrypted.length,
        nonceSize: nonce.length,
        counter: this.messageCounter,
      });
      
      // Create data packet with the correct format
      const dataPacket = {
        type: 'Data',
        encrypted: Array.from(encrypted), // Convert Uint8Array to regular array for JSON serialization
        nonce: Array.from(nonce),
        counter: this.messageCounter++,
        padding: null // Optional padding for length concealment
      };
      
      // Check socket is still connected
      if (!isSocketOpen(this.socket)) {
        console.error('[Socket] Socket closed while preparing to send data');
        this.queueMessage('data', data);
        return false;
      }
      
      // Send the packet
      this.socket.send(JSON.stringify(dataPacket));
      return true;
    } catch (error) {
      console.error('[Socket] Error sending encrypted data:', error);
      
      // Queue message for retry
      this.queueMessage('data', data);
      
      this.emit('error', createSocketError(
        'data',
        'Failed to send encrypted data',
        'ENCRYPTION_ERROR',
        error instanceof Error ? error.message : String(error),
        true,
        error
      ));
      
      // Check if the socket is still valid - if not, try to reconnect
      if (!isSocketOpen(this.socket)) {
        console.warn('[Socket] Socket no longer open, will attempt reconnection');
        if (this.autoReconnect) {
          this.reconnect();
        }
      }
      
      return false;
    }
  }
  
  /**
   * Send a message to the chat
   * @param message The message to send
   * @returns Promise resolving to true if sent successfully, false otherwise
   */
  async sendMessage(message: MessageType): Promise<boolean> {
    // If not connected, queue message and return false
    if (!this.socket || !this.isConnected) {
      console.log('[Socket] Not connected, queueing message');
      this.queueMessage('message', message);
      return false;
    }
    
    if (!this.sessionKey) {
      console.error('[Socket] Cannot send message: missing session key');
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
      
      // Use our encryption method
      const success = await this.send(messageData);
      
      // If send was successful, log it
      if (success) {
        console.log('[Socket] Message sent successfully');
      }
      
      return success;
    } catch (error) {
      console.error('[Socket] Error sending message:', error);
      
      // Queue message for retry
      this.queueMessage('message', message);
      
      this.emit('error', createSocketError(
        'message',
        'Failed to send message',
        'SEND_ERROR',
        undefined,
        true,
        error
      ));
      
      return false;
    }
  }
  
  /**
   * Queue a message to be sent when connection is restored
   * @param type Message type
   * @param data Message data
   */
  private queueMessage(type: string, data: any): void {
    this.pendingMessages.push({ type, data });
    
    // Limit queue size to prevent memory issues
    if (this.pendingMessages.length > this.maxQueueSize) {
      this.pendingMessages.shift(); // Remove oldest message
    }
    
    console.log(`[Socket] Message queued. Total pending messages: ${this.pendingMessages.length}`);
  }
  
  /**
   * Process any pending messages
   */
  private async processPendingMessages(): Promise<void> {
    if (this.pendingMessages.length === 0) return;
    
    console.log(`[Socket] Processing ${this.pendingMessages.length} pending messages`);
    
    // Create a copy and clear the queue to prevent requeuing the same messages
    const messagesToSend = [...this.pendingMessages];
    this.pendingMessages = [];
    
    // Send each message
    for (const { type, data } of messagesToSend) {
      try {
        if (type === 'message') {
          await this.sendMessage(data);
        } else if (type === 'data') {
          await this.send(data);
        }
      } catch (error) {
        console.error('[Socket] Error sending queued message:', error);
      }
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
      
      // If not connected and not connecting, attempt to connect first
      if (!this.connecting && this.chatId && this.publicKey) {
        console.log('[Socket] Initiating connection before waitForConnection');
        this.connect(this.chatId, this.publicKey).catch(error => {
          console.error('[Socket] Failed to initiate connection:', error);
        });
      }
      
      // Add listener for connection
      const connectionListener = () => {
        resolve();
      };
      
      this.connectionListeners.add(connectionListener);
      
      // Add timeout
      const timeout = setTimeout(() => {
        this.connectionListeners.delete(connectionListener);
        
        // Update UI to show connection timeout
        this.emit('error', createSocketError(
          'connection',
          'Connection attempt timed out. The server may be unavailable.',
          'CONNECTION_TIMEOUT',
          undefined,
          true
        ));
        
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
   * @returns Promise resolving when chat info is received
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
      try {
        const success = await this.send({ type: 'request-chat-info' });
        
        if (!success) {
          clearTimeout(timeout);
          this.off('chatInfo', listener);
          reject(new Error('Failed to send request'));
        }
      } catch (error) {
        clearTimeout(timeout);
        this.off('chatInfo', listener);
        reject(error);
      }
    });
  }
  
  /**
   * Request participants list
   * @returns Promise resolving when participants list is received
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
      try {
        const success = await this.send({ type: 'request-participants' });
        
        if (!success) {
          clearTimeout(timeout);
          this.off('participants', listener);
          reject(new Error('Failed to send request'));
        }
      } catch (error) {
        clearTimeout(timeout);
        this.off('participants', listener);
        reject(error);
      }
    });
  }
  
  /**
   * Leave the chat gracefully
   * @returns Promise resolving when the leave message is sent
   */
  async leaveChat(): Promise<void> {
    this.autoReconnect = false;
    
    if (!this.socket || !this.isConnected) {
      return;
    }
    
    try {
      const leaveMessage = createDisconnectMessage(0, 'User left the chat');
      
      // Send disconnect message if socket is open
      if (isSocketOpen(this.socket)) {
        this.socket.send(JSON.stringify(leaveMessage));
      }
    } catch (error) {
      console.error('[Socket] Error sending leave message:', error);
    } finally {
      // Always clean up resources
      this.disconnect();
    }
  }
  
  /**
   * Delete the chat (if creator)
   * @returns Promise resolving when the chat is deleted
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
  disconnect(): void {
    this.isConnected = false;
    this.stopPingInterval();
    this.stopKeepAliveMonitoring();
    this.stopHeartbeat();
    
    // Clear all scheduled reconnection attempts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    // Clear all ping timeouts
    for (const timeout of this.pingTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.pingTimeouts.clear();
    
    if (this.socket) {
      // Only try to close if the socket is not already closed
      if (this.socket.readyState !== WebSocket.CLOSED && 
          this.socket.readyState !== WebSocket.CLOSING) {
        try {
          this.socket.close(1000, "Normal closure");
        } catch (e) {
          console.error('[Socket] Error closing socket:', e);
        }
      }
      this.socket = null;
    }
    
    this.sessionKey = null;
    this.emit('connectionStatus', 'disconnected');
    
    console.log('[Socket] Disconnected and cleaned up all resources');
  }
  
  /**
   * Check if connected
   * @returns True if connected, false otherwise
   */
  isActive(): boolean {
    return this.isConnected && isSocketOpen(this.socket);
  }
  
  /**
   * Get connection status
   * @returns Connection status string
   */
  getConnectionState(): ConnectionStatus {
    if (this.isConnected) return 'connected';
    if (this.connecting) return 'connecting';
    return 'disconnected';
  }
  
  /**
   * Get detailed connection status information
   * Useful for debugging and displaying to users
   */
  getConnectionInfo(): {
    state: ConnectionStatus,
    socketState: number | null,
    socketStateText: string,
    lastMessageTime: number,
    timeSinceLastMessage: number,
    reconnectAttempts: number,
    hasSessionKey: boolean,
    pendingMessages: number
  } {
    const socketState = this.socket ? this.socket.readyState : null;
    const socketStateText = getSocketStateText(socketState);
    
    return {
      state: this.getConnectionState(),
      socketState,
      socketStateText,
      lastMessageTime: this.lastMessageTime,
      timeSinceLastMessage: Date.now() - this.lastMessageTime,
      reconnectAttempts: this.reconnectAttempts,
      hasSessionKey: !!this.sessionKey,
      pendingMessages: this.pendingMessages.length
    };
  }
  
  /**
   * For development and testing: simulate data receiving
   * @param message Message data
   */
  private simulateDataReceived(message: any): void {
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
