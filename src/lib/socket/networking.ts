// src/lib/socket/networking.ts
import { PingMessage, PongMessage, AuthMessage } from './types';
import { generateNonce } from '../utils/cryptoUtils';

/**
 * Create a ping message
 * @param sequenceId Message counter/sequence ID
 * @returns Ping message object
 */
export function createPingMessage(sequenceId: number): PingMessage {
  return {
    type: 'Ping',
    timestamp: Date.now(),
    sequence: sequenceId,
  };
}

/**
 * Create a pong response message
 * @param timestamp Timestamp from the ping message
 * @param sequence Sequence ID from the ping message
 * @returns Pong message object
 */
export function createPongMessage(timestamp: number, sequence: number): PongMessage {
  return {
    type: 'Pong',
    echo_timestamp: timestamp,
    server_timestamp: Date.now(),
    sequence: sequence,
  };
}

/**
 * Check if a WebSocket is in valid open state
 * @param socket WebSocket instance to check
 * @returns True if socket is open and valid
 */
export function isSocketOpen(socket: WebSocket | null): boolean {
  return !!socket && socket.readyState === WebSocket.OPEN;
}

/**
 * Get the WebSocket state as a readable string
 * @param socketState WebSocket readyState value
 * @returns Human-readable socket state
 */
export function getSocketStateText(socketState: number | null): string {
  if (socketState === WebSocket.CONNECTING) return 'CONNECTING';
  if (socketState === WebSocket.OPEN) return 'OPEN';
  if (socketState === WebSocket.CLOSING) return 'CLOSING';
  if (socketState === WebSocket.CLOSED) return 'CLOSED';
  return 'UNKNOWN';
}

/**
 * Calculate connection latency
 * @param sentTimestamp When the ping was sent
 * @returns Latency in milliseconds
 */
export function calculateLatency(sentTimestamp: number): number {
  return Date.now() - sentTimestamp;
}

/**
 * Create a safe WebSocket URL
 * @param baseUrl Base server URL
 * @param chatId Chat room ID
 * @returns Properly formatted WebSocket URL
 */
export function createWebSocketUrl(baseUrl: string, chatId: string): string {
  let serverUrl = baseUrl;
  
  // Ensure URL starts with WebSocket protocol
  if (!serverUrl.startsWith('wss://') && !serverUrl.startsWith('ws://')) {
    serverUrl = `wss://${serverUrl}`;
  }
  
  // Join with chat path
  return `${serverUrl}/chat/${chatId}`;
}

/**
 * Create a disconnect message
 * @param reason Numeric reason code
 * @param message Text message explaining disconnect
 * @returns Disconnect message object
 */
export function createDisconnectMessage(reason: number, message: string) {
  return {
    type: 'Disconnect',
    reason,
    message,
  };
}

/**
 * Create an auth message with AES-GCM support
 * Updated to explicitly specify encryption_algorithm
 * 
 * @param publicKey User's public key
 * @returns Auth message object
 */
export function createAuthMessage(publicKey: string): AuthMessage {
  return {
    type: 'Auth',
    public_key: publicKey,
    version: '1.0.0',
    features: ['aes-gcm', 'chacha20poly1305', 'webrtc'], // List aes-gcm first for preference
    encryption_algorithm: 'aes-gcm', // Explicitly specify preferred algorithm with correct field name
    nonce: Date.now().toString(),
  };
}

/**
 * Check if connection needs a health check
 * @param lastMessageTime Timestamp of last received message
 * @param checkInterval Time interval to check against
 * @returns True if health check is needed
 */
export function needsHealthCheck(lastMessageTime: number, checkInterval: number = 15000): boolean {
  return (Date.now() - lastMessageTime) > checkInterval;
}

/**
 * Check if connection is likely dead
 * @param lastMessageTime Timestamp of last received message
 * @param deadThreshold Time threshold to consider connection dead
 * @returns True if connection is likely dead
 */
export function isConnectionDead(lastMessageTime: number, deadThreshold: number = 90000): boolean {
  return (Date.now() - lastMessageTime) > deadThreshold;
}
