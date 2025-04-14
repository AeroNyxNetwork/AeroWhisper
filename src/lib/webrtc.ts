import { EventEmitter } from 'events';
import { AeroNyxSocket } from './socket';
import { encryptMessage, decryptMessage } from '../utils/crypto';

type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

// Configuration for WebRTC connections
const ICE_SERVERS = [
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export class WebRTCManager extends EventEmitter {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private sessionKey: Uint8Array | null = null;
  private socket: AeroNyxSocket | null = null;
  private remotePeerId: string | null = null;
  private connectionState: ConnectionState = 'new';
  
  constructor() {
    super();
  }
  
  // Initialize with the signaling server (AeroNyx server)
  initialize(socket: AeroNyxSocket, sessionKey: Uint8Array) {
    this.socket = socket;
    this.sessionKey = sessionKey;
    
    // Handle incoming signaling messages
    socket.on('data', (data) => {
      if (data.type === 'webrtc-signal') {
        this.handleSignalingMessage(data.signal, data.sender);
      }
    });
  }
  
  // Create a new peer connection to initiate the connection
  async connectToPeer(peerId: string): Promise<void> {
    if (!this.socket || !this.sessionKey) {
      throw new Error('WebRTC manager not initialized');
    }
    
    this.remotePeerId = peerId;
    this.connectionState = 'connecting';
    this.emit('connectionStateChanged', this.connectionState);
    
    // Create RTCPeerConnection
    this.peerConnection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });
    
    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        this.connectionState = this.peerConnection.connectionState as ConnectionState;
        this.emit('connectionStateChanged', this.connectionState);
      }
    };
    
    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.socket && this.remotePeerId) {
        this.sendSignal(this.remotePeerId, {
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };
    
    // Create data channel
    this.dataChannel = this.peerConnection.createDataChannel('chat', {
      ordered: true,
    });
    
    this.setupDataChannel();
    
    // Create and send offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    
    this.sendSignal(peerId, {
      type: 'offer',
      sdp: offer.sdp,
    });
  }
  
  // Handle incoming WebRTC signaling messages
  private async handleSignalingMessage(signal: any, sender: string) {
    if (!this.sessionKey) return;
    
    try {
      // If this is a new connection request (offer)
      if (signal.type === 'offer') {
        this.remotePeerId = sender;
        this.connectionState = 'connecting';
        this.emit('connectionStateChanged', this.connectionState);
        
        // Create new peer connection if needed
        if (!this.peerConnection) {
          this.peerConnection = new RTCPeerConnection({
            iceServers: ICE_SERVERS,
          });
          
          // Handle connection state changes
          this.peerConnection.onconnectionstatechange = () => {
            if (this.peerConnection) {
              this.connectionState = this.peerConnection.connectionState as ConnectionState;
              this.emit('connectionStateChanged', this.connectionState);
            }
          };
          
          // Handle ICE candidates
          this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.socket && this.remotePeerId) {
              this.sendSignal(this.remotePeerId, {
                type: 'ice-candidate',
                candidate: event.candidate,
              });
            }
          };
          
          // Handle incoming data channels
          this.peerConnection.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.setupDataChannel();
          };
        }
        
        // Set remote description (the offer)
        await this.peerConnection.setRemoteDescription({
          type: 'offer',
          sdp: signal.sdp,
        });
        
        // Create and send answer
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        
        this.sendSignal(sender, {
          type: 'answer',
          sdp: answer.sdp,
        });
      }
      // If this is an answer to our offer
      else if (signal.type === 'answer' && this.peerConnection) {
        await this.peerConnection.setRemoteDescription({
          type: 'answer',
          sdp: signal.sdp,
        });
      }
      // If this is an ICE candidate
      else if (signal.type === 'ice-candidate' && this.peerConnection) {
        await this.peerConnection.addIceCandidate(signal.candidate);
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
      this.emit('error', error);
    }
  }
  
  // Set up the data channel event handlers
  private setupDataChannel() {
    if (!this.dataChannel) return;
    
    this.dataChannel.onopen = () => {
      this.connectionState = 'connected';
      this.emit('connectionStateChanged', this.connectionState);
    };
    
    this.dataChannel.onclose = () => {
      this.connectionState = 'disconnected';
      this.emit('connectionStateChanged', this.connectionState);
    };
    
    this.dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
      this.emit('error', error);
    };
    
    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.emit('message', message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
  }
  
  // Send a WebRTC signaling message through the AeroNyx server
  private sendSignal(recipient: string, signal: any) {
    if (!this.socket || !this.sessionKey) return;
    
    this.socket.send({
      type: 'webrtc-signal',
      recipient,
      signal,
    });
  }
  
  // Send a message through the WebRTC data channel
  sendMessage(message: any): boolean {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      return false;
    }
    
    try {
      const messageString = JSON.stringify(message);
      this.dataChannel.send(messageString);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }
  
  // Close the WebRTC connection
  disconnect() {
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    
    this.dataChannel = null;
    this.peerConnection = null;
    this.remotePeerId = null;
    this.connectionState = 'closed';
    this.emit('connectionStateChanged', this.connectionState);
  }
  
  // Get the current connection state
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }
  
  // Check if connected directly with peer
  isDirectlyConnected(): boolean {
    return this.connectionState === 'connected';
  }
  
  // Get the remote peer ID
  getRemotePeerId(): string | null {
    return this.remotePeerId;
  }
}
