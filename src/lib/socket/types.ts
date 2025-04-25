// src/lib/socket/types.ts

/**
 * Base interface for all WebSocket packets.
 */
export interface BasePacket {
  type: string;
}


export interface SocketError {
  type: 'connection' | 'auth' | 'data' | 'signaling' | 'server' | 'message' | 'internal' | 'security';
  message: string;
  code: string;
  details?: string;
  retry: boolean;
  originalError?: any;
}

export interface AuthMessage extends BasePacket {
  type: "Auth";
  public_key: string;           // Client's Ed25519 public key (Base58)
  chat_id: string;              // ID of the chat room to join
  client_version: string;       // Client version string
  protocol_version: string;     // Protocol version for backward compatibility
  version: string;              // Protocol version (required by server)
  features: string[];           // Supported features (required by server)
}
/**
 * Initial authentication message sent by the client.
 * Matches server requirements document Section 3.1.
 */
/**
 * Challenge message sent by the server in response to Auth.
 * Matches server requirements document Section 3.2.
 */
export interface ChallengeMessage extends BasePacket {
  type: "Challenge";
  id: string;                   // Unique ID for this challenge attempt
  data: number[];               // Raw challenge bytes (sent as array of numbers)
  server_key: string;           // Server's Ed25519 public key (Base58)
  expires_at: number;           // Timestamp (ms since epoch) when challenge expires
}

/**
 * Client's response to the server's challenge.
 * Matches server requirements document Section 3.3.
 */
export interface ChallengeResponse extends BasePacket {
  type: "ChallengeResponse";
  challenge_id: string;         // The ID received in the Challenge packet
  public_key: string;           // Client's Ed25519 public key again (Base58)
  signature: string;            // Ed25519 signature of challenge data (Base58)
}

/**
 * Message sent by the server upon successful authentication.
 * Contains assigned IP and the encrypted session key.
 * Matches server requirements document Section 4.2.
 */
export interface IpAssignMessage extends BasePacket {
  type: "IpAssign";
  ip_address: string;           // Assigned internal IP address
  session_id: string;           // Unique ID for this session
  encrypted_session_key: number[]; // AES-GCM encrypted 32-byte session key (as number[])
  key_nonce: number[];          // 12-byte nonce used for encrypting session key (as number[])
  encryption_algorithm: "aes256gcm"; // Confirms algorithm used for encrypted_session_key
}

/**
 * Encrypted data packet for application-level communication.
 * Matches server requirements document Section 5.
 */
export interface DataPacket extends BasePacket {
  type: "Data";
  encrypted: number[];          // Payload encrypted with AES-GCM using session key (as number[])
  nonce: number[];              // Unique 12-byte nonce for this specific packet (as number[])
  counter: number;              // Monotonically increasing counter for replay protection
  encryption_algorithm: "aes256gcm"; // MUST be included
}

/**
 * Ping message for keepalive / latency check.
 * Matches server requirements document Section 7.
 */
export interface PingMessage extends BasePacket {
  type: "Ping";
  timestamp: number;            // Timestamp (ms since epoch) when ping was sent
  sequence: number;             // Sequence number for matching Pong
}

/**
 * Pong message responding to a Ping.
 * Matches server requirements document Section 7.
 */
export interface PongMessage extends BasePacket {
  type: "Pong";
  echo_timestamp: number;       // Timestamp from the corresponding Ping message
  server_timestamp: number;     // Timestamp (ms since epoch) when server sent Pong
  sequence: number;             // Sequence number from the corresponding Ping
}

/**
 * Error message sent by the server.
 * Matches server requirements document Section 7 & 9.
 */
export interface ErrorMessage extends BasePacket {
  type: "Error";
  code: number;                 // Error code (e.g., 4xxx for auth errors)
  message: string;              // Human-readable error message
}

/**
 * Disconnect message sent by server or client.
 * Matches server requirements document Section 7.
 */
export interface DisconnectMessage extends BasePacket {
  type: "Disconnect";
  reason: number;               // Close code (e.g., 1000 for normal closure, 4xxx for errors)
  message: string;              // Optional human-readable reason
}

/**
 * Chat message type for application layer communication
 */
export interface MessageType {
  id: string;                   // Unique message identifier
  content: string;              // Message content
  senderId: string;             // ID of the message sender
  senderName: string;           // Display name of the sender
  timestamp: string;            // ISO 8601 timestamp
  isEncrypted?: boolean;        // Whether the content is encrypted
  status?: 'sending' | 'sent' | 'delivered' | 'failed' | 'received'; // Message delivery status
}

/**
 * Participant information
 */
export interface Participant {
  id: string;                   // Unique identifier
  name: string;                 // Display name
  publicKey: string;            // Public key (Base58 encoded)
  status: 'online' | 'offline' | 'away'; // Connection status
  lastActive?: string;          // Last activity timestamp (ISO 8601)
  isTyping?: boolean;           // Whether participant is currently typing
}

/**
 * Chat room information
 */
export interface ChatInfo {
  id: string;                   // Unique chat identifier
  name: string;                 // Chat name/title
  createdBy: string;            // ID of creator
  createdAt: string;            // Creation timestamp (ISO 8601)
  participantCount: number;     // Number of participants
  useP2P: boolean;              // Whether WebRTC P2P should be used
  maxParticipants?: number;     // Maximum allowed participants
  isEncrypted: boolean;         // Whether E2E encryption is enabled
  metadata?: Record<string, any>; // Additional chat properties
}

// --- Application-Level Payloads ---

/**
 * Structure for chat message payload
 */
export interface MessagePayload extends BasePacket {
  type: 'message';
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: string;
  isEncrypted?: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'failed' | 'received';
}

/**
 * Structure for chat info payload
 */
export interface ChatInfoPayload extends BasePacket {
  type: 'chatInfo';
  data: ChatInfo;
}

/**
 * Structure for participants list payload
 */
export interface ParticipantsPayload extends BasePacket {
  type: 'participants';
  data: Participant[];
}

/**
 * Structure for WebRTC signaling payloads
 */
export interface WebRTCSignalPayload extends BasePacket {
  type: 'webrtc-signal';
  peerId: string;                // Target peer ID for the signal
  signalType: 'offer' | 'answer' | 'candidate'; // Signal type
  signalData: any;               // SDP or ICE candidate data
  timestamp: number;             // Message timestamp
}

/**
 * Structure for Key Rotation Request
 */
export interface KeyRotationRequestPayload extends BasePacket {
  type: 'request-key-rotation';
  sessionId: string;             // Current session ID
  timestamp: number;             // Request timestamp
}

/**
 * Structure for Key Rotation Response
 */
export interface KeyRotationResponsePayload extends BasePacket {
  type: 'key-rotation-response';
  rotation_id: string;           // ID from the request
  encrypted_key?: number[];      // New encrypted session key (if applicable)
  key_nonce?: number[];          // Nonce for encrypted key
  status: 'success' | 'failure';
  message?: string;              // Optional status message
}

// --- Type Guards ---

/**
 * Type guard for MessageType objects
 */
export function isMessageType(payload: any): payload is MessagePayload {
  return (
    payload &&
    payload.type === 'message' &&
    typeof payload.id === 'string' &&
    typeof payload.content === 'string' &&
    typeof payload.senderId === 'string' &&
    typeof payload.timestamp === 'string'
  );
}

/**
 * Type guard for ChatInfoPayload objects
 */
export function isChatInfoPayload(payload: any): payload is ChatInfoPayload {
  return (
    payload &&
    payload.type === 'chatInfo' &&
    payload.data &&
    typeof payload.data.id === 'string'
  );
}

/**
 * Type guard for ParticipantsPayload objects
 */
export function isParticipantsPayload(payload: any): payload is ParticipantsPayload {
  return (
    payload &&
    payload.type === 'participants' &&
    Array.isArray(payload.data)
  );
}

/**
 * Type guard for WebRTCSignalPayload objects
 */
export function isWebRTCSignalPayload(payload: any): payload is WebRTCSignalPayload {
  return (
    payload &&
    payload.type === 'webrtc-signal' &&
    typeof payload.peerId === 'string' &&
    ['offer', 'answer', 'candidate'].includes(payload.signalType) &&
    payload.signalData !== undefined
  );
}

/**
 * Type guard for KeyRotationRequestPayload objects
 */
export function isKeyRotationRequestPayload(payload: any): payload is KeyRotationRequestPayload {
  return (
    payload &&
    payload.type === 'request-key-rotation' &&
    typeof payload.sessionId === 'string' &&
    typeof payload.timestamp === 'number'
  );
}

/**
 * Type guard for KeyRotationResponsePayload objects
 */
export function isKeyRotationResponsePayload(payload: any): payload is KeyRotationResponsePayload {
  return (
    payload &&
    payload.type === 'key-rotation-response' &&
    typeof payload.rotation_id === 'string' &&
    typeof payload.status === 'string'
  );
}

// Union type for all possible incoming WebSocket message types (after JSON parsing)
export type ReceivedPacket =
  | ChallengeMessage
  | IpAssignMessage
  | DataPacket
  | PingMessage
  | PongMessage
  | ErrorMessage
  | DisconnectMessage;

// Union type for known application-level payload types (after decryption)
export type DecryptedPayload =
  | MessagePayload
  | ChatInfoPayload
  | ParticipantsPayload
  | WebRTCSignalPayload
  | KeyRotationRequestPayload
  | KeyRotationResponsePayload;
