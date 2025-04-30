// src/lib/socket/types.ts

/**
 * Base interface for all WebSocket packets.
 */
export interface BasePacket {
  type: string;
}

export interface DataEnvelope {
  payload_type: 'Json';  // Already correct - matches server expectation
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


// --- Core Packet Types (Matching Server Spec) ---

/**
 * Initial authentication message sent by the client.
 * Matches server requirements document Section 3.1.
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
  encryption_algorithm: string; // Confirms algorithm used for encrypted_session_key
  // Removed lease_duration based on latest socket.ts usage, add back if needed by server
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
  encryption_algorithm: string; // MUST be included
  // Removed padding field based on latest socket.ts usage, add back if needed by server
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

// --- Application-Level Types (Used within DataPacket) ---

/**
 * Chat message type for application layer communication
 */
export interface MessageType {
  id: string;                   // Unique message identifier
  content: string;              // Message content
  senderId: string;             // ID of the message sender
  senderName: string;           // Display name of the sender
  timestamp: string;            // ISO 8601 timestamp
  isEncrypted?: boolean;        // Whether the content is encrypted (often true inside DataPacket)
  status?: 'sending' | 'sent' | 'delivered' | 'failed' | 'received'; // Client-side delivery status
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

// --- Application-Level Payloads (Used within DataPacket) ---

/**
 * Structure for chat message payload
 */
export interface MessagePayload extends BasePacket {
  type: 'message';
  id: string;
  content: string;
  chatId: string;              // Added to comply with server spec
  sender: string;              // Using 'sender' as per server spec instead of senderId
  senderName: string;
  timestamp: string;
  // isEncrypted, status are typically handled client-side, not part of the core payload sent/received
}

/**
 * Structure for chat info request payload
 */
export interface ChatInfoRequestPayload extends BasePacket {
  type: 'chat_info_request';  // Changed to match server expectation
  chatId?: string;            // Optional, server might use current session
}

/**
 * Structure for chat info payload
 */
export interface ChatInfoPayload extends BasePacket {
  type: 'chat_info_response';  // Changed to match server expectation
  data: ChatInfo;
}

/**
 * Structure for participants request payload
 */
export interface ParticipantsRequestPayload extends BasePacket {
  type: 'participants_request';  // Changed to match server expectation
  chatId?: string;              // Changed from roomId to chatId for consistency
}

/**
 * Structure for participants list payload
 */
export interface ParticipantsPayload extends BasePacket {
  type: 'participants_response';  // Changed to match server expectation
  participants: Participant[];    // Changed from data to participants to match server
}

/**
 * Structure for WebRTC signaling payloads
 */
export interface WebRTCSignalPayload extends BasePacket {
  type: 'webrtc_signal';     // Changed to match server expectation
  peerId: string;            // Target peer ID for the signal
  signalType: 'offer' | 'answer' | 'candidate'; // Signal type
  signalData: any;           // SDP or ICE candidate data
  timestamp: number;         // Message timestamp
}

/** Type guard for chat info response from server */
export function isChatInfoResponse(payload: any): boolean {
  return isObject(payload) && payload.type === 'chat_info_response' && isObject(payload.data);
}

/** Type guard for participants response from server */
export function isParticipantsResponse(payload: any): boolean {
  return isObject(payload) && payload.type === 'participants_response' && Array.isArray(payload.participants);
}

/**
 * Structure for Key Rotation Request (Client -> Server)
 */
export interface KeyRotationRequestPayload extends BasePacket {
  type: 'key_rotation_request';  // Changed to match server expectation
  sessionId?: string;           // Current session ID (optional, server might know)
  timestamp: number;            // Request timestamp
  // Add client's ephemeral public key if needed by protocol
}

/**
 * Structure for Key Rotation Response (Server -> Client)
 */
export interface KeyRotationResponsePayload extends BasePacket {
  type: 'key_rotation_response'; // Changed to match server expectation
  rotation_id?: string;         // ID to correlate request/response (optional)
  encrypted_key?: number[];     // New encrypted session key (if applicable)
  key_nonce?: number[];         // Nonce for encrypted key
  status: 'success' | 'failure';
  message?: string;             // Optional status message
}

/**
 * Structure for Key Rotation Request initiated by Server
 */
export interface KeyRotationRequest extends BasePacket {
    type: 'KeyRotationRequest'; // Server initiates with this type
    rotation_id: string;        // ID for this rotation attempt
    // Add other necessary fields from server
}

/**
 * Structure for Client's Response to Server's Key Rotation Request
 */
export interface KeyRotationResponse extends BasePacket {
    type: 'KeyRotationResponse'; // Client responds with this type
    rotation_id: string;         // ID from the request
    nonce: number[];             // Client generated nonce for this response
    // Add other necessary fields based on protocol
    timestamp: number;
}


// --- Type Guards (Moved here for consistency) ---

/** Checks if a value is a non-null object */
function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
/** Checks if a value is a string */
function isString(value: unknown, allowEmpty: boolean = false): value is string {
    return typeof value === 'string' && (allowEmpty || value.length > 0);
}
/** Checks if a value is a number */
function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
}
/** Checks if a value is a boolean */
function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

/** Type guard for MessagePayload objects */
export function isMessageType(payload: any): payload is MessagePayload {
  return (
    isObject(payload) &&
    payload.type === 'message' &&
    isString(payload.id) &&
    isString(payload.content, true) && // Allow empty content
    isString(payload.sender) && // Changed from senderId to sender per server spec
    isString(payload.senderName, true) && // Allow potentially empty senderName
    isString(payload.timestamp) &&
    isString(payload.chatId) // Added chatId check
  );
}

/** Type guard for ChatInfoPayload objects */
export function isChatInfoPayload(payload: any): payload is ChatInfoPayload {
  if (!isObject(payload) || payload.type !== 'chat_info_response' || !isObject(payload.data)) {
      return false;
  }
  const data = payload.data;
  return (
    isString(data.id) &&
    isString(data.name, true) &&
    isString(data.createdBy) &&
    isString(data.createdAt) &&
    isNumber(data.participantCount) &&
    isBoolean(data.useP2P) &&
    isBoolean(data.isEncrypted)
  );
}

/** Type guard for individual Participant objects */
function isParticipant(participant: unknown): participant is Participant {
    if (!isObject(participant)) return false;
    return (
        isString(participant.id) &&
        isString(participant.name) &&
        isString(participant.publicKey) &&
        isString(participant.status) &&
        ['online', 'offline', 'away'].includes(participant.status)
    );
}

/** Type guard for ParticipantsPayload objects */
export function isParticipantsPayload(payload: any): payload is ParticipantsPayload {
  if (!isObject(payload) || payload.type !== 'participants_response' || !Array.isArray(payload.participants)) {
      return false;
  }
  // Optional: Validate first element for basic structure check
  // if (payload.participants.length > 0 && !isParticipant(payload.participants[0])) {
  //     console.warn("First participant in payload data has invalid structure");
  //     return false;
  // }
  return true;
}

/** Type guard for WebRTCSignalPayload objects */
export function isWebRTCSignalPayload(payload: any): payload is WebRTCSignalPayload {
  if (!isObject(payload) || payload.type !== 'webrtc_signal') return false;  // Updated to match correct type
  return (
    isString(payload.peerId) &&
    isString(payload.signalType) &&
    ['offer', 'answer', 'candidate'].includes(payload.signalType) &&
    payload.signalData !== undefined && // Existence check
    isNumber(payload.timestamp)
    // Deeper validation of signalData could be added here based on signalType
  );
}

/** Type guard for KeyRotationRequestPayload objects (Client -> Server) */
export function isKeyRotationRequestPayload(payload: any): payload is KeyRotationRequestPayload {
  if (!isObject(payload) || payload.type !== 'key_rotation_request') return false; // Changed to match server expectation
  return (
    (payload.sessionId === undefined || isString(payload.sessionId)) && // Optional sessionId
    isNumber(payload.timestamp)
    // Add checks for other mandatory fields if any
  );
}

/** Type guard for KeyRotationResponsePayload objects (Server -> Client) */
export function isKeyRotationResponsePayload(payload: any): payload is KeyRotationResponsePayload {
   if (!isObject(payload) || payload.type !== 'key_rotation_response') return false; // Changed to match server expectation
   return (
    (payload.rotation_id === undefined || isString(payload.rotation_id)) && // Optional rotation_id?
    isString(payload.status) &&
    ['success', 'failure'].includes(payload.status) &&
    (payload.encrypted_key === undefined || Array.isArray(payload.encrypted_key)) &&
    (payload.key_nonce === undefined || Array.isArray(payload.key_nonce)) &&
    (payload.message === undefined || isString(payload.message, true))
   );
}

/** Type guard for KeyRotationRequest (Server -> Client) */
export function isServerKeyRotationRequest(payload: any): payload is KeyRotationRequest {
    if (!isObject(payload) || payload.type !== 'KeyRotationRequest') return false;
    return isString(payload.rotation_id); // rotation_id is mandatory from server
}

/** Type guard for KeyRotationResponse (Client -> Server) */
export function isClientKeyRotationResponse(payload: any): payload is KeyRotationResponse {
     if (!isObject(payload) || payload.type !== 'KeyRotationResponse') return false;
     return (
        isString(payload.rotation_id) &&
        Array.isArray(payload.nonce) && // Check if nonce is array
        isNumber(payload.timestamp)
        // Add checks for other mandatory fields
     );
}


// --- Union Types ---

/** Union type for all possible incoming WebSocket message types (after JSON parsing) */
export type ReceivedPacket =
  | ChallengeMessage
  | IpAssignMessage
  | DataPacket // Contains encrypted application data
  | PingMessage
  | PongMessage
  | ErrorMessage
  | DisconnectMessage
  | KeyRotationRequest; // If server can initiate rotation

/** Union type for known application-level payload types (after decryption from DataPacket) */
export type DecryptedPayload =
  | MessagePayload
  | ChatInfoPayload
  | ParticipantsPayload
  | WebRTCSignalPayload
  | KeyRotationRequestPayload // Client initiates rotation request
  | KeyRotationResponsePayload // Server responds to client's request
  | { type: string; [key: string]: any }; // Fallback for other/unknown types
