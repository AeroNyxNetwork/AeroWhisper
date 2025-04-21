/**
 * Configuration for reconnection strategy
 */
export interface ReconnectionConfig {
  initialDelay: number;
  maxDelay: number;
  maxAttempts: number;
  jitter: boolean;
}

/**
 * Types of errors that can occur during socket operations
 */
export interface SocketError {
  type: 'connection' | 'auth' | 'data' | 'signaling' | 'server' | 'message';
  message: string;
  code: string;
  details?: string;
  retry: boolean;
  originalError?: any;
}

/**
 * Connection status types for socket
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

/**
 * Represents a message in the chat
 */
export interface MessageData {
  type: 'message';
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: string;
}

/**
 * Auth message sent to server
 */
export interface AuthMessage {
  type: 'Auth';
  public_key: string;
  version: string;
  features: string[];
  nonce: string;
}

/**
 * Challenge message from server
 */
export interface ChallengeMessage {
  id: string;
  data: number[] | string;
  server_public_key?: string;
}

/**
 * Challenge response to server
 */
export interface ChallengeResponse {
  type: 'ChallengeResponse';
  signature: string;
  public_key: string;
  challenge_id: string;
}

/**
 * IP assignment message after successful authentication
 */
export interface IpAssignMessage {
  ip_address: string;
  session_id: string;
  session_key?: string;
  key_nonce?: string;
  server_public_key?: string;
}

/**
 * Encrypted data packet for transmission
 */
export interface DataPacket {
  type: 'Data';
  encrypted: number[];
  nonce: number[];
  counter: number;
  padding?: any;
}

/**
 * Ping message for connection health check
 */
export interface PingMessage {
  type: 'Ping';
  timestamp: number;
  sequence: number;
}

/**
 * Pong response to ping
 */
export interface PongMessage {
  type: 'Pong';
  echo_timestamp: number;
  server_timestamp: number;
  sequence: number;
}

/**
 * Error message from server
 */
export interface ErrorMessage {
  type: 'Error';
  message: string;
  code?: number;
}

/**
 * Disconnect message
 */
export interface DisconnectMessage {
  type: 'Disconnect';
  reason: number;
  message: string;
}

/**
 * Pending message in queue
 */
export interface PendingMessage {
  type: string;
  data: any;
}

/**
 * Queue message with attempt counter
 */
export interface QueuedMessage {
  data: any;
  attempts: number;
}
