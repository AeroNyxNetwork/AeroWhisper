// src/lib/socket/networking.ts
import { PingMessage, PongMessage } from './types';

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
 * @param publicKey User's public key
 * @returns Auth message object
 */
export function createAuthMessage(publicKey: string) {
  return {
    type: 'Auth',
    public_key: publicKey,
    version: '1.0.0',
    features: ['aes-gcm', 'chacha20poly1305', 'webrtc'], // Add aes-gcm as first priority
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

/**
 * Generate a nonce for encryption
 * @param length Length of nonce in bytes (default: 12 for AES-GCM)
 * @returns Nonce as Uint8Array
 */
export function generateNonce(length: number = 12): Uint8Array {
  const nonce = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(nonce);
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < length; i++) {
      nonce[i] = Math.floor(Math.random() * 256);
    }
  }
  return nonce;
}

/**
 * Check if Web Crypto API is available with AES-GCM support
 * @returns True if Web Crypto API with AES-GCM is available
 */
export function isAesGcmSupported(): boolean {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    return false;
  }
  
  try {
    // Try to create a simple AES-GCM key to test support
    const promise = window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );
    
    // If we got here without an exception, it's likely supported
    return !!promise;
  } catch (error) {
    return false;
  }
}
