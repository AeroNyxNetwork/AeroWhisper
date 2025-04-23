// src/lib/webrtc.ts

/**
* AeroNyx Client Development Guidelines
* =====================================
* 
* Encryption Algorithm Requirements
* ---------------------------------
* When implementing the AeroNyx client, pay close attention to encryption algorithm naming.
* 
* Server expects: aes256gcm
* NOT: aes-gcm, AES-GCM, or other variations
* 
* The server recognizes:
* - `aes256gcm` (preferred)
* - `aesgcm`
* - `aes`
* 
* For consistency, always use `aes256gcm` in all client code.
* 
* Implementation Examples
* ----------------------
* 
* 1. Authentication Request:
* 
* ```
* const authRequest = {
*   type: "Auth",
*   public_key: publicKey,
*   version: "1.0",
*   features: ["aes256gcm", "chacha20poly1305", "webrtc"],
*   encryption_algorithm: "aes256gcm", // Correct format
*   nonce: generateRandomNonce()
* };
* ```
* 
* 2. Data Packet Format:
* 
* ```
* const packet = {
*   type: "Data",
*   encrypted: Array.from(encrypted),
*   nonce: Array.from(nonce),
*   counter: counter,
*   encryption_algorithm: "aes256gcm" // Must include correct algorithm name
* };
* ```
* 
* 3. Handling Server Response:
* 
* ```
* function handleIpAssign(response) {
*   const { encryption_algorithm } = response;
*   // Store exactly as received from server
*   sessionStore.setEncryptionAlgorithm(encryption_algorithm);
* }
* ```
* 
* Common Issues
* ------------
* 
* 1. Using incorrect algorithm name format (`aes-gcm` vs `aes256gcm`)
* 2. Not including algorithm field in data packets
* 3. Not preserving algorithm name from server response
* 4. Inconsistent algorithm naming across client codebase
*/
import { EventEmitter } from 'events';
import { AeroNyxSocket } from './socket';
import * as bs58 from 'bs58';
import { encryptWithAesGcm, decryptWithAesGcm, generateNonce } from '../utils/cryptoUtils';

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
 * Configuration options for WebRTC connections
 */
export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize?: number;
  bundlePolicy?: RTCBundlePolicy;
  iceTransportPolicy?: RTCIceTransportPolicy;
  sdpSemantics?: 'unified-plan' | 'plan-b';
  reconnectAttempts?: number;
  reconnectInterval?: number;
  dataChannelOptions?: RTCDataChannelInit;
}

// Default configuration for WebRTC connections
const DEFAULT_CONFIG: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // Add fallback STUN servers
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    // You could add TURN servers here for better connectivity through firewalls
    // Example: { urls: 'turn:your-turn-server.com', username: 'username', credential: 'password' }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  reconnectAttempts: 5,
  reconnectInterval: 2000,
  dataChannelOptions: {
    ordered: true,       // Guarantee message order
    maxRetransmits: 3,   // Retry failed messages 3 times
  }
};

/**
 * WebRTCManager - Manages peer-to-peer connections with advanced error handling
 * and connection state management
 */
export class WebRTCManager extends EventEmitter {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private sessionKey: Uint8Array | null = null;
  private socket: AeroNyxSocket | null = null;
  private remotePeerId: string | null = null;
  private connectionState: ConnectionState = 'new';
  private config: WebRTCConfig;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isInitiator: boolean = false;
  private pendingCandidates: RTCIceCandidate[] = [];
  private channelLabel: string = 'chat';
  private isReconnecting: boolean = false;
  private queuedMessages: Array<{ data: any, attempts: number }> = [];
  private maxQueueSize: number = 100;
  private remoteDescriptionSet: boolean = false;
  private processedMessageIds: Set<string> = new Set(); // For preventing replay attacks
  private messageCounter: number = 0; // Message counter for replay protection
  
  /**
   * Create a new WebRTC manager
   * @param config - Optional configuration for WebRTC
   */
  constructor(config?: Partial<WebRTCConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Set max listeners to avoid Node.js warning
    this.setMaxListeners(20);
  }
  
  /**
   * Initialize with the signaling server (AeroNyx socket)
   * @param socket - The signaling socket
   * @param sessionKey - Encryption key for the session
   */
  initialize(socket: AeroNyxSocket, sessionKey: Uint8Array): void {
    this.socket = socket;
    this.sessionKey = sessionKey;
    
    // Clear any existing state
    this.reset();
    
    // Handle incoming signaling messages
    socket.on('data', (data: any) => {
      if (data.type === 'webrtc-signal') {
        this.handleSignalingMessage(data.signal, data.sender);
      }
    });
    
    // Handle WebRTC signaling events
    socket.on('webrtcSignal', (data: any) => {
      if (data.recipient === this.remotePeerId || !this.remotePeerId) {
        this.handleSignalingMessage(data.signal, data.sender);
      }
    });
    
    // Gracefully handle socket disconnects
    socket.on('disconnected', () => {
      this.handleSocketDisconnect();
    });
    
    this.setConnectionState('new');
    console.log('[WebRTC] Initialized with signaling server');
  }
  
  /**
   * Handle socket disconnection
   */
  private handleSocketDisconnect(): void {
    console.log('[WebRTC] Signaling socket disconnected');
    
    if (this.connectionState === 'connected') {
      // If we're connected via WebRTC, we can continue without signaling
      console.log('[WebRTC] P2P connection remains active without signaling');
    } else if (this.connectionState === 'connecting') {
      // If connecting, signal that connection attempt may fail
      this.emit('error', {
        type: 'signaling',
        message: 'Signaling server disconnected during connection setup',
        recoverable: true
      });
    }
  }
  
  /**
   * Reset the connection state
   */
  private reset(): void {
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (e) {
        // Ignore errors closing data channel
      }
      this.dataChannel = null;
    }
    
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {
        // Ignore errors closing peer connection
      }
      this.peerConnection = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    this.pendingCandidates = [];
    this.remoteDescriptionSet = false;
    this.setConnectionState('new');
  }
  
  /**
   * Create a new peer connection to initiate the connection
   * @param peerId - ID of the peer to connect to
   */
  async connectToPeer(peerId: string): Promise<void> {
    if (!this.socket || !this.sessionKey) {
      throw new Error('WebRTC manager not initialized. Call initialize() first');
    }
    
    // Clean up any existing connections
    this.cleanupConnection();
    
    this.remotePeerId = peerId;
    this.isInitiator = true;
    this.setConnectionState('connecting');
    
    try {
      // Create RTCPeerConnection
      this.peerConnection = new RTCPeerConnection({
        iceServers: this.config.iceServers,
        iceCandidatePoolSize: this.config.iceCandidatePoolSize,
        bundlePolicy: this.config.bundlePolicy,
      });
      
      this.setupPeerConnectionHandlers();
      
      // Create data channel
      this.dataChannel = this.peerConnection.createDataChannel(
        this.channelLabel, 
        this.config.dataChannelOptions
      );
      
      this.setupDataChannel();
      
      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      this.sendSignal(peerId, {
        type: 'offer',
        sdp: offer.sdp,
      });
      
      // Log success
      console.log(`[WebRTC] Connection attempt initiated to peer: ${peerId}`);
    } catch (error) {
      this.setConnectionState('failed');
      console.error('[WebRTC] Error creating connection:', error);
      
      this.emit('error', {
        type: 'connection',
        message: 'Failed to create peer connection',
        details: error instanceof Error ? error.message : String(error),
        recoverable: true
      });
      
      throw error;
    }
  }
  
  /**
   * Set up event handlers for peer connection
   */
  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;
    
    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        this.setConnectionState(this.peerConnection.connectionState as ConnectionState);
        
        // If connection fails, retry if appropriate
        if (this.peerConnection.connectionState === 'failed' || 
            this.peerConnection.connectionState === 'disconnected') {
          this.handleConnectionFailure();
        }
      }
    };
    
    // Handle ICE connection state changes for more detailed connection monitoring
    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.peerConnection) {
        console.log(`[WebRTC] ICE connection state: ${this.peerConnection.iceConnectionState}`);
        
        if (this.peerConnection.iceConnectionState === 'failed') {
          // ICE failures are more specific than general connection failures
          this.handleIceFailure();
        } else if (this.peerConnection.iceConnectionState === 'disconnected') {
          // Connection may recover from disconnected state
          console.log('[WebRTC] ICE disconnected - may recover automatically');
        }
      }
    };
    
    // Handle ICE gathering state changes for debugging
    this.peerConnection.onicegatheringstatechange = () => {
      if (this.peerConnection) {
        console.log(`[WebRTC] ICE gathering state: ${this.peerConnection.iceGatheringState}`);
      }
    };
    
    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.socket && this.remotePeerId) {
        try {
          this.sendSignal(this.remotePeerId, {
            type: 'ice-candidate',
            candidate: event.candidate,
          });
          
          this.emit('iceCandidate', event.candidate);
        } catch (error) {
          console.error('[WebRTC] Error sending ICE candidate:', error);
        }
      } else if (event.candidate === null) {
        console.log('[WebRTC] ICE candidate gathering complete');
      }
    };
    
    // Handle incoming data channels
    this.peerConnection.ondatachannel = (event) => {
      console.log('[WebRTC] Received data channel:', event.channel.label);
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };
    
    // Handle negotiation needed events
    this.peerConnection.onnegotiationneeded = async () => {
      console.log('[WebRTC] Negotiation needed');
      this.emit('negotiationNeeded');
      
      // If we're the initiator, create a new offer
      if (this.isInitiator && this.peerConnection && this.remotePeerId) {
        try {
          const offer = await this.peerConnection.createOffer();
          await this.peerConnection.setLocalDescription(offer);
          
          this.sendSignal(this.remotePeerId, {
            type: 'offer',
            sdp: offer.sdp,
          });
        } catch (error) {
          console.error('[WebRTC] Error during renegotiation:', error);
          this.emit('error', {
            type: 'negotiation',
            message: 'Failed to create offer during renegotiation',
            details: error instanceof Error ? error.message : String(error),
            recoverable: true
          });
        }
      }
    };
  }
  
  /**
   * Set up the data channel event handlers
   */
  private setupDataChannel(): void {
    if (!this.dataChannel) return;
    
    // When data channel opens
    this.dataChannel.onopen = () => {
      console.log('[WebRTC] Data channel opened');
      this.setConnectionState('connected');
      this.emit('dataChannelOpen');
      
      // Send any queued messages
      this.sendQueuedMessages();
    };
    
    // When data channel closes
    this.dataChannel.onclose = () => {
      console.log('[WebRTC] Data channel closed');
      
      // Only trigger disconnected state if we're actually connected
      // This prevents double state changes with the connection state handler
      if (this.connectionState === 'connected') {
        this.setConnectionState('disconnected');
      }
      
      this.emit('dataChannelClose');
      
      // Try to reopen the data channel if appropriate
      this.handleDataChannelClose();
    };
    
    // Handle data channel errors
    this.dataChannel.onerror = (error) => {
      console.error('[WebRTC] Data channel error:', error);
      this.emit('error', {
        type: 'dataChannel',
        message: 'Data channel encountered an error',
        details: error.toString(),
        recoverable: true
      });
    };
    
    // Handle incoming messages
    this.dataChannel.onmessage = async (event) => {
      try {
        // Parse the incoming message
        const message = JSON.parse(event.data);
        
        // Process with our aes256gcm handler
        if (this.sessionKey) {
          const decryptedData = await this.processEncryptedMessage(message, this.sessionKey);
          if (decryptedData) {
            this.processDecryptedMessage(decryptedData);
          }
        } else {
          console.warn('[WebRTC] Cannot decrypt message: No session key available');
        }
      } catch (error) {
        console.error('[WebRTC] Error processing message:', error);
        this.emit('error', {
          type: 'parsing',
          message: 'Failed to parse received message',
          details: error instanceof Error ? error.message : String(error),
          recoverable: true
        });
      }
    };
    
    // Buffer amount low event - for flow control
    this.dataChannel.onbufferedamountlow = () => {
      // Resume sending if we were paused due to buffer full
      this.sendQueuedMessages();
    };
  }
  
  /**
   * Handle the closure of a data channel
   */
  private handleDataChannelClose(): void {
    console.log('[WebRTC] Data channel closed, attempting to reestablish if appropriate');
    
    // Only attempt to reestablish if we're the initiator and still in a connected state
    if (this.isInitiator && this.peerConnection && this.connectionState === 'connected') {
      try {
        // Create a new data channel
        this.dataChannel = this.peerConnection.createDataChannel(
          this.channelLabel, 
          this.config.dataChannelOptions
        );
        
        console.log('[WebRTC] Recreated data channel after closure');
        this.setupDataChannel();
      } catch (error) {
        console.error('[WebRTC] Failed to recreate data channel:', error);
        
        // If we can't recreate the data channel, mark the connection as having an issue
        if (this.connectionState === 'connected') {
          this.setConnectionState('disconnected');
          this.handleConnectionFailure();
        }
      }
    } else if (this.connectionState === 'connected') {
      // If we're not the initiator but still connected, wait for the other peer to recreate the channel
      console.log('[WebRTC] Waiting for initiator to recreate data channel');
    }
  }
  
  /**
   * Process decrypted message
   * @param data The parsed message
   */
  private processDecryptedMessage(data: any): void {
    // Check for message ID to prevent replay attacks
    if (data.id && this.processedMessageIds.has(data.id)) {
      console.warn('[WebRTC] Detected message replay attempt, ignoring');
      return;
    }
    
    // Store message ID to prevent replay attacks
    if (data.id) {
      this.processedMessageIds.add(data.id);
      
      // Limit the size of the set
      if (this.processedMessageIds.size > 10000) {
        const oldestId = this.processedMessageIds.values().next().value;
        this.processedMessageIds.delete(oldestId);
      }
    }
    
    // Emit event based on message type
    if (data.type === 'message') {
      this.emit('message', {
        id: data.id || `p2p-msg-${Date.now()}`,
        content: data.content,
        senderId: data.senderId,
        senderName: data.senderName || 'Unknown',
        timestamp: data.timestamp || new Date().toISOString(),
        isEncrypted: true,
        metaData: {
          encryptionType: 'P2P',
          isP2P: true
        }
      });
    } else {
      // For other types, just forward the data
      this.emit('data', data);
    }
  }
  
  /**
   * Handle ICE connection failures
   */
  private handleIceFailure(): void {
    console.log('[WebRTC] ICE connection failed, attempting recovery');
    
    // ICE failures can sometimes be recovered by restarting ICE
    if (this.peerConnection && this.remotePeerId) {
      try {
        // Check if restartIce is supported
        if (this.peerConnection.restartIce) {
          this.peerConnection.restartIce();
          console.log('[WebRTC] ICE restart initiated');
        } else {
          // If restartIce is not supported, create a new offer with ICE restart flag
          this.renegotiateWithIceRestart();
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
   * Renegotiate with ICE restart for browsers without restartIce method
   */
  private async renegotiateWithIceRestart(): Promise<void> {
    if (!this.peerConnection || !this.remotePeerId) return;
    
    try {
      // Create a new offer with ICE restart flag
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);
      
      this.sendSignal(this.remotePeerId, {
        type: 'offer',
        sdp: offer.sdp,
      });
      
      console.log('[WebRTC] Sent new offer with ICE restart');
    } catch (error) {
      console.error('[WebRTC] Failed to create offer with ICE restart:', error);
      this.handleConnectionFailure();
    }
  }
  
  /**
   * Handle general connection failures
   */
  private handleConnectionFailure(): void {
    // If we're already reconnecting, don't start another attempt
    if (this.isReconnecting) return;
    
    // Check if we've exceeded the max reconnect attempts
    if (this.reconnectAttempts >= (this.config.reconnectAttempts || 5)) {
      console.log('[WebRTC] Max reconnection attempts reached, giving up');
      this.setConnectionState('failed');
      this.emit('error', {
        type: 'connection',
        message: `Failed to reconnect after ${this.reconnectAttempts} attempts`,
        recoverable: false
      });
      return;
    }
    
    // Start reconnection procedure
    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    console.log(`[WebRTC] Connection failure, attempting reconnect (${this.reconnectAttempts}/${this.config.reconnectAttempts})`);
    
    // Schedule reconnection attempt
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectTimer = setTimeout(() => {
      this.attemptReconnection();
    }, this.config.reconnectInterval);
  }
  
  /**
   * Attempt to reconnect to the peer
   */
  private async attemptReconnection(): Promise<void> {
    if (!this.remotePeerId) {
      this.isReconnecting = false;
      return;
    }
    
    console.log(`[WebRTC] Attempting to reconnect to peer: ${this.remotePeerId}`);
    
    // Clean up existing connection
    this.cleanupConnection(false);
    
    // Create a new connection
    try {
      await this.connectToPeer(this.remotePeerId);
      this.isReconnecting = false;
    } catch (error) {
      console.error('[WebRTC] Reconnection attempt failed:', error);
      
      // If we haven't reached max attempts, schedule another try
      if (this.reconnectAttempts < (this.config.reconnectAttempts || 5)) {
        this.reconnectTimer = setTimeout(() => {
          this.attemptReconnection();
        }, this.config.reconnectInterval);
      } else {
        this.isReconnecting = false;
        this.setConnectionState('failed');
      }
    }
  }
  
  /**
   * Clean up the existing connection
   * @param resetState - Whether to reset the connection state (default: true)
   */
  private cleanupConnection(resetState: boolean = true): void {
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (e) {
        // Ignore errors closing data channel
      }
      this.dataChannel = null;
    }
    
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {
        // Ignore errors closing peer connection
      }
      this.peerConnection = null;
    }
    
    // Keep previous state for reconnection attempts
    if (resetState) {
      this.reset();
    }
  }
  
  /**
   * Handle incoming WebRTC signaling messages
   * @param signal - The signaling message
   * @param sender - ID of the sender
   */
  private async handleSignalingMessage(signal: any, sender: string): Promise<void> {
    if (!this.sessionKey) {
      console.error('[WebRTC] Cannot handle signaling message: No session key');
      return;
    }
    
    try {
      // If this is a new connection request (offer)
      if (signal.type === 'offer') {
        await this.handleOfferMessage(signal, sender);
      }
      // If this is an answer to our offer
      else if (signal.type === 'answer' && this.peerConnection) {
        await this.handleAnswerMessage(signal);
      }
      // If this is an ICE candidate
      else if (signal.type === 'ice-candidate' && this.peerConnection) {
        await this.handleIceCandidateMessage(signal);
      }
    } catch (error) {
      console.error('[WebRTC] Error handling signaling message:', error);
      this.emit('error', {
        type: 'signaling',
        message: 'Failed to process signaling message',
        details: error instanceof Error ? error.message : String(error),
        recoverable: true
      });
    }
  }
  
  /**
   * Handle an offer message from another peer
   * @param signal - The offer message
   * @param sender - ID of the sender
   */
  private async handleOfferMessage(signal: any, sender: string): Promise<void> {
    this.remotePeerId = sender;
    this.isInitiator = false;
    this.setConnectionState('connecting');
    
    // Create new peer connection if needed
    if (!this.peerConnection) {
      this.peerConnection = new RTCPeerConnection({
        iceServers: this.config.iceServers,
        iceCandidatePoolSize: this.config.iceCandidatePoolSize,
        bundlePolicy: this.config.bundlePolicy,
      });
      
      this.setupPeerConnectionHandlers();
      
      // Handle incoming data channels
      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel();
      };
    }
    
    try {
      // Set remote description (the offer)
      await this.peerConnection.setRemoteDescription({
        type: 'offer',
        sdp: signal.sdp,
      });
      
      this.remoteDescriptionSet = true;
      
      // Add any pending ICE candidates
      this.addPendingCandidates();
      
      // Create and send answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      this.sendSignal(sender, {
        type: 'answer',
        sdp: answer.sdp,
      });
      
      console.log(`[WebRTC] Sent answer to peer: ${sender}`);
    } catch (error) {
      console.error('[WebRTC] Error handling offer:', error);
      
      this.setConnectionState('failed');
      this.emit('error', {
        type: 'signaling',
        message: 'Failed to process offer',
        details: error instanceof Error ? error.message : String(error),
        recoverable: true
      });
      
      throw error;
    }
  }
  
  /**
   * Handle an answer message from the peer
   * @param signal - The answer message
   */
  private async handleAnswerMessage(signal: any): Promise<void> {
    try {
      await this.peerConnection!.setRemoteDescription({
        type: 'answer',
        sdp: signal.sdp,
      });
      
      this.remoteDescriptionSet = true;
      
      // Add any pending ICE candidates
      this.addPendingCandidates();
      
      console.log('[WebRTC] Applied remote description (answer)');
    } catch (error) {
      console.error('[WebRTC] Error handling answer:', error);
      
      this.emit('error', {
        type: 'signaling',
        message: 'Failed to process answer',
        details: error instanceof Error ? error.message : String(error),
        recoverable: true
      });
      
      // If we can't set the remote description, the connection might fail
      // Let the connection state handler deal with the failure
    }
  }
  
  /**
   * Handle an ICE candidate message from the peer
   * @param signal - The ICE candidate message
   */
  private async handleIceCandidateMessage(signal: any): Promise<void> {
    try {
      const candidate = new RTCIceCandidate(signal.candidate);
      
      // If remote description is not set yet, queue the candidate
      if (!this.remoteDescriptionSet) {
        console.log('[WebRTC] Queuing ICE candidate until remote description is set');
        this.pendingCandidates.push(candidate);
        return;
      }
      
      // Add the candidate to the peer connection
      await this.peerConnection!.addIceCandidate(candidate);
      console.log('[WebRTC] Added ICE candidate');
    } catch (error) {
      console.error('[WebRTC] Error handling ICE candidate:', error);
      
      this.emit('error', {
        type: 'signaling',
        message: 'Failed to process ICE candidate',
        details: error instanceof Error ? error.message : String(error),
        recoverable: true
      });
    }
  }
  
  /**
   * Add any pending ICE candidates after remote description is set
   */
  private async addPendingCandidates(): Promise<void> {
    if (!this.peerConnection || !this.remoteDescriptionSet || this.pendingCandidates.length === 0) {
      return;
    }
    
    console.log(`[WebRTC] Adding ${this.pendingCandidates.length} pending ICE candidates`);
    
    for (const candidate of this.pendingCandidates) {
      try {
        await this.peerConnection.addIceCandidate(candidate);
      } catch (error) {
        console.error('[WebRTC] Error adding pending ICE candidate:', error);
      }
    }
    
    // Clear the pending candidates
    this.pendingCandidates = [];
  }
  
  /**
   * Send a WebRTC signaling message through the AeroNyx server
   * @param recipient - ID of the recipient
   * @param signal - The signaling message to send
   */
  private sendSignal(recipient: string, signal: any): void {
    if (!this.socket || !this.sessionKey) {
      console.error('[WebRTC] Cannot send signal: No socket or session key');
      return;
    }
    
    this.socket.send({
      type: 'webrtc-signal',
      recipient,
      signal,
    });
  }

  /**
   * Send a message through the WebRTC data channel with aes256gcm encryption
   * @param message - The message to send
   * @param maxAttempts - Maximum number of retry attempts if sending fails
   * @returns true if sent successfully, false otherwise
   */
  async sendMessage(message: any, maxAttempts: number = 3): Promise<boolean> {
    console.debug('[WebRTC:SEND] Sending message attempt:', {
      dataChannelState: this.dataChannel?.readyState || 'none',
      messageType: message.type || 'unknown',
      messageId: message.id || 'none',
      hasSessionKey: !!this.sessionKey,
      sessionKeyLength: this.sessionKey?.length || 0,
      maxAttempts
    });
  
    // If not connected, queue message and return false
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.debug('[WebRTC:SEND] Data channel not open, queueing message');
      this.queueMessage(message, maxAttempts);
      return false;
    }
    
    if (this.sessionKey) {
      console.debug('[WebRTC:SEND] Session key available, proceeding with encryption');
      return await this.sendEncryptedMessage(
        message, 
        this.sessionKey, 
        this.dataChannel,
        this.messageCounter++
      );
    } else {
      console.error('[WebRTC:SEND] Cannot send message: No session key available');
      return false;
    }
  }

  
  /**
   * Send a message through the WebRTC data channel with aes256gcm encryption
   * @param message - The message to send
   * @param sessionKey - The encryption key
   * @param dataChannel - The WebRTC data channel
   * @param messageCounter - Counter for replay protection
   * @returns true if sent successfully, false otherwise
   */
  private async sendEncryptedMessage(
    message: any,
    sessionKey: Uint8Array,
    dataChannel: RTCDataChannel,
    messageCounter: number
  ): Promise<boolean> {
    if (dataChannel.readyState !== 'open') {
      console.error('[WebRTC:SEND:ENCRYPTED] Cannot send message: Data channel not open');
      return false;
    }
    
    try {
      if (!sessionKey || sessionKey.length !== 32) {
        throw new Error(`Invalid session key: length=${sessionKey?.length ?? 'null'} (expected 32 bytes)`);
      }
      
      // Prepare the message for encryption
      const messageString = JSON.stringify(message);
      
      // Encrypt with AES-GCM
      console.debug('[WebRTC:SEND:ENCRYPTED] Encrypting message with AES-GCM');
      const { ciphertext, nonce } = await encryptWithAesGcm(messageString, sessionKey);
      
      // Create packet with the correct field naming
      const encryptedMessage = JSON.stringify({
        type: 'Data',
        encrypted: Array.from(ciphertext),
        nonce: Array.from(nonce),
        counter: messageCounter,
        encryption_algorithm: 'aes256gcm', // Server expects this format
        padding: null
      });
      
      // Send the message
      dataChannel.send(encryptedMessage);
      
      console.debug('[WebRTC:SEND:ENCRYPTED] Message sent successfully');
      return true;
    } catch (error) {
      console.error('[WebRTC:SEND:ENCRYPTED] Error sending encrypted message:', error);
      return false;
    }
  }

  /**
   * Process an encrypted message received through WebRTC
   * @param encryptedData - The encrypted message data
   * @param sessionKey - The decryption key
   * @returns Decrypted message object or null if decryption fails
   */
  private async processEncryptedMessage(
    encryptedData: any,
    sessionKey: Uint8Array
  ): Promise<any | null> {
    try {
      // Validate the message format
      if (!encryptedData || !encryptedData.type || encryptedData.type !== 'Data') {
        console.warn('[WebRTC] Received message in incorrect format:', encryptedData);
        return null;
      }
      
      // Extract the encrypted data and nonce
      if (!Array.isArray(encryptedData.encrypted) || !Array.isArray(encryptedData.nonce)) {
        console.warn('[WebRTC] Missing encrypted data or nonce');
        return null;
      }
      
      // Convert arrays back to Uint8Arrays
      const encryptedUint8 = new Uint8Array(encryptedData.encrypted);
      const nonceUint8 = new Uint8Array(encryptedData.nonce);
      
      // Support both field names for backward compatibility
      let algorithm: string;
      if (encryptedData.encryption_algorithm !== undefined) {
        algorithm = encryptedData.encryption_algorithm;
      } else if (encryptedData.encryption !== undefined) {
        algorithm = encryptedData.encryption;
      } else {
        algorithm = 'aes256gcm'; // Default
      }
      
      // Log decryption attempt
      console.debug('[WebRTC] Attempting to decrypt message:', {
        encryptedLength: encryptedUint8.length,
        nonceLength: nonceUint8.length,
        counter: encryptedData.counter,
        algorithm: algorithm
      });
      
      // Decrypt with AES-GCM
      const decryptedText = await decryptWithAesGcm(
        encryptedUint8,
        nonceUint8,
        sessionKey,
        'string'
      ) as string;
      
      // Parse the decrypted JSON
      const parsedData = JSON.parse(decryptedText);
      console.log('[WebRTC] Successfully decrypted message');
      
      return parsedData;
    } catch (error) {
      console.error('[WebRTC] Failed to process encrypted message:', error);
      return null;
    }
  }
  
  /**
   * Queue a message to be sent when connection is restored
   * @param message - The message to queue
   * @param attempts - Number of remaining retry attempts
   */
  private queueMessage(message: any, attempts: number): void {
    // Limit queue size to prevent memory issues
    if (this.queuedMessages.length >= this.maxQueueSize) {
      // Remove oldest message when queue is full
      this.queuedMessages.shift();
    }
    
    this.queuedMessages.push({ data: message, attempts });
    console.log(`[WebRTC] Message queued. Total pending: ${this.queuedMessages.length}`);
  }
  
  /**
   * Send any queued messages
   */
  private sendQueuedMessages(): void {
    if (this.queuedMessages.length === 0 || 
        !this.dataChannel || 
        this.dataChannel.readyState !== 'open') {
      return;
    }
    
    console.log(`[WebRTC] Sending ${this.queuedMessages.length} queued messages`);
    
    // Process a copy of the queue to avoid modification issues during iteration
    const messages = [...this.queuedMessages];
    this.queuedMessages = [];
    
    for (const { data, attempts } of messages) {
      try {
        const success = this.sendMessage(data, attempts - 1);
        
        // If sending fails, the message will be re-queued with decremented attempts
        if (!success && attempts > 1) {
          // Re-queuing happens in sendMessage
        }
      } catch (error) {
        console.error('[WebRTC] Error sending queued message:', error);
      }
    }
  }
  
  /**
   * Close the WebRTC connection
   */
  disconnect(): void {
    console.log('[WebRTC] Disconnecting WebRTC connection');
    
    // Clear any scheduled reconnection attempts
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Close data channel
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (e) {
        // Ignore errors closing data channel
      }
      this.dataChannel = null;
    }
    
    // Close peer connection
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {
        // Ignore errors closing peer connection
      }
      this.peerConnection = null;
    }
    
    this.remotePeerId = null;
    this.setConnectionState('closed');
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.pendingCandidates = [];
    this.remoteDescriptionSet = false;
    
    // Discard pending messages
    const discardedCount = this.queuedMessages.length;
    if (discardedCount > 0) {
      console.log(`[WebRTC] Discarded ${discardedCount} queued messages on disconnect`);
      this.queuedMessages = [];
    }
  }
  
  /**
   * Set connection state and emit event
   * @param state - The new connection state
   */
  private setConnectionState(state: ConnectionState): void {
    // Only emit event if state actually changes
    if (this.connectionState !== state) {
      this.connectionState = state;
      console.log(`[WebRTC] Connection state changed to: ${state}`);
      this.emit('connectionStateChanged', state);
    }
  }
  
  /**
   * Get the current connection state
   * @returns The current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }
  
  /**
   * Check if connected directly with peer
   * @returns true if directly connected, false otherwise
   */
  isDirectlyConnected(): boolean {
    return this.connectionState === 'connected' && 
           !!this.dataChannel && 
           this.dataChannel.readyState === 'open';
  }
  
  /**
   * Get the remote peer ID
   * @returns The remote peer ID or null if not connected
   */
  getRemotePeerId(): string | null {
    return this.remotePeerId;
  }
  
  /**
   * Get statistics about the connection
   * @returns Promise resolving to RTCStatsReport
   */
  async getStats(): Promise<RTCStatsReport | null> {
    if (!this.peerConnection) return null;
    
    try {
      return await this.peerConnection.getStats();
    } catch (error) {
      console.error('[WebRTC] Error getting stats:', error);
      return null;
    }
  }
  
  /**
   * Check if the data channel is ready for sending data
   */
  isReadyToSend(): boolean {
    return !!this.dataChannel && 
           this.dataChannel.readyState === 'open' && 
           this.connectionState === 'connected';
  }
  
  /**
   * Force ICE restart to recover from network changes
   */
  restartIce(): void {
    if (this.peerConnection && this.remotePeerId && this.isInitiator) {
      try {
        this.renegotiateWithIceRestart();
      } catch (error) {
        console.error('[WebRTC] Failed to restart ICE:', error);
      }
    } else {
      console.log('[WebRTC] Cannot restart ICE: Not the initiator or no connection');
    }
  }
}
