// src/lib/socket.ts
import { EventEmitter } from 'events';
import * as bs58 from 'bs58';
import { Buffer } from 'buffer'; // Ensure buffer polyfill is available

// Import ALL necessary crypto functions from the centralized cryptoUtils
import {
  parseChallengeData,
  signChallenge,
  convertEd25519PublicKeyToCurve25519,
  convertEd25519SecretKeyToCurve25519,
  deriveECDHRawSharedSecret,
  deriveKeyWithHKDF,
  decryptWithAesGcm,
  createEncryptedDataPacket,
  processEncryptedDataPacket,
  testEncryptionCompat,
  numberArrayToUint8Array
} from '../utils/cryptoUtils';

import { getStoredKeypair } from '../utils/keyStorage';

// Import ALL message types from ONE place (types.ts)
import {
  AuthMessage,
  ChallengeMessage,
  ChallengeResponse,
  IpAssignMessage,
  PingMessage,
  PongMessage,
  ErrorMessage,
  DisconnectMessage,
  MessageType,
  ChatInfo,
  Participant,
  WebRTCSignalPayload,
  KeyRotationRequestPayload,
  KeyRotationResponsePayload,
  // Socket type definitions
  BasePacket,
  DataPacket,
  MessagePayload,
  ChatInfoPayload,
  ParticipantsPayload,
  SocketError as ImportedSocketError,
  isMessageType,
  isChatInfoPayload,
  isParticipantsPayload,
  isWebRTCSignalPayload,
  isKeyRotationRequestPayload,
  isKeyRotationResponsePayload
} from './socket/types';

// Import network and reconnection utilities
import { ReconnectionConfig } from './socket/reconnection';
import { 
  calculateBackoffDelay, 
  canRetry, 
  shouldAttemptReconnect 
} from './socket/reconnection';
import { 
  createWebSocketUrl, 
  isSocketOpen, 
  createDisconnectMessage as formatDisconnectMessage 
} from './socket/networking';

// Define local types that aren't imported
export enum SendResult {
  SENT = 'sent',
  QUEUED = 'queued',
  FAILED = 'failed'
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'p2p-connecting';

// Re-export the SocketError type
export type SocketError = ImportedSocketError;

/**
 * Testing interface for non-production environments
 */
export interface AeroNyxSocketTestingInterface {
  getState: () => string;
  simulateServerMessage: (message: any) => Promise<void>;
  getQueueInfo: () => { size: number, processing: boolean };
  getNetworkQuality: () => 'excellent' | 'good' | 'poor' | 'bad';
  getSessionInfo: () => { hasSessionKey: boolean, sessionId: string | null, lastKeyRotation: number, messageCounter: number };
  clearQueue: () => boolean;
}

/**
 * Internal connection state for state machine pattern
 * Using numeric enum values to avoid type comparison issues
 */

type InternalConnectionStateType = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'reconnecting' | 'closing';


const InternalConnectionState = {
  DISCONNECTED: 'disconnected' as InternalConnectionStateType,
  CONNECTING: 'connecting' as InternalConnectionStateType,
  AUTHENTICATING: 'authenticating' as InternalConnectionStateType,
  CONNECTED: 'connected' as InternalConnectionStateType,
  RECONNECTING: 'reconnecting' as InternalConnectionStateType,
  CLOSING: 'closing' as InternalConnectionStateType
};


// Map of numeric states to their string representation for logging/debugging
const CONNECTION_STATE_NAMES: Record<string, string> = {
  [InternalConnectionState.DISCONNECTED]: 'disconnected',
  [InternalConnectionState.CONNECTING]: 'connecting',
  [InternalConnectionState.AUTHENTICATING]: 'authenticating',
  [InternalConnectionState.CONNECTED]: 'connected',
  [InternalConnectionState.RECONNECTING]: 'reconnecting',
  [InternalConnectionState.CLOSING]: 'closing'
};

/**
 * Message priority levels for queue processing
 */
export enum MessagePriority {
  CRITICAL = 0,   // Authentication, connection management
  HIGH = 1,       // User-initiated actions (e.g., sending a message)
  NORMAL = 2,     // Standard operations (e.g., requesting info)
  LOW = 3,        // Background updates
  BACKGROUND = 4  // Non-essential information
}


/**
 * Pending message interface with TTL, retry count, and priority
 */
interface PendingMessage {
  type: string; // e.g., 'data' (as all messages are sent via `send`)
  data: any;    // The actual application payload
  timestamp: number;
  id: string;       // Unique ID for tracking and deduplication
  retryCount: number;
  priority: MessagePriority; // Added for priority queue support
}

/**
 * Default reconnection configuration with exponential backoff
 */
const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
  initialDelay: 1000,
  maxDelay: 30000,
  maxAttempts: 10,
  jitter: true
};

// Constants for timing, limits, etc.
const CONNECTION_TIMEOUT_MS = 10000;
const PING_INTERVAL_MS = 30000;
const PING_TIMEOUT_MS = 5000;
const KEEP_ALIVE_CHECK_INTERVAL_MS = 30000;
const KEEP_ALIVE_THRESHOLD_MS = 90000; // If no message received for this long, check health
const HEARTBEAT_INTERVAL_MS = 10000;
const IDLE_THRESHOLD_MS = 15000; // Send ping if idle for this long
const MESSAGE_QUEUE_MAX_SIZE = 100;
const MESSAGE_QUEUE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL for queued messages
const MESSAGE_ID_CACHE_MAX_SIZE = 5000; // Max size for replay protection cache
const MESSAGE_ID_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL for replay protection cache
const MAX_MESSAGE_RETRY_ATTEMPTS = 3; // Max retries for queued messages
const KEY_ROTATION_INTERVAL_MS = 30 * 60 * 1000; // Example: Rotate keys every 30 minutes
const DEFAULT_BATCH_SIZE = 5; // Default number of messages to process in a batch
const MAX_BATCH_SIZE = 10;    // Maximum batch size
const MIN_BATCH_SIZE = 1;     // Minimum batch size
const BATCH_PROCESS_DELAY_MS = 10; // Delay between processing batches


  /**
 * Data envelope for encapsulating application messages
 * Required by updated server protocol
 */
interface DataEnvelope {
  payloadType: 'json';
  payload: any;
}

/**
 * AeroNyx Socket - Manages WebSocket connections with robust error handling,
 * reconnection logic, state management, and secure messaging according to spec.
 */
export class AeroNyxSocket extends EventEmitter {
  // --- Connection & State ---
  private socket: WebSocket | null = null;
  private chatId: string | null = null;
  private publicKey: string | null = null; // Client's Ed25519 public key (Base58)
  private localPeerId: string | null = null;
  private serverUrl: string = process.env.NEXT_PUBLIC_AERONYX_SERVER_URL || 'wss://p2p.aeronyx.network';
  private connectionState: InternalConnectionStateType = InternalConnectionState.DISCONNECTED;
  private autoReconnect: boolean = true;
  private forceReconnect: boolean = false; // Flag to force reconnect attempt
  private stateTransitionLock: Promise<void> = Promise.resolve();
  private readonly isNodeEnvironment: boolean = typeof window === 'undefined';
  private readonly isBrowserEnvironment: boolean = typeof window !== 'undefined';
  private readonly hasWebCrypto: boolean = this.isBrowserEnvironment && !!window.crypto?.subtle;

  // --- Security & Session ---
  private sessionKey: Uint8Array | null = null; // Stores the DECRYPTED 32-byte session key
  private serverPublicKey: string | null = null; // Stores server's Ed25519 Pub Key (Base58) from Challenge
  private sessionId: string | null = null;
  private messageCounter: number = 0; // Counter for outgoing Data packets
  private processedMessageIds: Map<string, number> = new Map(); // Store message ID with timestamp for replay protection
  private keyRotationTimer: NodeJS.Timeout | null = null;
  private lastKeyRotation: number = 0; // Timestamp of last successful rotation

  // --- Reconnection ---
  private reconnectAttempts: number = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectionConfig: ReconnectionConfig = DEFAULT_RECONNECTION_CONFIG;

  // --- Keep-Alive & Timers ---
  private pingInterval: NodeJS.Timeout | null = null;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastMessageTime: number = Date.now();
  private connectionTimeout: NodeJS.Timeout | null = null;
  private pingTimeouts: Map<number, NodeJS.Timeout> = new Map(); // Track timeouts for specific pings
  private pingCounter: number = 0; // Dedicated counter for ping sequence
  private networkQuality: 'excellent' | 'good' | 'poor' | 'bad' = 'good';
  private lastNetworkQualityCheck: number = Date.now();
  private consecutiveFailedPings: number = 0;
  private readonly NETWORK_CHECK_INTERVAL_MS: number = 60000; // 1 minute

  // --- Message Queue & Processing ---
  private pendingMessages: Array<PendingMessage> = [];
  private maxQueueSize: number = MESSAGE_QUEUE_MAX_SIZE;
  private processingQueue: boolean = false; // Lock to prevent concurrent queue processing
  private currentBatchSize: number = DEFAULT_BATCH_SIZE; // Current batch size (adaptive)
  private adaptationFactor: number = 0.1; // How quickly to adapt batch size
  private usePriorityQueue: boolean = true; // Enable priority-based queue processing by default
  private latencyHistory: number[] = []; // Store recent latency measurements
  private maxLatencyHistory: number = 20; // Maximum size of latency history
  private readonly messageIdCacheMaxSize: number = MESSAGE_ID_CACHE_MAX_SIZE;
  private readonly messageIdCacheTTL: number = MESSAGE_ID_CACHE_TTL_MS;

  // --- Promise Management ---
  // Manages the promise returned by the public connect() method
  private connectionPromise: Promise<void> | null = null;
  private connectionResolve: (() => void) | null = null;
  private connectionReject: ((reason?: any) => void) | null = null;

  // --- Performance Management ---
  private worker: Worker | null = null; // Web Worker for crypto tasks
  private isWorkerAvailable: boolean = false; // Flag if worker is usable
  private readonly ERROR_CATEGORIES: Record<string, { retry: boolean, log: 'error' | 'warn' | 'info' }> = {
    CONNECTION: { retry: true, log: 'warn' },
    AUTH: { retry: true, log: 'error' },
    DATA: { retry: true, log: 'warn' },
    SIGNALING: { retry: true, log: 'warn' },
    SERVER: { retry: true, log: 'warn' },
    MESSAGE: { retry: false, log: 'error' },
    INTERNAL: { retry: true, log: 'error' },
    SECURITY: { retry: false, log: 'error' }
  };

  /**
   * Create a new AeroNyx socket
   * @param config Optional reconnection configuration
   */
  constructor(config?: Partial<ReconnectionConfig>) {
    super();
    this.reconnectionConfig = { ...DEFAULT_RECONNECTION_CONFIG, ...config };
    this.setMaxListeners(20); // Avoid potential memory leak warning

    // Initialize crypto worker (optional performance enhancement)
    // this.initCryptoWorker(); // Uncomment if implementing worker

    // Add necessary browser lifecycle listeners
    if (this.isBrowserEnvironment) {
      window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
      window.addEventListener('online', this.handleNetworkChange.bind(this));
      window.addEventListener('offline', this.handleNetworkChange.bind(this));
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
    console.log('[Socket] AeroNyx socket initialized.');
  }

  /**
   * Handle browser closing event - attempt graceful shutdown
   */
  private handleBeforeUnload(): void {
    console.debug('[Socket] Window beforeunload event detected');
    if (this.isConnected()) {
      try {
        // Quickly send disconnect without waiting for promise to resolve
        const disconnectMsg = formatDisconnectMessage(1000, "Browser page closed");
        this.socket?.send(JSON.stringify(disconnectMsg));
      } catch (e) {
        // Ignore errors during page unload
      }
    }
  }

  /**
   * Handle browser online/offline events
   */
  private handleNetworkChange(event: Event): void {
    const isOnline = event.type === 'online';
    console.debug(`[Socket] Network ${isOnline ? 'online' : 'offline'} event detected`);
    
    if (isOnline) {
      // If reconnection is enabled and we're not already connected, try to reconnect
      if (this.autoReconnect && 
         (this.connectionState === InternalConnectionState.DISCONNECTED ||
          this.connectionState === InternalConnectionState.RECONNECTING)) {
        this.scheduleReconnect();
      }
    } else {
      // If we're offline, check connection health which may trigger reconnection
      if (this.connectionState === InternalConnectionState.CONNECTED) {
        this.checkConnectionHealth();
      }
    }
  }

  /**
   * Handle browser visibility change events
   */
  private handleVisibilityChange(): void {
    const isVisible = document.visibilityState === 'visible';
    console.debug(`[Socket] Document visibility changed: ${isVisible ? 'visible' : 'hidden'}`);
    
    if (isVisible) {
      // When tab becomes visible, check connection health
      if (this.connectionState === InternalConnectionState.CONNECTED) {
        this.checkConnectionHealth();
      } else if (this.autoReconnect && 
                (this.connectionState === InternalConnectionState.DISCONNECTED || 
                 this.connectionState === InternalConnectionState.RECONNECTING)) {
        // Try reconnecting if not already connected
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Initialize crypto worker (Optional: for offloading heavy crypto)
   */
  private initCryptoWorker(): void {
    // Implementation depends on the worker script ('/workers/crypto-worker.js')
    // and the message passing protocol defined between the main thread and worker.
    if (typeof Worker !== 'undefined') {
      try {
        // Example: this.worker = new Worker('/workers/crypto-worker.js');
        // this.worker.onmessage = this.handleWorkerMessage.bind(this);
        // this.worker.onerror = ...
        // this.isWorkerAvailable = true;
        console.log('[Socket] Crypto worker initialization placeholder.');
      } catch (e) {
        console.warn('[Socket] Failed to initialize crypto worker:', e);
        this.isWorkerAvailable = false;
      }
    } else {
      console.warn('[Socket] Web Workers not supported.');
      this.isWorkerAvailable = false;
    }
  }

  /**
   * Handle messages received from the crypto worker
   */
  private handleWorkerMessage(event: MessageEvent): void {
    console.debug('[Socket] Received worker message:', event.data?.type);
    // Process results from worker (e.g., decryption result, signature result)
    // This would involve matching request IDs and resolving promises or emitting events.
  }

  /**
   * Create a standardized socket error object
   */
  private createSocketError(
    type: SocketError['type'],
    message: string,
    code: string,
    details?: string,
    retry: boolean = true,
    originalError?: any
  ): SocketError {
    return {
      type,
      message,
      code,
      details,
      retry,
      originalError
    };
  }

  /**
   * Securely wipe sensitive data from memory
   * @param data The data to wipe
   */
  private secureWipe(data: Uint8Array | null): void {
    if (!data) return;
    
    // Overwrite with random data
    if (this.hasWebCrypto) {
      window.crypto.getRandomValues(data);
    } else {
      // Fallback for environments without WebCrypto
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.floor(Math.random() * 256);
      }
    }
    
    // Overwrite with zeros
    for (let i = 0; i < data.length; i++) {
      data[i] = 0;
    }
  }

  // --- Public Methods ---

  public async sendWebRTCSignal(
    peerId: string, 
    signalType: 'offer' | 'answer' | 'candidate', 
    signalData: any
  ): Promise<SendResult> {
    const payload = {
      type: 'webrtc_signal', // Changed from webrtc-signal to match server expectation
      peerId: peerId,
      signalType: signalType,
      signalData: signalData,
      timestamp: Date.now()
    };
    
    // WebRTC signaling should be high priority
    return this.send(payload, MessagePriority.HIGH);
  }

  /**
   * Connects to the AeroNyx server. Manages concurrent calls and state.
   * @param chatId The ID of the chat room.
   * @param publicKey The client's Ed25519 public key (Base58).
   * @returns Promise resolving when authentication is complete (IpAssign received).
   * @throws Error if connection or authentication fails definitively.
   */
  public async connect(chatId: string, publicKey: string): Promise<void> {
    // 1. Handle already connected state
    if (this.connectionState === InternalConnectionState.CONNECTED && this.chatId === chatId && !this.forceReconnect) {
      console.log('[Socket] Already connected to this chat.');
      return Promise.resolve();
    }

    // 2. Handle concurrent connection attempts
    if (this.connectionState === InternalConnectionState.CONNECTING || this.connectionState === InternalConnectionState.AUTHENTICATING) {
      console.warn('[Socket] Connection attempt already in progress.');
      if (this.connectionPromise && this.chatId === chatId) {
        console.log('[Socket] Returning existing connection promise for the same chat.');
        return this.connectionPromise; // Return existing promise for the same target
      } else {
        // If trying to connect to a *different* chat while one is in progress, cancel the old one first.
        console.warn(`[Socket] Aborting previous connection attempt to ${this.chatId} to connect to ${chatId}.`);
        await this.disconnect(); // Abort previous attempt cleanly
      }
    }

    // 3. Initialize connection
    console.log(`[Socket] Attempting to connect to chat: ${chatId}`);
    this.chatId = chatId;
    this.publicKey = publicKey;
    await this.safeChangeState(InternalConnectionState.CONNECTING); // Set state before async ops
    this.forceReconnect = false;
    this.autoReconnect = true;
    this.reconnectAttempts = 0;
    this.emit('connectionStatus', 'connecting');

    // 4. Cleanup any previous connection remnants
    this.cleanupConnection(false); // Don't emit disconnect during explicit connect

    // 5. Create and manage the connection promise
    this.connectionPromise = new Promise<void>((resolve, reject) => {
      this.connectionResolve = resolve;
      this.connectionReject = reject;

      // 6. Initiate WebSocket connection within a try/catch
      try {
        const wsUrl = createWebSocketUrl(this.serverUrl, chatId);
        console.log(`[Socket] Connecting to WebSocket URL: ${wsUrl}`);
        this.socket = new WebSocket(wsUrl);
        this.setupSocketEventHandlers(); // Attach listeners
        this.startConnectionTimeout();    // Start timeout for the connection attempt
      } catch (error) {
        console.error('[Socket] Failed to create WebSocket instance:', error);
        this.safeChangeState(InternalConnectionState.DISCONNECTED); // Ensure state is correct
        this.clearConnectionTimeout();
        const initError = new Error(`WebSocket initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        this.emit('error', this.createSocketError('connection', 'Failed to initialize WebSocket', 'INIT_ERROR', undefined, false, error));
        this.rejectConnection(initError); // Reject the promise immediately
      }
    });

    return this.connectionPromise;
  }

  /**
   * Disconnects from the server gracefully.
   */
  public async disconnect(): Promise<void> {
    // Prevent disconnect loops or disconnecting if already disconnected/closing
    if (this.connectionState === InternalConnectionState.DISCONNECTED || this.connectionState === InternalConnectionState.CLOSING) {
        console.debug(`[Socket] Disconnect called but already in state: ${CONNECTION_STATE_NAMES[this.connectionState]}`);
        return Promise.resolve();
    }

    console.log('[Socket] Disconnecting...');
    this.autoReconnect = false; // Prevent auto-reconnect after explicit disconnect
    await this.safeChangeState(InternalConnectionState.CLOSING);

    // Attempt graceful shutdown
    if (this.socket && isSocketOpen(this.socket)) {
      try {
        // Optional: Send a disconnect message if protocol requires it
        const disconnectMsg = formatDisconnectMessage(1000, "Client initiated disconnect");
        this.socket.send(JSON.stringify(disconnectMsg));

        // Close the WebSocket
        this.socket.close(1000, "Client initiated disconnect");

        // Wait briefly for the close event to be processed by the browser
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (e) {
        console.warn('[Socket] Error sending disconnect message or closing socket:', e);
      }
    }

    // Perform final cleanup regardless of graceful close success
    this.cleanupConnection(true); // Perform full cleanup and emit events if needed
    await this.safeChangeState(InternalConnectionState.DISCONNECTED); // Ensure final state is DISCONNECTED
    console.log('[Socket] Disconnect process complete.');
  }

  /**
   * Checks if the socket is fully connected and authenticated.
   */
  public isConnected(): boolean {
    return this.connectionState === InternalConnectionState.CONNECTED &&
           this.socket !== null &&
           isSocketOpen(this.socket) &&
           this.sessionKey !== null;
  }

  /**
   * Cleans up all timers, socket listeners, and resets state variables.
   */
  private cleanupConnection(emitEvents: boolean = true): void {
    const wasConnected = this.connectionState === InternalConnectionState.CONNECTED;
    
    console.debug('[Socket] Cleaning up connection resources...');
    
    // 1. Clear all timers
    this.clearConnectionTimeout();
    this.stopKeepAliveServices();
    this.stopKeyRotationTimer();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // 2. Clean up socket
    if (this.socket) {
      // Remove all event listeners
      this.socket.onopen = null;
      this.socket.onclose = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      
      // Close if still open
      if (isSocketOpen(this.socket)) {
        try {
          this.socket.close(1000, "Client cleanup");
        } catch (e) {
          console.warn("[Socket] Error closing WebSocket during cleanup:", e);
        }
      }
      
      this.socket = null;
    }
    
    // 3. Reset state variables
    this.sessionKey = null; // Clear sensitive data
    this.serverPublicKey = null;
    this.sessionId = null;
    this.messageCounter = 0;
    this.processedMessageIds.clear();
    this.processingQueue = false;
  
    // 4. Reset connection promise state if connection failed/closed prematurely
    if (this.connectionState === InternalConnectionState.CONNECTING || this.connectionState === InternalConnectionState.AUTHENTICATING) {
      this.rejectConnection(new Error("Connection closed during setup"));
    } else {
      // Clear promise handlers if disconnected after successful connection or during closing
      this.connectionPromise = null;
      this.connectionResolve = null;
      this.connectionReject = null;
    }
  
    // 5. Emit events if needed (usually only if previously connected)
    if (emitEvents && wasConnected) {
      console.log("[Socket] Emitting 'disconnected' status due to cleanup after being connected.");
      this.emit('connectionStatus', 'disconnected');
      this.emit('disconnected', 1000, "Client cleanup"); // Emit generic code
    }
  
    // 6. Ensure final state is DISCONNECTED unless explicitly closing
    if (this.connectionState !== InternalConnectionState.CLOSING) {
      this.safeChangeState(InternalConnectionState.DISCONNECTED);
    }
  
    console.debug('[Socket] Connection cleanup complete.');
  }

  /**
   * Gets the current user-facing connection status.
   */
  public getConnectionStatus(): ConnectionStatus {
    switch (this.connectionState) {
      case InternalConnectionState.CONNECTED:
        return 'connected';
      case InternalConnectionState.CONNECTING:
      case InternalConnectionState.AUTHENTICATING:
        return 'connecting';
      case InternalConnectionState.RECONNECTING:
        return 'reconnecting';
      case InternalConnectionState.DISCONNECTED:
      case InternalConnectionState.CLOSING:
      default:
        return 'disconnected';
    }
  }
  private mapMessageStatus(status: any): string {
    // Add appropriate status mapping logic here
    // This is a simple example - adjust based on your actual status values
    if (!status) return 'unknown';
    
    // Check if status is already a string
    if (typeof status === 'string') return status;
    
    // If status is a custom type or object, map it appropriately
    // Example: if status is a numeric enum or object with a status property
    return String(status); // Basic fallback
  }
  /**
 * Sends a chat message. Wraps the message data and calls `send`.
 * @param message The message object conforming to MessageType.
 * @returns Promise resolving to SendResult.
 */
public async sendMessage(message: MessageType): Promise<SendResult> {
    // Step 1: Validate input parameters
    if (!message || !message.id || typeof message.content !== 'string') {
      console.error('[Socket:SEND] Invalid message format:', message);
      return SendResult.FAILED;
    }
    
    // Step 2: Log diagnostic information
    console.debug('[Socket] Preparing to send chat message:', message.id);
    
    // Step 3: Construct standardized message payload
    const messagePayload = {
      type: 'message',          // Application-level type identifier
      id: message.id,           // Unique message identifier
      content: message.content, // Actual message content
      senderId: message.senderId || this.localPeerId || '',  // Sender identifier
      senderName: message.senderName || 'Anonymous',         // Sender display name
      
      // According to your MessageType interface, timestamp is a string, so we handle it as such
      timestamp: typeof message.timestamp === 'string' 
        ? message.timestamp 
        : new Date().toISOString(),
        
      isEncrypted: message.isEncrypted ?? true,  // Encryption flag
      status: message.status || 'sending'  // Use default if not provided
    };
    
    // Step 4: Send with high priority to ensure prompt delivery
    try {
      return await this.send(messagePayload, MessagePriority.HIGH);
    } catch (error) {
      // Step 5: Comprehensive error handling
      console.error('[Socket:SEND] Error sending message:', error);
      this.emit('error', this.createSocketError(
        'message',
        'Failed to send chat message',
        'MSG_SEND_ERROR',
        error instanceof Error ? error.message : String(error),
        true // Usually retryable
      ));
      return SendResult.FAILED;
    }
  }

   /**
   * Requests chat information from the server.
   * @returns Promise resolving to SendResult.
   */
   public async requestChatInfo(): Promise<SendResult> {
        console.debug('[Socket] Requesting chat info...');
    return this.send({ type: 'chat_info_request' }, MessagePriority.NORMAL); // Changed from request-chat-info
  }

    /**
     * Requests the current list of participants from the server.
     * @returns Promise resolving to SendResult.
     */
    public async requestParticipants(): Promise<SendResult> {
        console.debug('[Socket] Requesting participants list...');
        return this.send({ type: 'participants_request' }, MessagePriority.NORMAL); // Changed from request-participants
    }

    /**
     * Sends a request to leave the chat room.
     * @returns Promise resolving when the leave action is initiated.
     */
    public async leaveChat(): Promise<void> {
        console.log('[Socket] Initiating leave chat...');
        this.autoReconnect = false; // Prevent reconnect after leaving
        // Send a specific 'leave-chat' message if the protocol requires it
        await this.send({ type: 'leave-chat' }, MessagePriority.CRITICAL);
        // Allow time for the message to potentially be sent before closing
        await new Promise(resolve => setTimeout(resolve, 200));
        return this.disconnect(); // Disconnect gracefully
    }

    /**
     * Sends a request to delete the chat room (requires appropriate permissions).
     * @returns Promise resolving to SendResult.
     */
    public async deleteChat(): Promise<SendResult> {
        console.debug('[Socket] Requesting chat deletion...');
        return this.send({ type: 'delete-chat' }, MessagePriority.CRITICAL);
    }

    /**
     * Sends a WebRTC signaling message to facilitate peer connection
     * @param peerId Target peer ID
     * @param signalType Type of signal (offer, answer, candidate)
     * @param signalData The actual signal data
     */
    public async send(data: any, priority: MessagePriority = MessagePriority.NORMAL): Promise<SendResult> {
      if (!this.isConnected()) {
        console.warn('[Socket:SEND] Not connected. Queuing message.');
        const queued = this.queueMessage('data', data, priority);
        setTimeout(() => this.processPendingMessages(), BATCH_PROCESS_DELAY_MS * 2);
        return queued ? SendResult.QUEUED : SendResult.FAILED;
      }
    
      // Ensure session key exists
      if (!this.sessionKey) {
        console.error('[Socket:SEND] CRITICAL: isConnected is true but sessionKey is null!');
        this.emit('error', this.createSocketError('internal', 'Session key missing despite connected state', 'MISSING_SESSION_KEY', undefined, false));
        const queued = this.queueMessage('data', data, priority);
        return queued ? SendResult.QUEUED : SendResult.FAILED;
      }
    
      try {
        // Wrap the data in a DataEnvelope with the server-expected field name
        const envelope = {
          payload_type: 'Json', // Changed from payloadType to payload_type
          payload: data
        };
    
        // Create the encrypted Data packet
        const dataPacket = await createEncryptedDataPacket(
          envelope,
          this.sessionKey,
          this.messageCounter
        );
    
        // Increment the counter after successfully creating the packet
        this.messageCounter++;
    
        // Send the JSON stringified packet
        const packetJson = JSON.stringify(dataPacket);
        this.socket!.send(packetJson);
        console.debug('[Socket:SEND] Encrypted Data packet sent. Counter:', dataPacket.counter);
        this.lastMessageTime = Date.now();
        return SendResult.SENT;
      } catch (error) {
        console.error('[Socket:SEND] Error encrypting or sending data packet:', error);
        const queued = this.queueMessage('data', data, priority);
        this.emit('error', this.createSocketError(
          'data',
          'Failed to send encrypted data',
          'DATA_SEND_ERROR',
          error instanceof Error ? error.message : String(error),
          true
        ));
        return queued ? SendResult.QUEUED : SendResult.FAILED;
      }
    }

    /**
     * Trigger a manual session key rotation
     * @returns Promise resolving to true if rotation initiated successfully.
     */
    public async rotateSessionKey(): Promise<boolean> {
       if (!this.isConnected()) {
           console.warn('[Socket] Cannot rotate session key: Not connected.');
           return false;
       }
        if (!this.sessionKey || !this.serverPublicKey) {
            console.warn('[Socket] Cannot rotate session key: Missing current session or server key.');
            return false;
        }

       console.log('[Socket] Initiating manual session key rotation...');
       try {
           const rotationRequestPayload = {
               type: 'request-key-rotation',
               // Include any necessary data, e.g., current session ID
               sessionId: this.sessionId,
               timestamp: Date.now()
           };
           // Key rotation is critical
           const result = await this.send(rotationRequestPayload, MessagePriority.CRITICAL);
           if (result === SendResult.SENT || result === SendResult.QUEUED) {
               console.log("[Socket] Key rotation request sent/queued.");
               // The actual key update happens in handleKeyRotationResponse
               return true;
           } else {
               console.error("[Socket] Failed to send key rotation request.");
               return false;
           }
       } catch (error) {
           console.error('[Socket] Error initiating key rotation:', error);
            this.emit('error', this.createSocketError(
              'security',
              'Failed to initiate key rotation',
              'KEY_ROTATION_INIT_ERROR',
               error instanceof Error ? error.message : String(error),
              false
            ));
           return false;
       }
    }

    /**
     * Returns a testing interface (only in non-production environments)
     */
    public getTestingInterface(): AeroNyxSocketTestingInterface | null {
      // Only provide the interface in development/test environments
      if (process.env.NODE_ENV === 'production') {
        return null;
      }
      
      return {
        getState: () => CONNECTION_STATE_NAMES[this.connectionState],
        simulateServerMessage: async (message) => {
          await this.processMessage(message);
        },
        getQueueInfo: () => ({ 
          size: this.pendingMessages.length, 
          processing: this.processingQueue 
        }),
        getNetworkQuality: () => this.networkQuality,
        getSessionInfo: () => ({
          hasSessionKey: !!this.sessionKey,
          sessionId: this.sessionId,
          lastKeyRotation: this.lastKeyRotation,
          messageCounter: this.messageCounter
        }),
        clearQueue: () => {
          this.pendingMessages = [];
          return true;
        }
      };
    }

  // --- Private Methods ---

  /**
   * Sets up WebSocket event handlers.
   */
  private setupSocketEventHandlers(): void {
    if (!this.socket) return;
    // Assign bound methods to prevent 'this' context issues
    this.socket.onopen = this.handleSocketOpen.bind(this);
    this.socket.onmessage = this.handleSocketMessage.bind(this);
    this.socket.onclose = this.handleSocketClose.bind(this);
    this.socket.onerror = this.handleSocketError.bind(this);
  }

  /**
   * Handles WebSocket open event. Changes state and sends Auth message.
   */
  private handleSocketOpen(): void {
      this.clearConnectionTimeout(); // Connection successful, clear timeout
      console.log('[Socket] WebSocket connection opened. Sending Auth...');
      this.safeChangeState(InternalConnectionState.AUTHENTICATING); // Move to authenticating state
      this.sendAuthMessage();
    }
  
    /**
     * Sends the initial Auth message to start authentication flow
     */
    private sendAuthMessage(): void {
      if (!this.socket || !isSocketOpen(this.socket)) {
        console.error('[Socket] Cannot send Auth: Socket not open');
        this.rejectConnection(new Error('Socket closed before Auth could be sent'));
        return;
      }
    
      try {
        if (!this.chatId || !this.publicKey) {
          throw new Error('Missing chatId or publicKey for Auth');
        }
    
        // Generate a string nonce using timestamp and random value
        const nonceString = `${Date.now()}-${Math.random().toString(16).substring(2)}`;
    
        // Create AuthMessage with the CORRECT fields according to server expectations
        const authMessage: AuthMessage = {
          type: 'Auth',
          public_key: this.publicKey,
          version: '1.0.0',    // Client version string
          features: ['aes256gcm', 'webrtc', 'key-rotation'], // Client capabilities
          encryption_algorithm: 'aes256gcm',
          nonce: nonceString   // String nonce as now required by the interface
        };
        console.log('[Socket] Auth message to be sent:', JSON.stringify(authMessage));
        // Log the message for debugging
        console.log('[Socket] Sending Auth message:', JSON.stringify(authMessage));
    
        this.socket.send(JSON.stringify(authMessage));
        console.log('[Socket] Auth message sent successfully');
      } catch (error) {
        console.error('[Socket] Error sending Auth message:', error);
        this.emit('error', this.createSocketError(
          'auth',
          'Failed to send Auth message',
          'AUTH_SEND_ERROR',
          error instanceof Error ? error.message : String(error),
          true
        ));
        this.rejectConnection(error);
        // Ensure we disconnect properly after auth failure
        this.disconnect().catch(e => console.error("Error during disconnect after auth failure:", e));
      }
    }
  /**
   * Handles WebSocket message event. Parses, processes, and updates activity time.
   */
  private async handleSocketMessage(event: MessageEvent): Promise<void> {
    this.lastMessageTime = Date.now(); // Update activity timer on any message
    this.clearConnectionTimeout(); // Clear connection timeout if still pending

    try {
      const message = JSON.parse(event.data as string); // Assuming text frames
      await this.processMessage(message); // Process the parsed message
    } catch (error) {
      console.error('[Socket] Error parsing or processing message:', error);
      this.emit('error', this.createSocketError(
        'message',
        'Failed to parse server message',
        'PARSE_ERROR',
         undefined,
        false, // Parsing errors usually mean corrupted data, not retryable
        error
      ));
      // Consider disconnecting if parsing fails repeatedly?
    }
  }

  /**
   * Handles WebSocket close event. Cleans up, updates state, and handles reconnection.
   */
  private handleSocketClose(event: CloseEvent): void {
    this.clearConnectionTimeout(); // Ensure timeout is cleared
    console.log(`[Socket] WebSocket connection closed: Code=${event.code}, Reason=${event.reason}`);

    const previousState = this.connectionState;
    this.cleanupConnection(false); // Clean up resources without emitting extra events yet

    // Reject connection promise if closed during connection/auth phase
    if (previousState === InternalConnectionState.CONNECTING || previousState === InternalConnectionState.AUTHENTICATING) {
      console.error('[Socket] Connection closed during handshake.');
      this.emit('error', this.createSocketError(
        'connection',
        'Connection closed during setup',
        `WS_CLOSE_${event.code}`,
         event.reason,
        true // Usually retryable
      ));
      this.rejectConnection(new Error(`Connection closed during handshake: ${event.code} ${event.reason}`));
    } else if (previousState === InternalConnectionState.CONNECTED) {
      // If we were previously connected, emit standard disconnect events
      this.emit('connectionStatus', 'disconnected');
      this.emit('disconnected', event.code, event.reason);
    }

    // Final state update
    this.safeChangeState(InternalConnectionState.DISCONNECTED);

    // Handle reconnection logic
    if (this.autoReconnect && shouldAttemptReconnect(event.code) && canRetry(this.reconnectAttempts, this.reconnectionConfig.maxAttempts)) {
      this.scheduleReconnect();
    } else if (this.autoReconnect && !canRetry(this.reconnectAttempts, this.reconnectionConfig.maxAttempts)) {
      console.log("[Socket] Max reconnection attempts reached.");
      this.emit('error', this.createSocketError('connection', 'Max reconnection attempts reached', 'MAX_RECONNECT', undefined, false));
      this.autoReconnect = false; // Stop trying
    } else if (!shouldAttemptReconnect(event.code)) {
        console.log(`[Socket] WebSocket closed with code ${event.code}. Reconnection not appropriate.`);
        this.autoReconnect = false; // Stop trying for non-retryable close codes
    }
  }

  /**
   * Handles WebSocket error event. Emits error and relies on onclose for cleanup.
   */
  private handleSocketError(event: Event): void {
    this.clearConnectionTimeout(); // Ensure timeout is cleared
    console.error('[Socket] WebSocket error:', event);
    const errorMsg = 'WebSocket connection error occurred.';

    // Emit a generic connection error
    this.emit('error', this.createSocketError(
      'connection',
      errorMsg,
      'WS_ERROR',
       undefined,
      true, // Assume potentially retryable unless onclose gives a specific code
      event
    ));

    // If the error occurred during connection/auth, reject the promise
    if (this.connectionState === InternalConnectionState.CONNECTING || this.connectionState === InternalConnectionState.AUTHENTICATING) {
      this.rejectConnection(new Error(errorMsg));
      // Note: cleanupConnection and state change will be handled by the subsequent 'onclose' event
    } else {
        // If error on established connection, trigger health check which might lead to reconnect
        this.checkConnectionHealth();
    }
  }

  /**
   * Processes incoming messages based on their 'type' field.
   * @param message Parsed message object.
   */
  private async processMessage(message: any): Promise<void> {
    // Basic validation
    if (!message || typeof message.type !== 'string') {
      console.warn('[Socket] Received message without valid type:', message);
      return;
    }

    console.debug(`[Socket] Processing message type: ${message.type}`);

    try {
      switch (message.type) {
        case 'Challenge':
          // Ensure we are in the right state to process a challenge
          if (this.connectionState !== InternalConnectionState.AUTHENTICATING) {
              console.warn(`[Socket] Received Challenge in unexpected state: ${CONNECTION_STATE_NAMES[this.connectionState]}`);
              return;
          }
          await this.handleChallenge(message as ChallengeMessage);
          break;

        case 'IpAssign':
           // Ensure we are in the right state
           if (this.connectionState !== InternalConnectionState.AUTHENTICATING) {
              console.warn(`[Socket] Received IpAssign in unexpected state: ${CONNECTION_STATE_NAMES[this.connectionState]}`);
              return;
          }
          await this.handleIpAssign(message as IpAssignMessage);
          break;

        case 'Data':
           // Should only process Data if fully connected
           if (this.connectionState !== InternalConnectionState.CONNECTED) {
               console.warn(`[Socket] Received Data packet in non-connected state: ${CONNECTION_STATE_NAMES[this.connectionState]}`);
               return;
           }
          await this.handleDataPacket(message);
          break;

        case 'Ping':
          this.handlePing(message as PingMessage);
          break;

        case 'Pong':
          this.handlePong(message as PongMessage);
          break;

        case 'Error':
          this.handleError(message as ErrorMessage); // Pass reject? No, handleError decides based on state/code
          break;

        case 'Disconnect':
          this.handleDisconnect(message as DisconnectMessage); // Pass reject? No, handleDisconnect decides
          break;

        // Key Rotation handling
        case 'KeyRotationRequest':
             if (this.connectionState !== InternalConnectionState.CONNECTED) return;
             await this.handleKeyRotationRequest(message);
             break;
        case 'KeyRotationResponse':
             if (this.connectionState !== InternalConnectionState.CONNECTED) return;
             await this.handleKeyRotationResponse(message);
             break;

        default:
          console.warn(`[Socket] Received unknown message type: ${message.type}`, message);
          this.emit('data', message); // Emit generic data event for application layer
      }
    } catch (error) {
      // Catch errors from handlers themselves (should ideally be handled within)
      console.error(`[Socket] Uncaught error processing message type ${message.type}:`, error);
       this.emit('error', this.createSocketError(
           'message',
           `Error processing ${message.type}`,
           'PROCESS_MSG_ERROR',
            error instanceof Error ? error.message : String(error),
           false, // Uncaught errors are usually not retryable
           error
       ));
       // If an error occurs during connection/auth phase, reject the main promise
       if (this.connectionState === InternalConnectionState.CONNECTING || this.connectionState === InternalConnectionState.AUTHENTICATING) {
           this.rejectConnection(error);
           await this.disconnect(); // Ensure cleanup on critical processing error during setup
       }
    }
  }

  /**
   * Handles the authentication Challenge message.
   * @param message Parsed Challenge message.
   */
  private async handleChallenge(message: ChallengeMessage): Promise<void> {
    console.log('[Socket] Received Challenge, ID:', message.id);
    try {
      // 1. Validate state and message
      if (this.connectionState !== InternalConnectionState.AUTHENTICATING) throw new Error("Not in authenticating state.");
      if (!message.server_key) throw new Error('Server public key missing in Challenge');
      this.serverPublicKey = message.server_key;
      console.log('[Socket] Stored server Ed25519 public key (Base58):', this.serverPublicKey.substring(0, 10) + '...');

      if (!this.publicKey) throw new Error('Client public key not set');

      // 2. Parse challenge data
      const challengeBytes: Uint8Array = parseChallengeData(message.data);
      if (challengeBytes.length === 0) throw new Error('Empty challenge data');
      console.log('[Socket] Challenge data parsed, length:', challengeBytes.length);

      // 3. Get client secret key securely
      const keypair = await getStoredKeypair(); // Assumes secure retrieval
      if (!keypair) throw new Error('Client keypair not found');
      const clientSecretKeyBytes = typeof keypair.secretKey === 'string' 
        ? bs58.decode(keypair.secretKey) 
        : keypair.secretKey;
      if (clientSecretKeyBytes.length !== 64) throw new Error('Invalid client secret key length');

      // 4. Sign challenge
      console.log('[Socket] Signing challenge...');
      const signature: string = signChallenge(challengeBytes, clientSecretKeyBytes);
      console.log('[Socket] Signature generated (Base58):', signature.substring(0, 10) + '...');

      // 5. Construct and send response
      const response: ChallengeResponse = {
        type: 'ChallengeResponse',
        challenge_id: message.id,
        public_key: this.publicKey,
        signature: signature,
      };
      if (this.socket && isSocketOpen(this.socket)) {
        this.socket.send(JSON.stringify(response));
        console.log('[Socket] Challenge response sent successfully');
      } else {
        throw new Error('Socket closed before challenge response could be sent');
      }
    } catch (error) {
      console.error('[Socket] Error handling challenge:', error);
      this.emit('error', this.createSocketError('auth','Failed to process challenge','CHALLENGE_PROCESS_ERROR', error instanceof Error ? error.message : String(error),true));
      this.rejectConnection(error); // Reject connect promise on challenge failure
      await this.disconnect(); // Disconnect fully
    }
  }

  /**
   * Handles the IpAssign message, decrypts session key, completes connection.
   * @param message Parsed IpAssign message.
   */
  private async handleIpAssign(message: IpAssignMessage): Promise<void> {
    console.log(`[Socket] Received IpAssign. Session ID: ${message.session_id}`);
    try {
      // 1. Validate state and message
      if (this.connectionState !== InternalConnectionState.AUTHENTICATING) {
        throw new Error("Not in authenticating state.");
      }
      
      if (message.encryption_algorithm !== 'aes256gcm') {
        throw new Error(`Unsupported encryption algorithm: ${message.encryption_algorithm}`);
      }
      
      if (!message.encrypted_session_key || !message.key_nonce) {
        throw new Error('Missing encrypted_session_key or key_nonce');
      }
      
      if (!this.serverPublicKey) {
        throw new Error('Server public key missing from previous step');
      }
      
      console.debug('[IpAssign] Prerequisites met.');
      console.debug('[IpAssign] Server Public Key:', 
        this.serverPublicKey ? 
        `${this.serverPublicKey.substring(0, 8)}... (${this.serverPublicKey.length} chars)` : 
        'null');
  
      // 2. Get client secret key securely
      const keypair = await getStoredKeypair();
      if (!keypair) {
        throw new Error('Client keypair not found');
      }
      
      // Handle string or Uint8Array type correctly
      let clientEdSecretKeyBytes: Uint8Array;
      if (typeof keypair.secretKey === 'string') {
        clientEdSecretKeyBytes = bs58.decode(keypair.secretKey);
      } else {
        clientEdSecretKeyBytes = keypair.secretKey;
      }
        
      if (clientEdSecretKeyBytes.length !== 64) {
        throw new Error(`Invalid client secret key length: ${clientEdSecretKeyBytes.length}, expected 64 bytes`);
      }
      
      console.debug('[IpAssign] Client keypair loaded successfully.');
  
      // 3. Decode server public key
      let serverEdPublicKeyBytes: Uint8Array;
      try {
        serverEdPublicKeyBytes = bs58.decode(this.serverPublicKey);
      } catch (decodeError) {
        throw new Error(`Failed to decode server public key: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}`);
      }
      
      if (serverEdPublicKeyBytes.length !== 32) {
        throw new Error(`Invalid server public key length: ${serverEdPublicKeyBytes.length}, expected 32 bytes`);
      }
      
      // Use safe hex conversion without relying on Buffer
      const serverKeyPrefix = Array.from(serverEdPublicKeyBytes.slice(0, 4))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      console.debug(`[IpAssign] Server public key decoded successfully: ${serverKeyPrefix}...`);
  
      // 4. Convert keys (Ensure utils match server exactly)
      console.debug('[IpAssign] Converting keys for ECDH...');
      const clientCurveSecretKey = convertEd25519SecretKeyToCurve25519(clientEdSecretKeyBytes);
      const serverCurvePublicKey = convertEd25519PublicKeyToCurve25519(serverEdPublicKeyBytes);
      
      if (!clientCurveSecretKey || !serverCurvePublicKey) {
        throw new Error('Key conversion failed');
      }
      
      // Safe hex conversion without Buffer
      const clientKeyPrefix = Array.from(clientCurveSecretKey.slice(0, 4))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const serverCurveKeyPrefix = Array.from(serverCurvePublicKey.slice(0, 4))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
        
      console.debug(`[IpAssign] Keys converted successfully: Client curve key prefix: ${clientKeyPrefix}..., Server curve key prefix: ${serverCurveKeyPrefix}...`);
  
      // 5. Derive RAW shared secret (ECDH)
      console.debug('[IpAssign] Deriving raw ECDH shared secret...');
      const rawSharedSecret = deriveECDHRawSharedSecret(clientCurveSecretKey, serverCurvePublicKey);
      
      if (!rawSharedSecret) {
        throw new Error('ECDH derivation failed');
      }
      
      if (rawSharedSecret.length !== 32) {
        throw new Error(`ECDH returned invalid length: ${rawSharedSecret.length}, expected 32 bytes`);
      }
      
      // Safe hex conversion
      const rawSecretPrefix = Array.from(rawSharedSecret.slice(0, 4))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      console.debug(`[IpAssign] Raw shared secret derived successfully: Length: ${rawSharedSecret.length} bytes, First 4 bytes: ${rawSecretPrefix}...`);
  
      // 6. Derive FINAL shared secret (HKDF - used for session key decryption ONLY)
      console.debug('[IpAssign] Deriving final shared secret via HKDF...');
      const finalSharedSecret = await deriveKeyWithHKDF(rawSharedSecret);
      
      if (!finalSharedSecret) {
        throw new Error('HKDF derivation failed');
      }
      
      if (finalSharedSecret.length !== 32) {
        throw new Error(`HKDF returned invalid length: ${finalSharedSecret.length}, expected 32 bytes`);
      }
      
      // Safe hex conversion
      const finalSecretPrefix = Array.from(finalSharedSecret.slice(0, 4))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      console.debug(`[IpAssign] Final shared secret derived successfully: Length: ${finalSharedSecret.length} bytes, First 4 bytes: ${finalSecretPrefix}...`);
  
      // 7. Prepare received data for decryption
      const encryptedSessionKeyBytes = numberArrayToUint8Array(message.encrypted_session_key);
      const keyNonceBytes = numberArrayToUint8Array(message.key_nonce);
      
      // The encrypted key length can vary but should be at least 32 bytes (key) + some tag size
      if (encryptedSessionKeyBytes.length < 32) {
        throw new Error(`Invalid encrypted session key length: ${encryptedSessionKeyBytes.length}, expected at least 32 bytes`);
      }
      
      if (keyNonceBytes.length !== 12) {
        throw new Error(`Invalid nonce length: ${keyNonceBytes.length}, expected 12 bytes`);
      }
      
      // Safe hex conversion for nonce
      const nonceHex = Array.from(keyNonceBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      console.debug(`[IpAssign] Preparing to decrypt session key: Encrypted key length: ${encryptedSessionKeyBytes.length} bytes, Nonce: ${nonceHex}`);
  
      // 8. Decrypt the ACTUAL session key
      console.debug('[IpAssign] Beginning decryption of session key...');
      let decryptedSessionKey: Uint8Array | null = null;
      
      try {
        const result = await decryptWithAesGcm(
          encryptedSessionKeyBytes,
          keyNonceBytes,
          finalSharedSecret,
          'binary'
        );
        
        // Ensure we have a Uint8Array result
        if (!(result instanceof Uint8Array)) {
          throw new Error('Decryption returned non-binary result');
        }
        
        decryptedSessionKey = result;
        console.debug('[IpAssign] Session key decrypted successfully.');
      } catch (decryptError) {
        console.error('[IpAssign] Session key decryption failed:', decryptError);
        throw new Error(`Session key decryption failed: ${decryptError instanceof Error ? decryptError.message : String(decryptError)}`);
      }
  
      // 9. Validate and Store the DECRYPTED Session Key
      if (!decryptedSessionKey) {
        throw new Error('Decryption returned null');
      }
      
      if (decryptedSessionKey.length !== 32) {
        throw new Error(`Decrypted session key has invalid length: ${decryptedSessionKey.length}, expected 32 bytes`);
      }
      
      this.sessionKey = decryptedSessionKey;
      this.sessionId = message.session_id;
      this.messageCounter = 0; // Reset counter for new session
      this.processedMessageIds.clear(); // Clear replay cache for new session
      this.lastKeyRotation = Date.now(); // Mark initial key time
      
      console.log('[Socket] Session key decrypted and stored successfully.');
      
      // Safe hex conversion for session key prefix
      const sessionKeyPrefix = Array.from(this.sessionKey.slice(0, 4))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      console.debug(`[IpAssign] Session key details: Length: ${this.sessionKey.length} bytes, First 4 bytes: ${sessionKeyPrefix}...`);
  
      // 10. Finalize Connection
      await this.safeChangeState(InternalConnectionState.CONNECTED);
      this.emit('connectionStatus', 'connected');
      this.startKeepAliveServices(); // Start ping, heartbeat, etc.
      this.startKeyRotationTimer();  // Start periodic key rotation check
      this.processPendingMessages(); // Send any queued messages
      this.emit('connected', { ip: message.ip_address, sessionId: message.session_id });
      this.resolveConnection(); // Resolve the main connect() promise
  
      // 11. Compatibility Test (Run async, don't block connection)
      console.debug('[IpAssign] Starting encryption compatibility test...');
      testEncryptionCompat(this.sessionKey)
        .then(compatTestPassed => {
          if (!compatTestPassed) {
            console.error("[Socket] CRITICAL: Local encryption compatibility test FAILED!");
            this.emit('error', this.createSocketError(
              'auth',
              'Encryption test failed',
              'ENCRYPTION_TEST_FAILED',
              undefined,
              false
            ));
            this.disconnect().catch(e => console.error("Error during disconnect after encryption test failure:", e));
          } else {
            console.log("[Socket] Local encryption compatibility test PASSED.");
          }
        })
        .catch(testError => {
          console.error("[Socket] Encryption compatibility test threw an error:", testError);
          this.emit('error', this.createSocketError(
            'auth',
            'Encryption test error',
            'ENCRYPTION_TEST_ERROR', 
            testError instanceof Error ? testError.message : String(testError), 
            false
          ));
          this.disconnect().catch(e => console.error("Error during disconnect after encryption test error:", e));
        });
  
    } catch (error) {
      // Thorough error reporting
      console.error('[Socket] Error handling IpAssign:', error);
      if (error instanceof Error) {
        console.error(`  Error type: ${error.name}`);
        console.error(`  Message: ${error.message}`);
        console.error(`  Stack: ${error.stack}`);
      }
      
      this.emit('error', this.createSocketError(
        'auth',
        'Failed to establish secure session',
        'IPASSIGN_PROCESS_ERROR',
        error instanceof Error ? error.message : String(error),
        true
      ));
      
      // Clear potentially bad key
      if (this.sessionKey) {
        this.secureWipe(this.sessionKey);
        this.sessionKey = null;
      }
      
      this.rejectConnection(error); // Reject connect promise
      
      // Ensure disconnect is called outside the catch block
      await this.disconnect().catch(disconnectError => {
        console.error("[Socket] Error during disconnect after IpAssign failure:", disconnectError);
      });
    }
  }

  /**
   * Handles incoming encrypted data packets
   * @param message The encrypted Data packet
   */
  private async handleDataPacket(message: any): Promise<void> {
    try {
      // Ensure we have a session key to decrypt the data
      if (!this.sessionKey) {
        throw new Error('Cannot decrypt Data packet: Session key is missing');
      }
    
      // Process the encrypted data packet through our crypto utils
      const decryptedData = await processEncryptedDataPacket(message, this.sessionKey);
      
      // Validate counter to prevent replay attacks
      if (message.counter !== undefined && typeof message.counter === 'number') {
        // Additional counter-based replay protection could be implemented here
      }
    
      // Check for replay using message ID cache
      if (this.shouldPreventReplay(decryptedData)) {
        return; // Skip processing if message is a replay
      }
    
      // Process the decrypted data based on the envelope format
      if (decryptedData && typeof decryptedData === 'object') {
        console.debug('[Socket] Decrypted data format:', 
          decryptedData.payload_type ? 'server-style (payload_type)' : 
          decryptedData.payloadType ? 'client-style (payloadType)' : 'direct message');
        
        // Handle server format with payload_type
        if (decryptedData.payload_type === 'Json' && decryptedData.payload) {
          await this.routeDecryptedMessage(decryptedData.payload);
        } 
        // Handle client format with payloadType (legacy support)
        else if (decryptedData.payloadType === 'json' && decryptedData.payload) {
          await this.routeDecryptedMessage(decryptedData.payload);
        } 
        // Try to process as direct message without envelope
        else {
          await this.routeDecryptedMessage(decryptedData);
        }
      } else {
        console.warn('[Socket] Received invalid decrypted data structure');
      }
    } catch (error) {
      console.error('[Socket] Error processing Data packet:', error);
      this.emit('error', this.createSocketError(
        'data',
        'Failed to process encrypted data packet',
        'DATA_PROCESS_ERROR',
        error instanceof Error ? error.message : String(error),
        false,
        error
      ));
    }
  }
  
  // Add this missing method referenced above
  private recordError(): void {
    this.consecutiveFailedPings++;
    // Consider implementing more sophisticated error tracking here
  }
      
  // Extract replay protection to a separate method for clarity
  private shouldPreventReplay(decryptedData: any): boolean {
    if (decryptedData.id && typeof decryptedData.id === 'string') {
      if (this.processedMessageIds.has(decryptedData.id)) {
        console.warn(`[Socket] Replay detected for message ID: ${decryptedData.id}. Ignoring.`);
        return true;
      }
      this.processedMessageIds.set(decryptedData.id, Date.now());
      this.cleanupMessageIdCache(); // Clean up old entries
    }
    return false;
  }

  // Extract message routing to a separate method
  private async routeDecryptedMessage(decryptedData: any): Promise<void> {
    if (isMessageType(decryptedData)) {
      this.emit('message', decryptedData);
    } else if (isChatInfoPayload(decryptedData)) {
      this.emit('chatInfo', decryptedData.data);
    } else if (isParticipantsPayload(decryptedData)) {
      this.emit('participants', decryptedData.data);
    } else if (isWebRTCSignalPayload(decryptedData)) {
      this.emit('webrtcSignal', decryptedData);
    } else if (isKeyRotationRequestPayload(decryptedData)) {
      await this.handleKeyRotationRequest(decryptedData);
    } else if (isKeyRotationResponsePayload(decryptedData)) {
      await this.handleKeyRotationResponse(decryptedData);
    } else if (decryptedData && decryptedData.type === 'chat_info_response') {
      // Handle chat info response from server
      this.emit('chatInfo', decryptedData.data || decryptedData);
    } else if (decryptedData && decryptedData.type === 'participants_response') {
      // Handle participants response from server
      this.emit('participants', decryptedData.participants || decryptedData.data || []);
    } else {
      // If structure is fundamentally valid
      console.warn('[Socket] Received unrecognized message type:', decryptedData?.type);
      this.emit('data', decryptedData); // Still emit for application layer
    }
  }
  
  /**
   * WebRTC signaling handler
   */
  private async handleWebRTCSignal(signalPayload: WebRTCSignalPayload): Promise<void> {
    console.debug(`[Socket] Processing WebRTC signal: ${signalPayload.signalType}`);
    
    // Validate the payload structure
    if (!signalPayload.peerId || !signalPayload.signalData) {
      console.warn('[Socket] Invalid WebRTC signal payload:', signalPayload);
      return;
    }
    
    // Emit the signal for application-level handling
    this.emit('webrtcSignal', signalPayload);
  }

  /**
   * Cleans up old message IDs from the replay protection cache.
   */
  private cleanupMessageIdCache(): void {
    const now = Date.now();
    
    // First pass: remove expired entries
    const expiredIds: string[] = [];
    this.processedMessageIds.forEach((timestamp, id) => {
      if (now - timestamp > this.messageIdCacheTTL) {
        expiredIds.push(id);
      }
    });
    
    for (const id of expiredIds) {
      this.processedMessageIds.delete(id);
    }
    
    // Second pass if still too large: remove oldest entries
    if (this.processedMessageIds.size > this.messageIdCacheMaxSize) {
      const overflow = this.processedMessageIds.size - this.messageIdCacheMaxSize;
      // Sort by timestamp (oldest first)
      const entries = Array.from(this.processedMessageIds.entries())
        .sort((a, b) => a[1] - b[1])
        .slice(0, overflow)
        .map(([id]) => id);
      
      for (const id of entries) {
        this.processedMessageIds.delete(id);
      }
      
      console.debug(`[Socket] Pruned ${entries.length} oldest message IDs from cache.`);
    }
  }

  /**
   * Handles server Ping messages.
   */
  private handlePing(message: PingMessage): void {
    if (!this.socket || !isSocketOpen(this.socket)) return;
    try {
      const pongResponse: PongMessage = {
        type: 'Pong',
        echo_timestamp: message.timestamp,
        server_timestamp: Date.now(),
        sequence: message.sequence,
      };
      this.socket.send(JSON.stringify(pongResponse));
      console.debug(`[Socket] Responded to Ping (Seq: ${message.sequence})`);
    } catch (error) {
      console.error('[Socket] Error sending Pong response:', error);
    }
  }

  /**
   * Handles server Pong messages.
   */
  private handlePong(message: PongMessage): void {
    const now = Date.now();
    const latency = now - message.echo_timestamp;
    console.debug(`[Socket] Received Pong (Seq: ${message.sequence}), Latency: ${latency}ms`);
    this.lastMessageTime = now;

    // Clear the timeout for this sequence
    const timeoutId = this.pingTimeouts.get(message.sequence);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.pingTimeouts.delete(message.sequence);
      this.consecutiveFailedPings = 0; // Reset counter on successful pong
    } else {
      console.warn(`[Socket] Received Pong for unknown/timed-out sequence: ${message.sequence}`);
    }
    
    // Track latency for network quality assessment
    this.addLatencyMeasurement(latency);
    this.updateNetworkQuality();
    this.emit('latency', latency);
  }

  /**
   * Add a latency measurement to the history
   */
  private addLatencyMeasurement(latency: number): void {
    this.latencyHistory.push(latency);
    // Keep history at a reasonable size
    if (this.latencyHistory.length > this.maxLatencyHistory) {
      this.latencyHistory.shift();
    }
  }

  /**
   * Calculate average latency from history
   */
  private calculateAverageLatency(): number {
    if (this.latencyHistory.length === 0) return 200; // Default
    return this.latencyHistory.reduce((sum, val) => sum + val, 0) / this.latencyHistory.length;
  }

  /**
   * Update network quality assessment
   */
  private updateNetworkQuality(): void {
    const now = Date.now();
    if (now - this.lastNetworkQualityCheck < this.NETWORK_CHECK_INTERVAL_MS) {
      return; // Only check periodically
    }
    
    this.lastNetworkQualityCheck = now;
    
    const avgLatency = this.calculateAverageLatency();
    const pingFailRate = this.consecutiveFailedPings / 5; // Consider recent history
    
    // Determine quality based on latency and stability
    if (avgLatency < 100 && pingFailRate === 0) {
      this.networkQuality = 'excellent';
    } else if (avgLatency < 200 && pingFailRate < 0.2) {
      this.networkQuality = 'good';
    } else if (avgLatency < 500 && pingFailRate < 0.5) {
      this.networkQuality = 'poor';
    } else {
      this.networkQuality = 'bad';
    }
    
    this.emit('networkQuality', this.networkQuality);
    
    // Adjust reconnection behavior based on network quality
    if (this.networkQuality === 'bad' && this.isConnected()) {
      console.warn('[Socket] Network quality is bad, checking connection health');
      this.checkConnectionHealth();
    }
  }

  /**
   * Handles server Error messages.
   */
  private handleError(message: ErrorMessage): void {
    console.error(`[Socket] Received server error: Code=${message.code}, Message=${message.message}`);
    const isFatalAuthError = message.code !== undefined && message.code >= 4000 && message.code < 5000;

    this.emit('error', this.createSocketError('server',message.message,`SERVER_${message.code || 'UNKNOWN'}`,undefined,!isFatalAuthError,message));

    // If error occurs during connection and is fatal, reject the promise
    if ((this.connectionState === InternalConnectionState.CONNECTING || this.connectionState === InternalConnectionState.AUTHENTICATING) && isFatalAuthError) {
      console.error("[Socket] Fatal server error during connection phase. Aborting.");
      this.rejectConnection(new Error(`Server error ${message.code}: ${message.message}`));
      this.cleanupConnection(true);
    } else if (isFatalAuthError) {
      // If fatal error after connection, disconnect permanently
      console.error("[Socket] Fatal server error received. Disconnecting permanently.");
      this.autoReconnect = false;
      this.disconnect().catch(e => console.error("Error during disconnect:", e));
    }
  }

  /**
   * Handles server Disconnect messages.
   */
  private handleDisconnect(message: DisconnectMessage): void {
    console.warn(`[Socket] Received Disconnect from server: Reason=${message.reason}, Message=${message.message}`);
    const previousState = this.connectionState;
    this.cleanupConnection(false); // Clean resources first

    // Reject connect promise if disconnected during setup
    if (previousState === InternalConnectionState.CONNECTING || previousState === InternalConnectionState.AUTHENTICATING) {
      this.safeChangeState(InternalConnectionState.DISCONNECTED);
      this.rejectConnection(new Error(`Server disconnected during setup: ${message.reason} ${message.message}`));
    } else if (previousState === InternalConnectionState.CONNECTED) {
      // Emit events if previously connected
      this.emit('connectionStatus', 'disconnected');
      this.emit('disconnected', message.reason, message.message);
      this.safeChangeState(InternalConnectionState.DISCONNECTED);
    }

    // Decide on reconnection
    const canReconnect = message.reason < 4000; // Example logic
    if (this.autoReconnect && canReconnect && canRetry(this.reconnectAttempts, this.reconnectionConfig.maxAttempts)) {
      this.scheduleReconnect();
    } else {
      console.log("[Socket] Disconnect reason indicates no reconnection attempt or max attempts reached.");
      this.autoReconnect = false;
    }
  }

  /**
   * Handles key rotation request from the server
   */
  private async handleKeyRotationRequest(message: any): Promise<void> {
    console.log('[Socket] Received key rotation request');
    
    try {
      if (!this.sessionKey || !this.serverPublicKey) {
        throw new Error('Missing current session or server keys');
      }
      
      // Verify the rotation_id exists
      if (!message.rotation_id) {
        throw new Error('Missing rotation_id in key rotation request');
      }
      
      // Generate random nonce for response
      const responseNonce = new Uint8Array(12);
      if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(responseNonce);
      } else {
        // Fallback for non-browser environments
        for (let i = 0; i < 12; i++) {
          responseNonce[i] = Math.floor(Math.random() * 256);
        }
      }
      
      // Create rotation response
      const rotationResponse = {
        type: 'KeyRotationResponse',
        rotation_id: message.rotation_id,
        nonce: Array.from(responseNonce), // Convert to array for JSON serialization
        // Include additional fields as required by protocol
        timestamp: Date.now()
      };
      
      // Send the response with high priority
      if (this.socket && isSocketOpen(this.socket)) {
        this.socket.send(JSON.stringify(rotationResponse));
        console.log('[Socket] Key rotation response sent');
      } else {
        throw new Error('Socket closed during key rotation');
      }
      
    } catch (error) {
      console.error('[Socket] Error handling key rotation request:', error);
      this.emit('error', this.createSocketError(
        'security',
        'Failed to process key rotation request',
        'KEY_ROTATION_REQ_ERROR',
        error instanceof Error ? error.message : String(error),
        false
      ));
    }
  }

  /**
   * Handles the server's response to a key rotation
   */
  private async handleKeyRotationResponse(message: any): Promise<void> {
    console.log('[Socket] Processing key rotation response');
    
    try {
      // Validate message structure
      if (!message.rotation_id || !message.encrypted_key || !message.key_nonce) {
        throw new Error('Invalid key rotation response structure');
      }
      
      if (!this.sessionKey || !this.serverPublicKey) {
        throw new Error('Missing current session or server keys');
      }
      
      // Implementation would be similar to IpAssign but using existing session key
      // as input to derive the encryption key for the new session key
      
      // For demonstration (actual implementation would use the cryptoUtils):
      const encryptedKeyBytes = numberArrayToUint8Array(message.encrypted_key);
      const keyNonceBytes = numberArrayToUint8Array(message.key_nonce);
      
      // Derive a rotation key using current sessionKey as input
      // This would use deriveKeyWithHKDF or similar
      
      // Decrypt the new session key
      // const newSessionKey = await decryptWithAesGcm(...) as Uint8Array;
      
      // For this example, we'll simulate with a placeholder
      const newSessionKey = new Uint8Array(32);
      if (window.crypto) {
        window.crypto.getRandomValues(newSessionKey);
      }
      
      // Securely replace the old key
      this.secureWipe(this.sessionKey);
      this.sessionKey = newSessionKey;
      this.messageCounter = 0; // Reset counter for new session
      this.lastKeyRotation = Date.now();
      
      console.log('[Socket] Session key rotated successfully');
      this.emit('keyRotated', { timestamp: this.lastKeyRotation });
      
    } catch (error) {
      console.error('[Socket] Error processing key rotation response:', error);
      this.emit('error', this.createSocketError(
        'security',
        'Failed to process key rotation response',
        'KEY_ROTATION_RESP_ERROR',
        error instanceof Error ? error.message : String(error),
        false
      ));
      
      // Since key rotation failure is security-critical, consider reconnecting
      this.forceReconnect = true;
      this.disconnect().then(() => {
        if (this.chatId && this.publicKey) {
          this.connect(this.chatId, this.publicKey).catch(e => {
            console.error('[Socket] Failed to reconnect after key rotation failure:', e);
          });
        }
      }).catch(e => {
        console.error('[Socket] Error during disconnect after key rotation failure:', e);
      });
    }
  }

  // --- Keep-Alive and Health Monitoring ---

  private startKeepAliveServices(): void {
    this.stopKeepAliveServices(); // Ensure previous timers are stopped
    this.startPingInterval();
    this.startKeepAliveMonitoring();
    this.startHeartbeat();
  }

  private stopKeepAliveServices(): void {
    this.stopPingInterval();
    this.stopKeepAliveMonitoring();
    this.stopHeartbeat(); // Includes clearing ping timeouts
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    console.debug('[Socket] Starting ping interval');
    this.pingInterval = setInterval(() => this.sendPing(), PING_INTERVAL_MS);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
      console.debug('[Socket] Stopped ping interval.');
    }
  }

  private startKeepAliveMonitoring(): void {
    this.stopKeepAliveMonitoring();
    console.debug('[Socket] Starting keep-alive monitoring');
    this.keepAliveInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastMessage = now - this.lastMessageTime;

      // Check if disconnected and should reconnect
      if (this.connectionState === InternalConnectionState.DISCONNECTED &&
          this.autoReconnect &&
          canRetry(this.reconnectAttempts, this.reconnectionConfig.maxAttempts)) {
        console.log('[Socket] Keep-alive detected disconnected state, scheduling reconnect.');
        this.scheduleReconnect();
        return;
      }

      // Check if connected but unresponsive
      if (this.connectionState === InternalConnectionState.CONNECTED && timeSinceLastMessage > KEEP_ALIVE_THRESHOLD_MS) {
        console.warn(`[Socket] No messages received for ${Math.round(timeSinceLastMessage/1000)}s. Checking connection health.`);
        this.checkConnectionHealth();
      }
    }, KEEP_ALIVE_CHECK_INTERVAL_MS);
  }

  private stopKeepAliveMonitoring(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
      console.debug('[Socket] Stopped keep-alive monitoring.');
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    console.debug('[Socket] Starting heartbeat');
    this.heartbeatInterval = setInterval(() => {
      if (this.connectionState !== InternalConnectionState.CONNECTED || !this.socket || !isSocketOpen(this.socket)) {
        return; // Only send heartbeat when fully connected
      }
      const timeSinceLast = Date.now() - this.lastMessageTime;
      if (timeSinceLast > IDLE_THRESHOLD_MS) {
        console.debug(`[Socket Heartbeat] Idle for ${Math.round(timeSinceLast/1000)}s, sending ping.`);
        this.sendPing();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.debug('[Socket] Stopped heartbeat.');
    }
    this.clearAllPingTimeouts(); // Also clear ping timeouts when stopping heartbeat
  }

  /** Starts the session key rotation timer */
  private startKeyRotationTimer(): void {
    this.stopKeyRotationTimer();
    console.debug(`[Socket] Starting session key rotation timer (Interval: ${KEY_ROTATION_INTERVAL_MS}ms)`);
    this.keyRotationTimer = setInterval(() => {
      if (this.connectionState === InternalConnectionState.CONNECTED) {
          console.log('[Socket] Triggering scheduled session key rotation.');
          this.rotateSessionKey().catch(err => {
              console.error('[Socket] Scheduled key rotation failed:', err);
          });
      }
    }, KEY_ROTATION_INTERVAL_MS);
  }

  /** Stops the key rotation timer */
  private stopKeyRotationTimer(): void {
    if (this.keyRotationTimer) {
      clearInterval(this.keyRotationTimer);
      this.keyRotationTimer = null;
      console.debug('[Socket] Stopped key rotation timer.');
    }
  }

  private clearAllPingTimeouts(): void {
    if (this.pingTimeouts.size > 0) {
      console.debug(`[Socket] Clearing ${this.pingTimeouts.size} pending ping timeouts.`);
      for (const timeoutId of this.pingTimeouts.values()) {
        clearTimeout(timeoutId);
      }
      this.pingTimeouts.clear();
    }
  }

  /** Sends a Ping message to the server and sets a timeout for the Pong. */
  private sendPing(): void {
    if (!this.socket || !isSocketOpen(this.socket)) {
      console.warn("[Socket] Cannot send Ping: Socket not open.");
      return;
    }

    try {
      // Use a dedicated counter for pings
      const sequenceId = this.pingCounter++;
      const pingMessage: PingMessage = {
        type: 'Ping',
        timestamp: Date.now(),
        sequence: sequenceId,
      };
      this.socket.send(JSON.stringify(pingMessage));
      console.debug(`[Socket] Sent Ping (Seq: ${sequenceId})`);

      // Set a timeout for this specific ping's Pong response
      const timeoutId = setTimeout(() => {
        console.warn(`[Socket] Ping timeout for sequence ${sequenceId}. Connection may be lost.`);
        this.pingTimeouts.delete(sequenceId); // Remove from tracking
        this.consecutiveFailedPings++; // Track consecutive failures
        this.checkConnectionHealth(); // Assume connection issue if ping times out
      }, PING_TIMEOUT_MS);

      this.pingTimeouts.set(sequenceId, timeoutId);

    } catch (error) {
      console.error('[Socket] Error sending Ping:', error);
      this.consecutiveFailedPings++; // Count as failure
      // If sending fails, connection is likely broken
      this.checkConnectionHealth();
    }
  }

  /** Checks connection health, potentially triggering reconnection if unresponsive. */
  private checkConnectionHealth(): void {
    // Only check if we think we should be connected
    if (this.connectionState !== InternalConnectionState.CONNECTED) {
      console.debug("[Socket Health Check] Not in CONNECTED state, skipping.");
      return;
    }
    if (!this.socket || !isSocketOpen(this.socket)) {
      console.warn("[Socket Health Check] Socket is not open. Triggering connection failure.");
      this.handleConnectionFailure(); // Trigger reconnect if socket died silently
      return;
    }

    // If pings have timed out recently (indicated by handlePong not clearing them),
    // or if last message time is very old despite attempts to ping.
    const timeSinceLast = Date.now() - this.lastMessageTime;
    if (timeSinceLast > KEEP_ALIVE_THRESHOLD_MS / 2) { // Check more aggressively if pings might be failing
         console.warn("[Socket Health Check] Connection appears unresponsive. Triggering failure handling.");
         this.handleConnectionFailure();
    } else {
        console.debug("[Socket Health Check] Connection appears healthy.");
    }
  }

  /** Handles detected connection failures by initiating the reconnection process. */
  private handleConnectionFailure(): void {
    if (!this.autoReconnect) {
      console.log("[Socket] Connection failure detected, but auto-reconnect is disabled.");
      this.cleanupConnection(true); // Ensure cleanup
      this.safeChangeState(InternalConnectionState.DISCONNECTED);
      return;
    }
    // Prevent multiple concurrent reconnection attempts
    if (this.connectionState === InternalConnectionState.RECONNECTING || this.reconnectTimeout) {
      console.debug("[Socket] Connection failure handling skipped: Already reconnecting or reconnect scheduled.");
      return;
    }

    console.warn('[Socket] Connection failure detected. Initiating reconnection process...');
    const wasConnected = this.connectionState === InternalConnectionState.CONNECTED;
    this.cleanupConnection(false); // Clean up resources

    // Emit error/status only if previously connected
    if (wasConnected) {
      this.emit('connectionStatus', 'disconnected'); // Inform UI immediately
      this.emit('error', this.createSocketError('connection', 'Connection lost', 'CONN_LOST', undefined, true));
    }

    // Immediately transition to RECONNECTING and schedule the first attempt
    this.safeChangeState(InternalConnectionState.RECONNECTING);
    this.scheduleReconnect();
  }
  
  // --- Reconnection Logic ---

  /** Schedules the next reconnection attempt using exponential backoff. */
  private scheduleReconnect(): void {
    // Clear any existing reconnect timer
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
       console.debug("[Socket] Cleared existing reconnect timeout.");
    }
    // Don't schedule if already connecting/authenticating or closing
    if (this.connectionState === InternalConnectionState.CONNECTING ||
        this.connectionState === InternalConnectionState.AUTHENTICATING ||
        this.connectionState === InternalConnectionState.CLOSING) {
      console.debug(`[Socket] Skipping reconnect schedule: State is ${CONNECTION_STATE_NAMES[this.connectionState]}.`);
      return;
    }
     // Ensure we are marked as reconnecting
     this.safeChangeState(InternalConnectionState.RECONNECTING);


    // Check max attempts
    if (!canRetry(this.reconnectAttempts, this.reconnectionConfig.maxAttempts)) {
      console.log(`[Socket] Max reconnection attempts (${this.reconnectionConfig.maxAttempts}) reached. Stopping.`);
      this.emit('error', this.createSocketError('connection',`Failed to reconnect after ${this.reconnectionConfig.maxAttempts} attempts`,'MAX_RECONNECT',undefined,false));
      this.autoReconnect = false; // Give up
      this.safeChangeState(InternalConnectionState.DISCONNECTED); // Ensure final state is disconnected
      return;
    }

    const delay = calculateBackoffDelay(this.reconnectAttempts, this.reconnectionConfig);
    const attemptNumber = this.reconnectAttempts + 1;

    console.log(`[Socket] Scheduling reconnection attempt ${attemptNumber}/${this.reconnectionConfig.maxAttempts} in ${delay}ms`);

    // Emit 'reconnecting' status for UI feedback
    this.emit('connectionStatus', 'reconnecting');
    this.emit('reconnecting', { attempt: attemptNumber, maxAttempts: this.reconnectionConfig.maxAttempts, delay });

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null; // Clear the timer ID
      // Double-check state before attempting connection
      if (this.connectionState !== InternalConnectionState.RECONNECTING || !this.autoReconnect) {
          console.log(`[Socket] Skipping scheduled reconnect: State changed to ${CONNECTION_STATE_NAMES[this.connectionState]} or autoReconnect disabled.`);
          return;
      }

      if (this.chatId && this.publicKey) {
        this.reconnectAttempts++; // Increment attempt counter *before* trying
        console.log(`[Socket] Executing reconnection attempt ${this.reconnectAttempts}...`);
        try {
          this.forceReconnect = true; // Ensure connect doesn't skip if chatId matches
          await this.connect(this.chatId, this.publicKey);
          // If connect() succeeds, it resets reconnectAttempts and changes state to CONNECTED
        } catch (error) {
          console.error(`[Socket] Reconnection attempt ${this.reconnectAttempts} failed:`, error);
          // If connect() fails, its error handling (via onclose/onerror) should trigger scheduleReconnect again if appropriate.
          // We might need to explicitly call scheduleReconnect here if connect promise rejection doesn't guarantee onclose.
           if (this.connectionState !== InternalConnectionState.CONNECTED) {
            this.safeChangeState(InternalConnectionState.DISCONNECTED); // Ensure state reflects failure
            this.scheduleReconnect(); // Schedule the next attempt
          }
        }
      } else {
           console.error("[Socket] Cannot schedule reconnect: Missing chatId or publicKey.");
           this.autoReconnect = false; // Stop trying if essential info is missing
           this.safeChangeState(InternalConnectionState.DISCONNECTED);
      }
    }, delay);
  }
  
  // --- Message Queueing & Processing ---

  /**
 * Queues a message when it cannot be sent immediately.
 * Implements priority queue with TTL (Time-To-Live) and deduplication.
 * 
 * Mathematical properties:
 * - Queue size: Bounded by maxQueueSize
 * - Message TTL: Enforces maximum message age
 * - Priority ordering: Lower priority values are processed first
 * 
 * @param type The message type identifier (e.g., 'data')
 * @param data The payload object to queue
 * @param priority Priority level for the message (lower values = higher priority)
 * @returns Boolean indicating if the message was successfully queued
 * Time complexity: O(n log n) worst case for priority sort, O(1) for queue insertion
 * Space complexity: O(n) where n is the number of pending messages
 */
private queueMessage(type: string, data: any, priority: MessagePriority = MessagePriority.NORMAL): boolean {
  // Step 1: Clean expired messages first to ensure space in the queue
  this.cleanupMessageQueue();

  // Step 2: Handle queue size limits with priority-aware overflow control
  if (this.pendingMessages.length >= this.maxQueueSize) {
    // Second cleanup attempt targeting only expired messages
    this.cleanupMessageQueue();
    
    // If still full, implement priority-based overflow handling
    if (this.pendingMessages.length >= this.maxQueueSize) {
      if (this.usePriorityQueue) {
        // Sort by priority (lowest number = highest priority)
        this.pendingMessages.sort((a, b) => b.priority - a.priority);
        
        // Get the lowest priority message (last in sorted array)
        const lowestPriorityMsg = this.pendingMessages[this.pendingMessages.length - 1];
        
        // Only remove if the new message has higher priority
        if (lowestPriorityMsg && priority < lowestPriorityMsg.priority) {
          this.pendingMessages.pop(); // Remove lowest priority message
          console.warn(`[Socket] Queue full (${this.maxQueueSize}). Replaced lowest priority message (${lowestPriorityMsg.priority}) with higher priority message (${priority}).`);
        } else {
          console.warn(`[Socket] Queue full (${this.maxQueueSize}). Rejected new message with priority ${priority} (lower than existing messages).`);
          return false; // Cannot queue message with lower priority
        }
      } else {
        // FIFO approach - remove oldest message
        this.pendingMessages.shift();
        console.warn(`[Socket] Queue full (${this.maxQueueSize}). Removed oldest message to make space.`);
      }
    }
  }

  // Step 3: Generate a deterministic but unique message identifier
  // Use existing ID if available or generate a new one with high entropy
  const messageId = data.id || `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
  
  // Step 4: Wrap data with the DataEnvelope expected by the server
  // The queued data should match what would be sent directly in send()
  const envelopedData = {
    payloadType: 'Json',
    payload: data
  };
  
  // Step 5: Create the pending message object with all required metadata
  const pendingMsg: PendingMessage = {
    type,
    data: envelopedData, // Store with envelope to match the send() format
    timestamp: Date.now(),
    id: messageId,
    retryCount: 0,
    priority
  };
  
  // Step 6: Add to queue
  this.pendingMessages.push(pendingMsg);

  // Step 7: Apply priority sorting if enabled
  // Sort the queue so higher priority messages are processed first
  // Time complexity: O(n log n) where n is queue length
  if (this.usePriorityQueue && this.pendingMessages.length > 1) {
    this.pendingMessages.sort((a, b) => {
      // Primary sort by priority (lower number = higher priority)
      const priorityDiff = a.priority - b.priority;
      if (priorityDiff !== 0) return priorityDiff;
      
      // Secondary sort by timestamp (older = higher priority)
      return a.timestamp - b.timestamp;
    });
  }

  // Step 8: Log queue status with diagnostic information
  console.log(`[Socket] Message queued (Type: ${type}, Priority: ${priority}, ID: ${messageId}). Queue size: ${this.pendingMessages.length}/${this.maxQueueSize}`);
  
  // Step 9: Schedule queue processing after a short delay
  // Use setTimeout to avoid blocking the main thread
  setTimeout(() => this.processPendingMessages(), BATCH_PROCESS_DELAY_MS);
  
  return true; // Successfully queued
}

  /** Removes expired messages from the pending queue. */
  private cleanupMessageQueue(): void {
    const now = Date.now();
    const initialLength = this.pendingMessages.length;
    this.pendingMessages = this.pendingMessages.filter(msg => (now - msg.timestamp) <= MESSAGE_QUEUE_TTL_MS);
    const removedCount = initialLength - this.pendingMessages.length;
    if (removedCount > 0) {
        console.debug(`[Socket] Cleaned up ${removedCount} expired messages from queue.`);
    }
  }

  /** Processes and sends messages from the pending queue in batches. */
  private async processPendingMessages(): Promise<void> {
      // Prevent concurrent processing
      if (this.processingQueue) {
          console.debug("[Socket] Queue processing already in progress.");
          return;
      }
      // Ensure we are ready to send
      if (this.pendingMessages.length === 0 || !this.isConnected()) {
          return;
      }

      this.processingQueue = true;
      console.log(`[Socket] Starting processing of ${this.pendingMessages.length} pending messages...`);

      // Adapt batch size based on recent latency
      const avgLatency = this.calculateAverageLatency();
      if (avgLatency > 500) this.currentBatchSize = Math.max(MIN_BATCH_SIZE, Math.floor(this.currentBatchSize * (1 - this.adaptationFactor)));
      else if (avgLatency < 100) this.currentBatchSize = Math.min(MAX_BATCH_SIZE, Math.ceil(this.currentBatchSize * (1 + this.adaptationFactor)));
      console.debug(`[Socket] Adapted batch size to: ${this.currentBatchSize} (Avg Latency: ${avgLatency.toFixed(0)}ms)`);

      // Use a microtask to avoid blocking the main thread
      await new Promise(resolve => setTimeout(resolve, 0));

      // Sort queue by priority if enabled
      if (this.usePriorityQueue) {
          this.pendingMessages.sort((a, b) => a.priority - b.priority); // Lower number = higher priority
      }

      // Take a batch of messages from the queue
      const batchToProcess = this.pendingMessages.splice(0, this.currentBatchSize);
      const failedMessages: PendingMessage[] = []; // To re-queue messages that fail but can be retried
      let successfulSends = 0;

      for (const msg of batchToProcess) {
          // Double-check TTL before sending
          if (Date.now() - msg.timestamp > MESSAGE_QUEUE_TTL_MS) {
              console.debug(`[Socket] Skipping expired queued message (Type: ${msg.type}, ID: ${msg.id})`);
              this.emit('messageFailed', { id: msg.id, type: msg.type, reason: 'TTL_EXPIRED' });
              continue;
          }

          console.debug(`[Socket] Sending queued message (Type: ${msg.type}, Prio: ${msg.priority}, ID: ${msg.id}, Retry: ${msg.retryCount})`);
          try {
              const result = await this.send(msg.data, msg.priority); // Use the public send method

              if (result === SendResult.SENT) {
                  successfulSends++;
              } else if (result === SendResult.QUEUED || result === SendResult.FAILED) {
                  // If send returns QUEUED/FAILED even when isConnected() was true, it means an error occurred during send/encryption
                  // Re-queue for retry if possible
                  if (msg.retryCount < MAX_MESSAGE_RETRY_ATTEMPTS) {
                      msg.retryCount++;
                      failedMessages.push(msg);
                      console.warn(`[Socket] Send failed/requeued during batch processing. Re-queuing for retry (${msg.retryCount}/${MAX_MESSAGE_RETRY_ATTEMPTS})`);
                  } else {
                      console.error(`[Socket] Queued message failed after ${MAX_MESSAGE_RETRY_ATTEMPTS} attempts. Discarding:`, msg.type, msg.id);
                      this.emit('messageFailed', { id: msg.id, type: msg.type, reason: 'MAX_RETRIES_EXCEEDED' });
                  }
              }
          } catch (error) { // Catch unexpected errors from send
              console.error(`[Socket] Error sending queued message type ${msg.type} (ID: ${msg.id}):`, error);
              if (msg.retryCount < MAX_MESSAGE_RETRY_ATTEMPTS) {
                  msg.retryCount++;
                  failedMessages.push(msg);
                  console.warn(`[Socket] Send error for queued message. Re-queuing for retry (${msg.retryCount}/${MAX_MESSAGE_RETRY_ATTEMPTS})`);
              } else {
                  console.error(`[Socket] Queued message failed after ${MAX_MESSAGE_RETRY_ATTEMPTS} attempts due to send error. Discarding:`, msg.type, msg.id);
                  this.emit('messageFailed', { id: msg.id, type: msg.type, reason: 'SEND_ERROR' });
              }
          }
      }

      // Add any messages that need retrying back to the main queue
      if (failedMessages.length > 0) {
          console.log(`[Socket] Re-queuing ${failedMessages.length} failed messages for later retry.`);
          // Add back to the start of the queue to prioritize retries? Or end? Let's add to end.
          this.pendingMessages.push(...failedMessages);
           // Re-sort if using priority queue
          if (this.usePriorityQueue) {
                this.pendingMessages.sort((a, b) => a.priority - b.priority);
          }
      }

      console.log(`[Socket] Finished processing batch (${successfulSends} sent, ${failedMessages.length} failed/retried). ${this.pendingMessages.length} messages remaining.`);
      this.processingQueue = false;

      // If there are still messages, schedule the next batch processing cycle
      if (this.pendingMessages.length > 0) {
          setTimeout(() => this.processPendingMessages(), BATCH_PROCESS_DELAY_MS); // Process next batch shortly after
      }
  }

  // --- Connection Promise Management ---

  private resolveConnection(): void {
    if (this.connectionResolve) {
      console.debug("[Socket] Resolving connection promise.");
      this.connectionResolve();
    }
    this.connectionPromise = null; // Clear promise refs
    this.connectionResolve = null;
    this.connectionReject = null;
  }

  private rejectConnection(reason?: any): void {
    if (this.connectionReject) {
       console.debug("[Socket] Rejecting connection promise.", reason);
      this.connectionReject(reason);
    }
    this.connectionPromise = null; // Clear promise refs
    this.connectionResolve = null;
    this.connectionReject = null;
  }

  // --- Connection State Management ---

  private async safeChangeState(newState: InternalConnectionStateType): Promise<void> {
    // Create a new promise chain to handle the state change
    this.stateTransitionLock = this.stateTransitionLock.then(async () => {
      if (this.connectionState === newState) return; // No change

      const oldState = this.connectionState;
      this.connectionState = newState;
      console.debug(`[Socket] State changed: ${CONNECTION_STATE_NAMES[oldState]} -> ${CONNECTION_STATE_NAMES[newState]}`);

      // Emit simplified status for external listeners
      const externalStatus = this.getConnectionStatus();
      this.emit('connectionStatus', externalStatus);
      
      // Perform state-specific actions
      if (newState === InternalConnectionState.CONNECTED) {
        this.startKeepAliveServices();
        this.processPendingMessages();
      } else if (newState === InternalConnectionState.DISCONNECTED) {
        // Ensure timers are stopped
        this.stopKeepAliveServices();
      }
    }).catch(err => {
      console.error('[Socket] Error during state transition:', err);
    });
    
    // Wait for the state change to complete
    await this.stateTransitionLock;
  }
  
  private clearConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
      console.debug('[Socket] Cleared connection timeout.');
    }
  }

  private startConnectionTimeout(): void {
    this.clearConnectionTimeout();
    console.debug(`[Socket] Starting connection timeout (${CONNECTION_TIMEOUT_MS}ms)`);
    this.connectionTimeout = setTimeout(() => {
      this.connectionTimeout = null;
      // Only act if still in a connecting/authenticating state
      if (this.connectionState === InternalConnectionState.CONNECTING || this.connectionState === InternalConnectionState.AUTHENTICATING) {
        console.error('[Socket] Connection attempt timed out.');
        const timeoutError = new Error('Connection timed out');
        this.emit('error', this.createSocketError('connection','Connection attempt timed out','CONN_TIMEOUT',undefined,true));
        // Ensure socket is closed if timeout occurs
        if (this.socket) {
          try { this.socket.close(1006, "Connection Timeout"); } catch(e) {}
        }
        this.rejectConnection(timeoutError); // Reject the connect promise
        this.cleanupConnection(true); // Cleanup and emit disconnected
        // Schedule reconnect if applicable
        if (this.autoReconnect && canRetry(this.reconnectAttempts, this.reconnectionConfig.maxAttempts)) {
          this.scheduleReconnect();
        }
      } else {
        console.debug("[Socket] Connection timeout fired but state is no longer connecting/authenticating.");
      }
    }, CONNECTION_TIMEOUT_MS);
  }
}
