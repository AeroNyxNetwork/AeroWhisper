// src/lib/socket/networking.ts
import { DisconnectMessage } from './types';

/**
 * WebSocket ready states with named constants for better code readability
 */
export const WebSocketState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

export function createPongMessage(timestamp: number, sequence: number): PongMessage {
  return {
    type: 'Pong',
    echo_timestamp: timestamp,
    server_timestamp: Date.now(),
    sequence: sequence
  };
}

/**
 * Standard WebSocket close codes
 */
export const CloseCodes = {
  NORMAL_CLOSURE: 1000,
  GOING_AWAY: 1001,
  PROTOCOL_ERROR: 1002,
  UNSUPPORTED_DATA: 1003,
  NO_STATUS: 1005,
  ABNORMAL_CLOSURE: 1006,
  INVALID_FRAME_PAYLOAD: 1007,
  POLICY_VIOLATION: 1008,
  MESSAGE_TOO_BIG: 1009,
  MISSING_EXTENSION: 1010,
  INTERNAL_ERROR: 1011,
  SERVICE_RESTART: 1012,
  TRY_AGAIN_LATER: 1013,

  // Custom application codes (4000-4999 range)
  AUTH_FAILED: 4001,
  SESSION_EXPIRED: 4002,
  INVALID_MESSAGE: 4003,
  RATE_LIMITED: 4004,
  SERVER_ERROR: 4500,
  CHAT_DELETED: 4100,
  KICKED: 4101
};

/**
 * Checks if a WebSocket connection is currently open.
 * @param socket The WebSocket instance or null.
 * @returns True if the socket exists and its readyState is OPEN.
 */
export function isSocketOpen(socket: WebSocket | null): socket is WebSocket {
  return socket !== null && socket.readyState === WebSocket.OPEN;
}

/**
 * Checks if a WebSocket connection can still receive messages (open or connecting).
 * @param socket The WebSocket instance or null.
 * @returns True if the socket exists and is in a state to receive messages.
 */
export function canSocketReceiveMessages(socket: WebSocket | null): socket is WebSocket {
  return socket !== null && (
    socket.readyState === WebSocket.OPEN || 
    socket.readyState === WebSocket.CONNECTING
  );
}

/**
 * Creates the full WebSocket URL including the chat ID path parameter.
 * @param baseUrl The base WSS server URL (e.g., wss://your-server.com).
 * @param chatId The ID of the chat room.
 * @param params Optional key-value pairs to add as query parameters.
 * @returns The complete WebSocket URL string.
 * @throws Error if baseUrl or chatId is invalid.
 */
export function createWebSocketUrl(
  baseUrl: string, 
  chatId: string, 
  params: Record<string, string> = {}
): string {
  // Validate inputs
  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error('Invalid base WebSocket URL provided.');
  }
  
  if (!chatId || typeof chatId !== 'string') {
    throw new Error('Invalid chat ID provided.');
  }
  
  // Sanitize base URL
  let sanitizedUrl = baseUrl.trim();
  sanitizedUrl = sanitizedUrl.endsWith('/') ? sanitizedUrl.slice(0, -1) : sanitizedUrl;
  
  // Encode the chat ID to ensure it's URL-safe
  const encodedChatId = encodeURIComponent(chatId);
  
  // Add query parameters if provided
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    queryParams.append(key, value);
  });
  
  const queryString = queryParams.toString();
  
  // Construct final URL
  return queryString 
    ? `${sanitizedUrl}/${encodedChatId}?${queryString}`
    : `${sanitizedUrl}/${encodedChatId}`;
}

/**
 * Creates a standard Disconnect message object.
 * Useful for sending graceful disconnects from the client.
 * @param reason The WebSocket close code.
 * @param message Optional human-readable disconnect message.
 * @returns A DisconnectMessage object.
 */
export function createDisconnectMessage(
  reason: number = CloseCodes.NORMAL_CLOSURE, 
  message: string = ''
): DisconnectMessage {
  return {
    type: 'Disconnect',
    reason,
    message: message.substring(0, 123) // Limit message length for safety
  };
}

/**
 * Determines if a WebSocket close code indicates a temporary/retryable condition.
 * @param code The WebSocket close code.
 * @returns True if the connection should be retried.
 */
export function isRetryableCloseCode(code: number): boolean {
  // Success codes that should not trigger reconnect
  if (code === CloseCodes.NORMAL_CLOSURE || code === CloseCodes.GOING_AWAY) {
    return false;
  }
  
  // Non-retryable application errors
  if (
    code === CloseCodes.AUTH_FAILED || 
    code === CloseCodes.CHAT_DELETED || 
    code === CloseCodes.KICKED
  ) {
    return false;
  }
  
  // Service unavailable, try again later - always retry
  if (
    code === CloseCodes.TRY_AGAIN_LATER || 
    code === CloseCodes.SERVICE_RESTART || 
    code === CloseCodes.ABNORMAL_CLOSURE
  ) {
    return true;
  }
  
  // Default behavior for other codes
  return !(code >= 4000 && code < 4100); // Retry anything except 4000-4099 (auth errors)
}

/**
 * Safely parses a JSON WebSocket message with error handling
 * @param data The raw message data from WebSocket
 * @returns The parsed object or null if parsing failed
 */
export function safeParseMessage(data: string): any | null {
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('[Socket] Failed to parse incoming message:', error);
    return null;
  }
}

/**
 * Validates that a WebSocket message has the expected structure
 * @param message The parsed message object
 * @param expectedType Optional specific message type to check for
 * @returns True if the message has valid structure
 */
export function validateMessageStructure(
  message: any, 
  expectedType?: string
): boolean {
  if (!message || typeof message !== 'object') {
    return false;
  }
  
  if (typeof message.type !== 'string') {
    return false;
  }
  
  if (expectedType && message.type !== expectedType) {
    return false;
  }
  
  return true;
}

/**
 * Creates a delay promise for networking operations
 * @param ms The number of milliseconds to delay
 * @returns A promise that resolves after the specified delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Converts a WebSocket state code to a human-readable string
 * @param readyState The WebSocket readyState value
 * @returns A descriptive string of the WebSocket state
 */
export function getSocketStateName(readyState: number): string {
  switch (readyState) {
    case WebSocketState.CONNECTING: return 'connecting';
    case WebSocketState.OPEN: return 'open';
    case WebSocketState.CLOSING: return 'closing';
    case WebSocketState.CLOSED: return 'closed';
    default: return 'unknown';
  }
}
