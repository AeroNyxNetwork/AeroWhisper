// src/lib/webrtc.ts
import { EventEmitter } from 'events';
import { AeroNyxSocket, SendResult } from './socket';
import {
    encryptWithAesGcm,
    decryptWithAesGcm,
    generateNonce
} from '../utils/cryptoUtils';

/**
 * WebRTC connection states for type safety
 */
export type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

/**
 * Event types for the WebRTC manager
 */
export type WebRTCEvent =
  | 'connectionStateChanged'
  | 'message'
  | 'error'
  | 'iceCandidate'
  | 'dataChannelOpen'
  | 'dataChannelClose'
  | 'negotiationNeeded';

/**
 * WebRTC error types with structured information
 */
export interface WebRTCError {
  type: 'connection' | 'signaling' | 'dataChannel' | 'decryption' | 'parsing' | 'negotiation';
  message: string;
  details?: any;
  recoverable: boolean;
}

/**
 * Configuration options for WebRTC connections
 */
export interface WebRTCConfig {
  iceServers?: RTCIceServer[];
  iceCandidatePoolSize?: number;
  bundlePolicy?: RTCBundlePolicy;
  iceTransportPolicy?: RTCIceTransportPolicy;
  sdpSemantics?: 'unified-plan' | 'plan-b';
  reconnectAttempts?: number;
  reconnectInterval?: number;
  dataChannelOptions?: RTCDataChannelInit;
  bufferThreshold?: number; // Threshold for data channel buffer
  enableEncryption?: boolean; // Flag to force encryption
}

// Default configuration with updated STUN/TURN servers
const DEFAULT_CONFIG: WebRTCConfig = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    // TURN servers would be added here for NAT traversal
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  sdpSemantics: 'unified-plan',
  reconnectAttempts: 3,
  reconnectInterval: 3000,
  dataChannelOptions: {
    ordered: true,
    maxRetransmits: 5,
    negotiated: false,
  },
  bufferThreshold: 16 * 1024 * 1024, // 16MB buffer threshold
  enableEncryption: true // Enable encryption by default
};

/**
 * Represents the structure of signaling messages sent via the WebSocket
 */
interface WebRTCSignal {
    type: 'offer' | 'answer' | 'ice-candidate';
    sdp?: string;
    candidate?: RTCIceCandidateInit;
    timestamp?: number; // Timestamp to help with signal ordering
}

/**
 * Message envelope for P2P encrypted communication
 */
interface EncryptedMessageEnvelope {
  type: 'encrypted';
  nonce: number[];
  encrypted: number[];
  counter: number;
  timestamp: number; // For replay protection
}

/**
 * WebRTCManager - Manages peer-to-peer connections using a provided AeroNyxSocket for signaling.
 */
export class WebRTCManager extends EventEmitter {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private p2pEncryptionKey: Uint8Array | null = null;
  private socket: AeroNyxSocket | null = null;
  private localPeerId: string | null = null;
  private remotePeerId: string | null = null;
  private connectionState: ConnectionState = 'new';
  private config: WebRTCConfig;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isInitiator: boolean = false;
  private pendingCandidates: Set<string> = new Set(); // Use Set for faster lookups and deduplication
  private pendingCandidateObjects: RTCIceCandidateInit[] = [];
  private channelLabel: string = 'aero-p2p-chat';
  private isReconnecting: boolean = false;
  private remoteDescriptionSet: boolean = false;
  private p2pMessageCounter: number = 0;
  private processedP2PMessages: Map<number, number> = new Map(); // For replay protection: counter -> timestamp
  private stateTransitionLock: Promise<void> = Promise.resolve(); // Prevent race conditions in state changes
  private lastSignalTimestamp: number = 0; // Track timing of signals to prevent reordering
  private messageQueue: Array<{message: any, timestamp: number}> = []; // Queue for messages when channel not ready
  private readonly MAX_PROCESSED_MESSAGES = 100; // Maximum number of processed message counters to keep
  private readonly MESSAGE_EXPIRY_MS = 60 * 1000; // Expire message replay protection after 1 minute

  /**
   * Create a new WebRTC manager
   * @param config - Optional configuration for WebRTC
   */
  constructor(config?: Partial<WebRTCConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setMaxListeners(20);
    console.log('[WebRTC] Manager created.');
  }

  /**
   * Initialize with the signaling socket and peer IDs.
   * @param socket - The signaling socket instance (AeroNyxSocket).
   * @param localPeerId - The public key or unique ID of the local user.
   * @param p2pKey - The pre-negotiated 32-byte key for encrypting the data channel.
   */
  initialize(socket: AeroNyxSocket, localPeerId: string, p2pKey: Uint8Array | null): void {
    if (!socket || !localPeerId) {
      throw new Error('WebRTC manager requires a valid socket instance and localPeerId');
    }

    // Validate P2P encryption key
    if (this.config.enableEncryption && (!p2pKey || p2pKey.length !== 32)) {
      console.warn('[WebRTC] Invalid P2P key provided when encryption is enabled. Secure communication not possible.');
      if (p2pKey && p2pKey.length !== 32) {
        // Further warning for wrong size key which is a specific security risk
        console.error('[WebRTC] P2P key has invalid length. Must be exactly 32 bytes.');
      }
      this.p2pEncryptionKey = null;
    } else {
      this.p2pEncryptionKey = p2pKey;
      console.log(`[WebRTC] Initialized with P2P encryption key: ${p2pKey ? 'Yes' : 'No'}`);
    }

    this.reset(); // Clear previous state
    this.socket = socket;
    this.localPeerId = localPeerId;

    // Remove existing listeners to prevent duplicates
    socket.off('webrtcSignal', this.handleSignalingMessage);
    socket.off('disconnected', this.handleSocketDisconnect);
    
    // Add new listeners
    socket.on('webrtcSignal', this.handleSignalingMessage);
    socket.on('disconnected', this.handleSocketDisconnect);

    this.setConnectionState('new');
    console.log('[WebRTC] Initialized and listening for signals.');
  }

  /**
   * Handles the disconnection of the underlying signaling socket.
   */
  private handleSocketDisconnect = (): void => {
    console.warn('[WebRTC] Signaling socket disconnected.');
    
    // Only trigger a state change if we're in a connecting state
    if (this.connectionState === 'connecting') {
      this.emitError({
        type: 'signaling',
        message: 'Signaling server disconnected during P2P connection setup.',
        recoverable: false
      });
      
      this.setConnectionState('failed');
    }
    
    // If we're already connected via P2P, we might survive a temporary signaling disconnection
    // Don't change state in that case, but log the condition
    if (this.connectionState === 'connected' && this.isDataChannelOpen()) {
      console.log('[WebRTC] P2P connection remains active despite signaling disconnection.');
    }
  };

  /**
   * Emits a standardized error event
   */
  private emitError(error: WebRTCError): void {
    console.error(`[WebRTC] ${error.type} error: ${error.message}`, 
      error.details ? (typeof error.details === 'object' ? JSON.stringify(error.details) : error.details) : '');
    this.emit('error', error);
  }

  /**
   * Resets the WebRTC connection state and resources.
   */
  private reset(): void {
    console.debug('[WebRTC] Resetting connection state.');
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.cleanupPeerConnection();
    
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    this.pendingCandidates.clear();
    this.pendingCandidateObjects = [];
    this.remoteDescriptionSet = false;
    this.isInitiator = false;
    this.remotePeerId = null;
    this.p2pMessageCounter = 0;
    this.processedP2PMessages.clear();
    this.lastSignalTimestamp = 0;
    this.messageQueue = [];
    this.setConnectionState('new');
  }

  /**
   * Initiates a P2P connection to a remote peer.
   * @param remotePeerId - ID of the peer to connect to.
   */
  async connectToPeer(remotePeerId: string): Promise<void> {
    if (!this.socket || !this.localPeerId) {
      throw new Error('WebRTC manager not initialized.');
    }
    
    // Reset if in an incompatible state
    if (this.connectionState !== 'new' && 
        this.connectionState !== 'disconnected' && 
        this.connectionState !== 'closed') {
      console.warn(`[WebRTC] connectToPeer called in invalid state: ${this.connectionState}. Resetting first.`);
      this.reset();
    }

    console.log(`[WebRTC] Initiating connection to peer: ${remotePeerId}`);
    this.remotePeerId = remotePeerId;
    this.isInitiator = true;
    await this.setConnectionState('connecting');

    try {
      // Create and configure peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: this.config.iceServers,
        iceCandidatePoolSize: this.config.iceCandidatePoolSize,
        bundlePolicy: this.config.bundlePolicy,
        iceTransportPolicy: this.config.iceTransportPolicy
      });

      this.setupPeerConnectionHandlers();

      // Create the data channel as the initiator
      console.debug('[WebRTC] Creating data channel:', this.channelLabel);
      this.dataChannel = this.peerConnection.createDataChannel(
        this.channelLabel,
        this.config.dataChannelOptions
      );
      this.setupDataChannelHandlers();

      // Create and send offer
      console.debug('[WebRTC] Creating offer...');
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      console.debug('[WebRTC] Local description (offer) set.');

      // Send the offer via the signaling socket
      await this.sendSignal(this.remotePeerId, {
        type: 'offer',
        sdp: offer.sdp,
        timestamp: Date.now()
      });
      console.log(`[WebRTC] Offer sent to peer: ${this.remotePeerId}`);

    } catch (error) {
      console.error('[WebRTC] Error initiating connection:', error);
      await this.setConnectionState('failed');
      
      this.emitError({
        type: 'connection',
        message: 'Failed to create P2P connection offer',
        details: error instanceof Error ? error.message : String(error),
        recoverable: true
      });
      
      this.cleanupPeerConnection();
      throw error;
    }
  }

  /**
   * Sets up event handlers for the RTCPeerConnection.
   */
  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) return;
      
      const newState = this.peerConnection.connectionState as ConnectionState;
      console.log(`[WebRTC] PeerConnection state changed to: ${newState}`);
      this.setConnectionState(newState);

      if (newState === 'failed' || newState === 'disconnected') {
        this.handleConnectionFailure();
      } else if (newState === 'connected') {
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.processQueuedMessages();
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      if (!this.peerConnection) return;
      
      console.log(`[WebRTC] ICE connection state: ${this.peerConnection.iceConnectionState}`);
      if (this.peerConnection.iceConnectionState === 'failed') {
        this.handleIceFailure();
      }
    };

    this.peerConnection.onicegatheringstatechange = () => {
      if (!this.peerConnection) return;
      console.log(`[WebRTC] ICE gathering state: ${this.peerConnection.iceGatheringState}`);
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.remotePeerId) {
        console.debug('[WebRTC] Gathered ICE candidate:', event.candidate.type, event.candidate.sdpMLineIndex);
        
        // Send candidate to remote peer
        this.sendSignal(this.remotePeerId, {
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
          timestamp: Date.now()
        }).catch(err => {
          console.error("[WebRTC] Failed to send ICE candidate signal:", err);
        });
        
        this.emit('iceCandidate', event.candidate);
      } else if (!event.candidate) {
        console.log('[WebRTC] ICE candidate gathering complete.');
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      console.log(`[WebRTC] Received remote data channel: ${event.channel.label}`);
      
      if (event.channel.label === this.channelLabel) {
        this.dataChannel = event.channel;
        this.setupDataChannelHandlers();
      } else {
        console.warn(`[WebRTC] Received data channel with unexpected label: ${event.channel.label}`);
        // Consider security implications of unexpected channels - close them?
        try { event.channel.close(); } catch (e) {}
      }
    };

    this.peerConnection.onnegotiationneeded = async () => {
      console.log('[WebRTC] Negotiation needed.');
      this.emit('negotiationNeeded');
      
      // Only initiator handles renegotiation to prevent offer collisions
      if (this.isInitiator && this.peerConnection && this.remotePeerId) {
        // Check for stable state to avoid triggering during existing negotiation
        if (this.peerConnection.signalingState === 'stable') {
          console.log('[WebRTC] Initiator creating new offer due to negotiation needed.');
          
          try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            await this.sendSignal(this.remotePeerId, { 
              type: 'offer', 
              sdp: offer.sdp,
              timestamp: Date.now()
            });
          } catch (error) {
            console.error('[WebRTC] Error during renegotiation:', error);
            this.emitError({
              type: 'negotiation',
              message: 'Renegotiation failed',
              details: error,
              recoverable: true
            });
          }
        } else {
          console.warn(`[WebRTC] Negotiation needed, but signaling state is not stable: ${this.peerConnection.signalingState}`);
        }
      }
    };
  }

  /**
   * Sets up event handlers for the RTCDataChannel.
   */
  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log(`[WebRTC] Data channel '${this.channelLabel}' opened.`);
      
      if (this.connectionState !== 'connected') {
        this.setConnectionState('connected');
      }
      
      this.emit('dataChannelOpen');
      this.processQueuedMessages();
    };

    this.dataChannel.onclose = () => {
      console.warn(`[WebRTC] Data channel '${this.channelLabel}' closed.`);
      this.emit('dataChannelClose');
      
      // Try to reopen data channel if peer connection is still alive
      if (this.peerConnection && 
          this.peerConnection.connectionState === 'connected' && 
          this.isInitiator) {
        console.log('[WebRTC] Attempting to reopen data channel...');
        try {
          this.dataChannel = this.peerConnection.createDataChannel(
            this.channelLabel,
            this.config.dataChannelOptions
          );
          this.setupDataChannelHandlers();
        } catch (error) {
          console.error('[WebRTC] Failed to reopen data channel:', error);
        }
      }
    };

    this.dataChannel.onerror = (event) => {
      console.error(`[WebRTC] Data channel '${this.channelLabel}' error:`, event);
      
      this.emitError({
        type: 'dataChannel',
        message: 'Data channel error occurred',
        details: event.toString(),
        recoverable: true
      });
    };

    this.dataChannel.onmessage = async (event: MessageEvent) => {
      console.debug('[WebRTC] Received raw message on data channel.');
      
      try {
        const receivedData = JSON.parse(event.data);

        // Process encrypted messages
        if (this.p2pEncryptionKey) {
          if (receivedData.type === 'encrypted' && 
              receivedData.nonce && 
              receivedData.encrypted && 
              typeof receivedData.counter === 'number') {
            
            // Check for replay attacks
            if (this.processedP2PMessages.has(receivedData.counter)) {
              console.warn(`[WebRTC] Rejected replayed P2P message with counter: ${receivedData.counter}`);
              return;
            }
            
            try {
              console.debug('[WebRTC] Decrypting P2P message...');
              const nonce = new Uint8Array(receivedData.nonce);
              const ciphertext = new Uint8Array(receivedData.encrypted);
              
              const decryptedPayload = await decryptWithAesGcm(
                ciphertext, 
                nonce, 
                this.p2pEncryptionKey, 
                'string'
              ) as string;
              
              const actualMessage = JSON.parse(decryptedPayload);
              
              // Store counter for replay protection
              this.processedP2PMessages.set(receivedData.counter, Date.now());
              this.cleanupProcessedMessages();
              
              console.debug('[WebRTC] P2P message decrypted successfully.');
              this.emit('message', actualMessage);
            } catch (decryptionError) {
              console.error('[WebRTC] Failed to decrypt P2P message:', decryptionError);
              this.emitError({
                type: 'decryption',
                message: 'Failed to decrypt P2P message',
                details: decryptionError,
                recoverable: true
              });
            }
          } else {
            console.warn('[WebRTC] Received unencrypted/malformed message when encryption was expected.');
          }
        } else {
          // If not using encryption, emit raw data
          console.debug('[WebRTC] Emitting unencrypted P2P message.');
          this.emit('message', receivedData);
        }
      } catch (error) {
        console.error('[WebRTC] Error processing data channel message:', error);
        this.emitError({
          type: 'parsing',
          message: 'Failed to parse P2P message',
          details: error,
          recoverable: true
        });
      }
    };
  }

  /**
   * Process any queued messages when data channel opens
   */
  private async processQueuedMessages(): Promise<void> {
    if (!this.isDataChannelOpen() || this.messageQueue.length === 0) return;
    
    console.log(`[WebRTC] Processing ${this.messageQueue.length} queued messages`);
    
    // Use a copy and clear the original queue to prevent race conditions
    const queueCopy = [...this.messageQueue];
    this.messageQueue = [];
    
    // Sort by timestamp to maintain order
    queueCopy.sort((a, b) => a.timestamp - b.timestamp);
    
    for (const item of queueCopy) {
      try {
        await this.sendMessage(item.message);
      } catch (error) {
        console.error('[WebRTC] Failed to send queued message:', error);
      }
    }
    
    console.log(`[WebRTC] Finished processing queued messages`);
  }

  /**
   * Clean up old processed message counters to prevent memory leaks
   */
  private cleanupProcessedMessages(): void {
    if (this.processedP2PMessages.size <= this.MAX_PROCESSED_MESSAGES) return;
    
    const now = Date.now();
    const expiredEntries: number[] = [];
    
    // Find expired entries
    this.processedP2PMessages.forEach((timestamp, counter) => {
      if (now - timestamp > this.MESSAGE_EXPIRY_MS) {
        expiredEntries.push(counter);
      }
    });
    
    // Remove expired entries
    for (const counter of expiredEntries) {
      this.processedP2PMessages.delete(counter);
    }
    
    // If still too many entries, remove oldest
    if (this.processedP2PMessages.size > this.MAX_PROCESSED_MESSAGES) {
      const entries = Array.from(this.processedP2PMessages.entries())
        .sort((a, b) => a[1] - b[1]);
      
      const overflow = this.processedP2PMessages.size - this.MAX_PROCESSED_MESSAGES;
      const toRemove = entries.slice(0, overflow).map(entry => entry[0]);
      
      for (const counter of toRemove) {
        this.processedP2PMessages.delete(counter);
      }
    }
  }

  /**
   * Handles connection failures (disconnected or failed states).
   */
  private handleConnectionFailure(): void {
    if (this.isReconnecting) return;

    // Check if reconnection is configured and attempts remain
    if (this.config.reconnectAttempts && 
        this.reconnectAttempts < this.config.reconnectAttempts) {
      
      this.isReconnecting = true;
      this.reconnectAttempts++;
      const delay = this.config.reconnectInterval || 3000;
      
      console.warn(`[WebRTC] P2P connection failed/disconnected. Attempting reconnect ${this.reconnectAttempts}/${this.config.reconnectAttempts} in ${delay}ms...`);
      
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      
      this.reconnectTimer = setTimeout(() => {
        this.isReconnecting = false;
        
        if (this.remotePeerId) {
          console.log(`[WebRTC] Executing reconnect attempt ${this.reconnectAttempts}...`);
          
          this.connectToPeer(this.remotePeerId).catch(err => {
            console.error(`[WebRTC] Reconnect attempt ${this.reconnectAttempts} failed:`, err);
            
            // Schedule next attempt if possible
            if (this.reconnectAttempts < (this.config.reconnectAttempts ?? 0)) {
              this.handleConnectionFailure();
            } else {
              this.setConnectionState('failed');
            }
          });
        } else {
          console.error("[WebRTC] Cannot reconnect: remotePeerId is null.");
          this.setConnectionState('failed');
        }
      }, delay);
    } else {
      console.error('[WebRTC] P2P connection failed. Max reconnect attempts reached or reconnection disabled.');
      this.setConnectionState('failed');
      this.cleanupPeerConnection();
    }
  }

  /**
   * Handles ICE connection failures specifically. Attempts ICE restart.
   */
  private handleIceFailure(): void {
    console.warn('[WebRTC] ICE connection failed. Attempting ICE restart...');
    
    if (this.peerConnection && this.remotePeerId) {
      try {
        // Restart ICE
        this.peerConnection.restartIce();
        console.log('[WebRTC] ICE restart initiated.');
        
        // For older browsers that don't support restartIce method
        if (typeof this.peerConnection.restartIce !== 'function' && this.isInitiator) {
          console.log('[WebRTC] Using createOffer with ice restart for older browsers');
          this.peerConnection.createOffer({ iceRestart: true })
            .then(offer => this.peerConnection?.setLocalDescription(offer))
            .then(() => {
              if (this.peerConnection?.localDescription && this.remotePeerId) {
                this.sendSignal(this.remotePeerId, {
                  type: 'offer',
                  sdp: this.peerConnection.localDescription.sdp,
                  timestamp: Date.now()
                });
              }
            })
            .catch(error => {
              console.error('[WebRTC] Failed to restart ICE via createOffer:', error);
              this.handleConnectionFailure();
            });
        }
      } catch (error) {
        console.error('[WebRTC] Failed to restart ICE:', error);
        this.handleConnectionFailure();
      }
    } else {
      this.handleConnectionFailure();
    }
  }

  /**
   * Handles incoming signaling messages received via the AeroNyxSocket.
   * @param signalData The raw signal data object from the socket event.
   */
  private handleSignalingMessage = async (signalData: any): Promise<void> => {
    // Validate signal structure
    if (!signalData || typeof signalData !== 'object' || 
        !signalData.type || !signalData.sender || !signalData.signal) {
      console.warn('[WebRTC] Received invalid signaling message structure:', signalData);
      return;
    }

    const { sender, signal, recipient, timestamp } = signalData;

    // Ensure the message is intended for us
    if (recipient && recipient !== this.localPeerId) {
      console.debug(`[WebRTC] Ignoring signal intended for another peer: ${recipient}`);
      return;
    }

    // Check for out-of-order delivery using timestamps
    if (timestamp && timestamp < this.lastSignalTimestamp) {
      console.warn(`[WebRTC] Ignoring out-of-order signal from ${sender} (timestamp: ${timestamp}, last: ${this.lastSignalTimestamp})`);
      return;
    }
    
    if (timestamp) {
      this.lastSignalTimestamp = timestamp;
    }

    // Set remotePeerId for initial offer
    if (!this.remotePeerId && signal.type === 'offer') {
      console.log(`[WebRTC] Received initial offer from ${sender}. Setting remotePeerId.`);
      this.remotePeerId = sender;
    } else if (sender !== this.remotePeerId && this.remotePeerId) {
      console.warn(`[WebRTC] Ignoring signal from unexpected sender ${sender}. Current remote peer is ${this.remotePeerId}.`);
      return;
    }

    console.debug(`[WebRTC] Processing signal type '${signal.type}' from peer ${sender}`);

    try {
      // Ensure peerConnection exists for answer and ice candidates
      if ((signal.type === 'answer' || signal.type === 'ice-candidate') && !this.peerConnection) {
        console.warn(`[WebRTC] Received ${signal.type} but peerConnection is null. Ignoring.`);
        return;
      }

      switch (signal.type) {
        case 'offer':
          await this.handleOfferSignal(signal, sender);
          break;
        case 'answer':
          await this.handleAnswerSignal(signal);
          break;
        case 'ice-candidate':
          await this.handleIceCandidateSignal(signal);
          break;
        default:
          console.warn(`[WebRTC] Received unknown signal type: ${signal.type}`);
      }
    } catch (error) {
      console.error(`[WebRTC] Error handling signal type ${signal.type}:`, error);
      
      this.emitError({
        type: 'signaling',
        message: `Failed to process ${signal.type} signal`,
        details: error instanceof Error ? error.message : String(error),
        recoverable: true
      });
      
      if (signal.type === 'offer' || signal.type === 'answer') {
        this.handleConnectionFailure();
      }
    }
  };

  /**
   * Handles an incoming Offer signal.
   * @param signal The offer signal part.
   * @param sender The peer ID of the sender.
   */

private async handleOfferSignal(signal: WebRTCSignal, sender: string): Promise<void> {
  // Additional security validation
  if (!signal.sdp || typeof signal.sdp !== 'string' || signal.sdp.length < 50) {
    console.warn('[WebRTC] Rejected offer with invalid SDP');
    this.emitError({
      type: 'signaling',
      message: 'Received offer with invalid SDP',
      details: 'SDP validation failed',
      recoverable: true
    });
    return;
  }
  
  // Handle signaling state conflicts (glare)
  if (this.peerConnection && this.peerConnection.signalingState !== 'stable') {
    console.warn(`[WebRTC] Received offer but signaling state is ${this.peerConnection.signalingState}. Handling potential glare.`);
    
    // Basic glare handling: initiator keeps their offer, non-initiator accepts incoming
    if (this.isInitiator) {
      console.log("[WebRTC] Glare detected: Initiator ignoring incoming offer.");
      return;
    } else {
      console.log("[WebRTC] Glare detected: Non-initiator resetting and accepting incoming offer.");
      this.reset();
    }
  }

  this.remotePeerId = sender;
  this.isInitiator = false;
  await this.setConnectionState('connecting');

  // Create peer connection if it doesn't exist
  if (!this.peerConnection) {
    try {
      this.peerConnection = new RTCPeerConnection({
        iceServers: this.config.iceServers,
        iceCandidatePoolSize: this.config.iceCandidatePoolSize,
        bundlePolicy: this.config.bundlePolicy,
        iceTransportPolicy: this.config.iceTransportPolicy
      });
      this.setupPeerConnectionHandlers();
    } catch (error) {
      console.error('[WebRTC] Failed to create RTCPeerConnection:', error);
      this.emitError({
        type: 'connection',
        message: 'Failed to create RTCPeerConnection',
        details: error instanceof Error ? error.message : String(error),
        recoverable: false
      });
      return;
    }
  }

  try {
    console.debug('[WebRTC] Setting remote description (offer)...');
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription({ type: 'offer', sdp: signal.sdp })
    );
    this.remoteDescriptionSet = true;
    console.debug('[WebRTC] Remote description (offer) set.');

    // Process any queued candidates
    await this.addPendingCandidates();

    console.debug('[WebRTC] Creating answer...');
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    console.debug('[WebRTC] Local description (answer) set.');

    // Send the answer back with timeout protection
    const sendAnswerPromise = this.sendSignal(sender, { 
      type: 'answer', 
      sdp: answer.sdp,
      timestamp: Date.now()
    });
    
    // Add timeout for answer sending
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Sending answer timed out')), 5000);
    });
    
    await Promise.race([sendAnswerPromise, timeoutPromise]);
    console.log(`[WebRTC] Answer sent to peer: ${sender}`);
  } catch (error) {
    console.error('[WebRTC] Error processing offer:', error);
    this.emitError({
      type: 'signaling',
      message: 'Failed to process offer',
      details: error instanceof Error ? error.message : String(error),
      recoverable: true
    });
    // Clean up if we couldn't process the offer
    this.cleanupPeerConnection();
  }
}

  /**
   * Handles an incoming Answer signal.
   * @param signal The answer signal part.
   */
  private async handleAnswerSignal(signal: WebRTCSignal): Promise<void> {
    if (!this.peerConnection) {
      throw new Error("PeerConnection not initialized for answer");
    }
    
    // Verify we're in the right state to receive an answer
    if (this.peerConnection.signalingState !== 'have-local-offer') {
      console.warn(`[WebRTC] Received answer in unexpected signaling state: ${this.peerConnection.signalingState}. Ignoring.`);
      return;
    }

    try {
      console.debug('[WebRTC] Setting remote description (answer)...');
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: signal.sdp })
      );
      this.remoteDescriptionSet = true;
      console.debug('[WebRTC] Remote description (answer) set.');

      // Process any queued candidates
      await this.addPendingCandidates();
    } catch (error) {
      console.error('[WebRTC] Error processing answer:', error);
      throw error;
    }
  }

  /**
   * Handles an incoming ICE Candidate signal.
   * @param signal The candidate signal part.
   */
  private async handleIceCandidateSignal(signal: WebRTCSignal): Promise<void> {
    if (!this.peerConnection) {
      throw new Error("PeerConnection not initialized for candidate");
    }
    
    if (!signal.candidate) {
      console.warn("[WebRTC] Received empty ICE candidate signal.");
      return;
    }

    try {
      const candidateJson = JSON.stringify(signal.candidate);
      
      // Check for duplicate candidates (efficient with Set)
      if (this.pendingCandidates.has(candidateJson)) {
        console.debug('[WebRTC] Ignoring duplicate ICE candidate.');
        return;
      }
      
      const candidate = new RTCIceCandidate(signal.candidate);
      
      // Queue candidate if remote description isn't set yet
      if (!this.remoteDescriptionSet || 
          this.peerConnection.signalingState !== 'stable') {
        console.debug('[WebRTC] Queuing ICE candidate (Remote desc not set or state not stable).');
        this.pendingCandidates.add(candidateJson);
        this.pendingCandidateObjects.push(signal.candidate);
      } else {
        console.debug('[WebRTC] Adding ICE candidate immediately.');
        await this.peerConnection.addIceCandidate(candidate);
        console.debug('[WebRTC] Added ICE candidate.');
      }
    } catch (error) {
      console.error('[WebRTC] Error processing ICE candidate:', error);
      // Don't throw here since candidate errors are often recoverable
    }
  }

  /**
   * Adds any queued ICE candidates after the remote description is set.
   */
  private async addPendingCandidates(): Promise<void> {
    if (!this.peerConnection || this.pendingCandidateObjects.length === 0) {
      return;
    }

    console.debug(`[WebRTC] Adding ${this.pendingCandidateObjects.length} pending ICE candidates...`);
    
    const candidatesToAdd = [...this.pendingCandidateObjects];
    this.pendingCandidateObjects = [];
    this.pendingCandidates.clear();

    const addPromises = candidatesToAdd.map(async (candidateInit) => {
      try {
        // Ensure remote description is set before adding
        if (this.peerConnection?.remoteDescription) {
          const candidate = new RTCIceCandidate(candidateInit);
          await this.peerConnection.addIceCandidate(candidate);
          return true;
        } else {
          console.warn("[WebRTC] Cannot add pending candidate: Remote description still not set.");
          // Re-queue if necessary
          const candidateJson = JSON.stringify(candidateInit);
          this.pendingCandidates.add(candidateJson);
          this.pendingCandidateObjects.push(candidateInit);
          return false;
        }
      } catch (error) {
        console.error('[WebRTC] Error adding pending ICE candidate:', error);
        return false;
      }
    });

    // Wait for all candidates to be processed
    await Promise.allSettled(addPromises);
    
    console.debug(`[WebRTC] Finished processing pending candidates. ${this.pendingCandidateObjects.length} remaining.`);
  }

  /**
   * Sends a signaling message via the AeroNyxSocket.
   * @param recipientPeerId The ID of the recipient peer.
   * @param signal The WebRTCSignal payload (offer, answer, candidate).
   */
  private async sendSignal(recipientPeerId: string, signal: WebRTCSignal): Promise<void> {
    if (!this.socket || !this.localPeerId) {
      console.error('[WebRTC] Cannot send signal: Socket or localPeerId missing.');
      throw new Error('Socket or localPeerId missing');
    }

    console.debug(`[WebRTC] Sending signal type '${signal.type}' to peer ${recipientPeerId}`);
    
    try {
      // Use the socket's method for sending WebRTC signals
      const result = await this.socket.sendWebRTCSignal(
        recipientPeerId,
        signal.type as any, // Type coercion needed due to signal.type definition
        signal
      );

      if (result === SendResult.FAILED) {
        throw new Error(`Failed to send signal type '${signal.type}' via socket.`);
      } else if (result === SendResult.QUEUED) {
        console.warn(`[WebRTC] Signal type '${signal.type}' was queued by the socket.`);
      }
    } catch (error) {
      console.error(`[WebRTC] Error sending signal type '${signal.type}':`, error);
      
      this.emitError({
        type: 'signaling',
        message: 'Failed to send signal',
        details: error,
        recoverable: true
      });
      
      throw error;
    }
  }

  /**
   * Sends an application message over the encrypted data channel.
   * @param message The application message object to send.
   * @param options Optional configuration for message sending
   * @returns Promise resolving to true if sent successfully, false otherwise.
   */
  async sendMessage(
    message: any, 
    options: { 
      priority?: 'high' | 'normal' | 'low',
      queueIfUnavailable?: boolean 
    } = {}
  ): Promise<boolean> {
    const { priority = 'normal', queueIfUnavailable = true } = options;
    
    // Queue message if data channel not ready
    if (!this.isDataChannelOpen()) {
      if (queueIfUnavailable && this.connectionState !== 'failed' && this.connectionState !== 'closed') {
        console.log('[WebRTC] Data channel not open. Queuing message.');
        this.messageQueue.push({
          message,
          timestamp: Date.now()
        });
        return true; // Message queued
      } else {
        console.warn('[WebRTC] Cannot send P2P message: Data channel not open.');
        return false;
      }
    }

    if (!this.dataChannel) return false;

    try {
      let payloadToSend: string;
      
      if (this.p2pEncryptionKey) {
        // Encrypt the message
        console.debug('[WebRTC] Encrypting P2P message...');
        const messageString = JSON.stringify(message);
        
        // Generate nonce or use the provided one
        const nonce = await generateNonce();
        
        // Encrypt the message
        const { ciphertext, nonce: usedNonce } = await encryptWithAesGcm(messageString, this.p2pEncryptionKey, nonce);
        
        // Prepare envelope with encryption metadata
        const envelope: EncryptedMessageEnvelope = {
          type: 'encrypted',
          nonce: Array.from(usedNonce),
          encrypted: Array.from(ciphertext),
          counter: this.p2pMessageCounter++,
          timestamp: Date.now()
        };
        
        payloadToSend = JSON.stringify(envelope);
        console.debug('[WebRTC] P2P message encrypted.');
      } else {
        // Send unencrypted
        if (this.config.enableEncryption) {
          console.warn('[WebRTC] Encryption enabled but no key available. Sending unencrypted message.');
        } else {
          console.debug('[WebRTC] Sending P2P message unencrypted (encryption not enabled).');
        }
        payloadToSend = JSON.stringify(message);
      }

      // Check buffer threshold based on priority
      const threshold = this.config.bufferThreshold || 16 * 1024 * 1024;
      const priorityFactor = priority === 'high' ? 0.8 : (priority === 'low' ? 0.3 : 0.5);
      const effectiveThreshold = threshold * priorityFactor;
      
      if (this.dataChannel.bufferedAmount > effectiveThreshold) {
        console.warn(`[WebRTC] Data channel buffer high (${this.dataChannel.bufferedAmount} bytes). Implementing backpressure.`);
        
        // Implement backpressure using Promise
        await new Promise<void>((resolve, reject) => {
          const checkBuffer = () => {
            if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
              reject(new Error('Data channel closed while waiting for buffer to clear'));
              return;
            }
            
            if (this.dataChannel.bufferedAmount < effectiveThreshold / 2) {
              resolve();
            } else {
              setTimeout(checkBuffer, 50);
            }
          };
          
          checkBuffer();
        });
        
        // Recheck data channel after waiting
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
          console.error("[WebRTC] Data channel closed while waiting for buffer to clear.");
          return false;
        }
      }

      // Send the message
      this.dataChannel.send(payloadToSend);
      console.debug('[WebRTC] P2P message sent successfully.');
      return true;
    } catch (error) {
      console.error('[WebRTC] Error sending P2P message:', error);
      
      this.emitError({
        type: 'dataChannel',
        message: 'Failed to send P2P message',
        details: error,
        recoverable: true
      });
      
      return false;
    }
  }

  /**
   * Sets the internal connection state and emits an event with thread safety.
   * @param state The new connection state.
   */
  private async setConnectionState(state: ConnectionState): Promise<void> {
    // Create a safe promise chain to prevent race conditions
    this.stateTransitionLock = this.stateTransitionLock.then(async () => {
      if (this.connectionState !== state) {
        console.log(`[WebRTC] P2P Connection state changed: ${this.connectionState} -> ${state}`);
        this.connectionState = state;
        this.emit('connectionStateChanged', state);
      }
    }).catch(err => {
      console.error('[WebRTC] Error during state transition:', err);
    });
    
    await this.stateTransitionLock;
  }

  /**
   * Closes the peer connection and cleans up associated resources
   */
  private cleanupPeerConnection(): void {
    if (this.dataChannel) {
      try { 
        this.dataChannel.onopen = null;
        this.dataChannel.onclose = null;
        this.dataChannel.onerror = null;
        this.dataChannel.onmessage = null;
        this.dataChannel.close(); 
      } catch (e) {}
      this.dataChannel = null;
    }
    
    if (this.peerConnection) {
      try {
        this.peerConnection.onconnectionstatechange = null;
        this.peerConnection.oniceconnectionstatechange = null;
        this.peerConnection.onicegatheringstatechange = null;
        this.peerConnection.onicecandidate = null;
        this.peerConnection.ondatachannel = null;
        this.peerConnection.onnegotiationneeded = null;
        this.peerConnection.close();
      } catch (e) {}
      this.peerConnection = null;
    }
  }

  /**
   * Closes the WebRTC connection and cleans up resources.
   */
  disconnect(): void {
    console.log('[WebRTC] Disconnecting P2P connection...');
    
    this.cleanupPeerConnection();
    
    if (this.socket) {
      // Remove listeners specific to this P2P connection
      this.socket.off('webrtcSignal', this.handleSignalingMessage);
      this.socket.off('disconnected', this.handleSocketDisconnect);
      this.socket = null;
    }
    
    this.localPeerId = null;
    this.p2pEncryptionKey = null;
    
    this.setConnectionState('closed')
      .then(() => console.log('[WebRTC] P2P connection disconnected.'))
      .catch(err => console.error('[WebRTC] Error setting closed state:', err));
  }

  /**
   * Gets the current P2P connection state.
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Checks if the P2P data channel is open and ready for sending.
   */
  public isDataChannelOpen(): boolean {
    return !!this.dataChannel && this.dataChannel.readyState === 'open';
  }

  /**
   * Gets the remote peer ID.
   */
  public getRemotePeerId(): string | null {
    return this.remotePeerId;
  }

  /**
   * Gets the remaining buffer amount in the data channel (bytes).
   * Useful for flow control and backpressure monitoring.
   */
  public getBufferedAmount(): number {
    return this.dataChannel?.bufferedAmount || 0;
  }

  /**
   * Gets encryption status to inform UI
   */
  public isEncryptionEnabled(): boolean {
    return !!this.p2pEncryptionKey;
  }
}
