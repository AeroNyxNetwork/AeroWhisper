// src/lib/socket/types.ts - FIXED VERSION
// Core message types that match server specifications with both camelCase and snake_case variants

/**
 * Base interface for all WebSocket packets.
 */
export interface BasePacket {
  type: string;
}

export interface DataEnvelope {
  payload_type: 'Json';  // Matches server expectation
  payload: any;         // The actual message payload
}

/**
 * Socket error types used within AeroNyxSocket and emitted.
 */
export interface SocketError {
  type: 'connection' | 'auth' | 'data' | 'signaling' | 'server' | 'message' | 'internal' | 'security';
  message: string;
  code: string; // Custom error code (e.g., 'AUTH_FAILED', 'CONN_TIMEOUT')
  details?: string; // Optional additional details
  retry: boolean; // Indicates if the operation might be retryable
  originalError?: any; // The original error object, if available
}

// --- Core Protocol Packet Types (Matching Server Spec) ---

/**
 * Initial authentication message sent by the client.
 */
export interface AuthMessage extends BasePacket {
  type: "Auth";
  public_key: string;           // Client's Ed25519 public key (Base58)
  version: string;              // Client version string (e.g., "1.0.0")
  features: string[];           // Client capabilities (e.g., ["aes256gcm", "webrtc", "key-rotation"])
  encryption_algorithm: string; // MUST be "aes256gcm" for AES-GCM support
  nonce: string;                // Unique STRING nonce for this request
}

/**
 * Challenge message sent by the server in response to Auth.
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
 */
export interface ChallengeResponse extends BasePacket {
  type: "ChallengeResponse";
  challenge_id: string;         // The ID received in the Challenge packet
  public_key: string;           // Client's Ed25519 public key again (Base58)
  signature: string;            // Ed25519 signature of challenge data (Base58)
}

/**
 * Message sent by the server upon successful authentication.
 */
export interface IpAssignMessage extends BasePacket {
  type: "IpAssign";
  ip_address: string;           // Assigned internal IP address
  session_id: string;           // Unique ID for this session
  encrypted_session_key: number[]; // AES-GCM encrypted 32-byte session key (as number[])
  key_nonce: number[];          // 12-byte nonce used for encrypting session key (as number[])
  encryption_algorithm: string; // Confirms algorithm used for encrypted_session_key
}

/**
 * Encrypted data packet for application-level communication.
 */
export interface DataPacket extends BasePacket {
  type: "Data";
  encrypted: number[];          // Payload encrypted with AES-GCM using session key (as number[])
  nonce: number[];              // Unique 12-byte nonce for this specific packet (as number[])
  counter: number;              // Monotonically increasing counter for replay protection
  encryption_algorithm: string; // MUST be "aes256gcm"
}

/**
 * Ping message for keepalive / latency check.
 */
export interface PingMessage extends BasePacket {
  type: "Ping";
  timestamp: number;            // Timestamp (ms since epoch) when ping was sent
  sequence: number;             // Sequence number for matching Pong
}

/**
 * Pong message responding to a Ping.
 */
export interface PongMessage extends BasePacket {
  type: "Pong";
  echo_timestamp: number;       // Timestamp from the corresponding Ping message
  server_timestamp: number;     // Timestamp (ms since epoch) when server sent Pong
  sequence: number;             // Sequence number from the corresponding Ping
}

/**
 * Error message sent by the server.
 */
export interface ErrorMessage extends BasePacket {
  type: "Error";
  code: number;                 // Error code (e.g., 4xxx for auth errors)
  message: string;              // Human-readable error message
}

/**
 * Disconnect message sent by server or client.
 */
export interface DisconnectMessage extends BasePacket {
  type: "Disconnect";
  reason: number;               // Close code (e.g., 1000 for normal closure, 4xxx for errors)
  message: string;              // Optional human-readable reason
}

// --- Application-Level Payload Types (Used within DataPacket) ---

/**
 * Chat message payload - supports both snake_case & camelCase fields
 * for server/client communication compatibility
 */
export interface MessagePayload extends BasePacket {
  type: 'message';
  id: string;                   // Unique message identifier
  
  // Support both naming conventions from the specification
  content?: string;             // Message content (camelCase - client preference)
  text?: string;                // Message content (snake_case - server format)
  
  // Support both field names for sender
  senderId?: string;            // ID of the message sender (camelCase - client preference)
  sender?: string;              // ID of the message sender (snake_case - server format)
  
  senderName: string;           // Display name of sender
  timestamp: string;            // ISO 8601 timestamp
  chatId: string;               // ID of the chat room
  isEncrypted?: boolean;        // Whether the content is encrypted
  status?: 'sending' | 'sent' | 'delivered' | 'failed' | 'received' | 'read'; // Delivery status
}

/**
 * Chat info request payload - supports both naming formats from spec
 */
export interface ChatInfoRequestPayload extends BasePacket {
  type: 'request-chat-info' | 'chat_info_request'; // Both formats supported
  chatId: string;               // ID of the chat room
}

/**
 * Chat info response payload 
 */
export interface ChatInfoPayload extends BasePacket {
  type: 'chat-info' | 'chat_info_response'; // Both formats supported
  
  // Support both structures from spec (direct fields vs nested 'data')
  // Direct fields (server format)
  id?: string;
  name?: string;
  created_at?: string;
  createdAt?: string;
  participant_count?: number;
  participantCount?: number;
  encryption?: boolean;
  isEncrypted?: boolean;
  useP2P?: boolean;
  createdBy?: string;
  
  // Nested data structure (client format)
  data?: {
    id: string;
    name: string;
    createdAt: string;
    participantCount: number;
    isEncrypted: boolean;
    useP2P: boolean;
    createdBy: string;
  };
}

/**
 * Participants request payload - supports both naming formats
 */
export interface ParticipantsRequestPayload extends BasePacket {
  type: 'request-participants' | 'participants_request'; // Both formats supported
  chatId: string;               // ID of the chat room
}

/**
 * Participants response payload - supports both structures
 */
export interface ParticipantsPayload extends BasePacket {
  type: 'participants_response'; 
  
  // Support both structures (direct array vs nested 'data')
  participants?: Participant[]; // Direct array (server format)
  data?: Participant[];         // Nested data array (client format alternative)
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
 * WebRTC signaling payload 
 */
export interface WebRTCSignalPayload extends BasePacket {
  type: 'webrtc-signal' | 'webrtc_signal'; // Support both formats
  peerId: string;               // Target peer ID for the signal
  signalType: 'offer' | 'answer' | 'candidate'; // Signal type
  signalData: any;              // SDP or ICE candidate data (using 'any' for flexibility)
  timestamp: number;            // Message timestamp
}

/**
 * Leave chat request payload
 */
export interface LeaveChatPayload extends BasePacket {
  type: 'leave-chat';
  chatId: string;               // ID of the chat room
}

/**
 * Delete chat request payload
 */
export interface DeleteChatPayload extends BasePacket {
  type: 'delete-chat';
  chatId: string;               // ID of the chat room
}

/**
 * History request payload
 */
export interface HistoryRequestPayload extends BasePacket {
  type: 'history_request';
  requesterId: string;          // ID of the requesting user
  chatId: string;               // ID of the chat room
}

/**
 * History response payload
 */
export interface HistoryResponsePayload extends BasePacket {
  type: 'history_response';
  chatId: string;               // ID of the chat room
  recipientId: string;          // ID of the recipient
  messages: MessagePayload[];   // Array of messages
}

/**
 * Key rotation request 
 */
export interface KeyRotationRequestPayload extends BasePacket {
  type: 'key_rotation_request';
  sessionId?: string;           // Current session ID (optional)
  timestamp: number;            // Request timestamp
}

/**
 * Key rotation response 
 */
export interface KeyRotationResponsePayload extends BasePacket {
  type: 'key_rotation_response';
  rotation_id?: string;         // ID to correlate request/response
  encrypted_key?: number[];     // New encrypted session key
  key_nonce?: number[];         // Nonce for encrypted key
  status: 'success' | 'failure';
  message?: string;             // Optional status message
}

// --- Type Guards (for runtime type checking) ---

/** Checks if a value is a non-null object */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Type guard for MessagePayload objects */
export function isMessageType(payload: any): payload is MessagePayload {
  if (!isObject(payload)) return false;
  
  return (
    payload.type === 'message' &&
    typeof payload.id === 'string' &&
    // Check for content in either field format
    ((typeof payload.content === 'string') || (typeof payload.text === 'string')) &&
    // Check for sender in either field format
    ((typeof payload.senderId === 'string') || (typeof payload.sender === 'string')) &&
    typeof payload.timestamp === 'string' &&
    typeof payload.chatId === 'string'
  );
}

/** Type guard for ChatInfoPayload objects */
export function isChatInfoPayload(payload: any): payload is ChatInfoPayload {
  if (!isObject(payload)) return false;
  
  // Check for supported type values
  if (payload.type !== 'chat-info' && payload.type !== 'chat_info_response') {
    return false;
  }
  
  // Check both possible structures:
  
  // Direct fields structure
  if (typeof payload.id === 'string' && 
      typeof payload.name === 'string' &&
      (typeof payload.created_at === 'string' || typeof payload.createdAt === 'string') &&
      (typeof payload.participant_count === 'number' || typeof payload.participantCount === 'number')) {
    return true;
  }
  
  // Nested data structure
  if (isObject(payload.data) && 
      typeof payload.data.id === 'string' && 
      typeof payload.data.name === 'string' &&
      typeof payload.data.createdAt === 'string' &&
      typeof payload.data.participantCount === 'number') {
    return true;
  }
  
  return false;
}

/** Type guard for ParticipantsPayload objects */
export function isParticipantsPayload(payload: any): payload is ParticipantsPayload {
  if (!isObject(payload)) return false;
  
  if (payload.type !== 'participants_response') {
    return false;
  }
  
  // Check both possible structures:
  
  // Direct participants array
  if (Array.isArray(payload.participants)) {
    return true;
  }
  
  // Nested data array
  if (Array.isArray(payload.data)) {
    return true;
  }
  
  return false;
}

/** Type guard for WebRTC signal payload */
export function isWebRTCSignalPayload(payload: any): payload is WebRTCSignalPayload {
  if (!isObject(payload)) return false;
  
  return (
    (payload.type === 'webrtc-signal' || payload.type === 'webrtc_signal') &&
    typeof payload.peerId === 'string' &&
    typeof payload.signalType === 'string' &&
    ['offer', 'answer', 'candidate'].includes(payload.signalType) &&
    payload.signalData !== undefined &&
    typeof payload.timestamp === 'number'
  );
}

/** Type guard for history request */
export function isHistoryRequestPayload(payload: any): payload is HistoryRequestPayload {
  if (!isObject(payload)) return false;
  
  return (
    payload.type === 'history_request' &&
    typeof payload.requesterId === 'string' &&
    typeof payload.chatId === 'string'
  );
}

/** Type guard for history response */
export function isHistoryResponsePayload(payload: any): payload is HistoryResponsePayload {
  if (!isObject(payload)) return false;
  
  return (
    payload.type === 'history_response' &&
    typeof payload.chatId === 'string' &&
    typeof payload.recipientId === 'string' &&
    Array.isArray(payload.messages)
  );
}

/** Type guard for key rotation request */
export function isKeyRotationRequestPayload(payload: any): payload is KeyRotationRequestPayload {
  if (!isObject(payload)) return false;
  
  return (
    payload.type === 'key_rotation_request' &&
    (payload.sessionId === undefined || typeof payload.sessionId === 'string') &&
    typeof payload.timestamp === 'number'
  );
}

/** Type guard for key rotation response */
export function isKeyRotationResponsePayload(payload: any): payload is KeyRotationResponsePayload {
  if (!isObject(payload)) return false;
  
  return (
    payload.type === 'key_rotation_response' &&
    (payload.rotation_id === undefined || typeof payload.rotation_id === 'string') &&
    typeof payload.status === 'string' &&
    ['success', 'failure'].includes(payload.status)
  );
}

// Union types for application payloads
export type ApplicationPayload =
  | MessagePayload
  | ChatInfoPayload
  | ParticipantsPayload
  | WebRTCSignalPayload
  | HistoryRequestPayload
  | HistoryResponsePayload
  | KeyRotationRequestPayload
  | KeyRotationResponsePayload
  | LeaveChatPayload
  | DeleteChatPayload;
