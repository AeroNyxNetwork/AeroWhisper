import { 
  ErrorMessage,
  DisconnectMessage,
  PingMessage,
  PongMessage,
  SocketError
} from './types';
import { createPongMessage } from './networking';

/**
 * Parse WebSocket message from different formats
 * @param data Message data in various formats
 * @returns Parsed message object
 */
export async function parseMessage(data: string | ArrayBuffer | Blob): Promise<any> {
  try {
    let message: any;
    
    if (typeof data === 'string') {
      message = JSON.parse(data);
    } else if (data instanceof Blob) {
      // Handle Blob data (for binary WebSocket messages)
      const reader = new FileReader();
      
      // Convert Blob to text using Promise
      const text = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(data);
      });
      
      message = JSON.parse(text);
    } else {
      // Handle ArrayBuffer
      const decoder = new TextDecoder();
      message = JSON.parse(decoder.decode(data));
    }
    
    return message;
  } catch (error) {
    console.error('[Socket] Error parsing message:', error);
    throw new Error('Failed to parse server message');
  }
}

/**
 * Create socket error object
 * @param type Error type
 * @param message User-friendly error message
 * @param code Error code
 * @param details Additional error details
 * @param retry Whether retry is possible
 * @param originalError Original error object
 * @returns Structured socket error object
 */
export function createSocketError(
  type: SocketError['type'],
  message: string,
  code: string,
  details?: string,
  retry: boolean = true,
  originalError?: any
): SocketError {
  return {
    type,
    message,
    code,
    details,
    retry,
    originalError
  };
}

/**
 * Handles a ping message
 * @param message Ping message
 * @returns Pong response
 */
export function handlePingMessage(message: PingMessage): PongMessage {
  return createPongMessage(message.timestamp, message.sequence);
}

/**
 * Calculate connection latency from pong message
 * @param message Pong message
 * @returns Latency in milliseconds
 */
export function getPongLatency(message: PongMessage): number {
  return Date.now() - message.echo_timestamp;
}

/**
 * Process server error message
 * @param message Error message from server
 * @returns Socket error object
 */
export function processErrorMessage(message: ErrorMessage): SocketError {
  return {
    type: 'server',
    message: message.message,
    code: message.code ? `SERVER_${message.code}` : 'SERVER_ERROR',
    retry: message.code ? message.code < 5000 : true // Retry for non-fatal errors
  };
}

/**
 * Process disconnect message
 * @param message Disconnect message from server
 * @returns Boolean indicating if reconnection should be attempted
 */
export function shouldReconnectAfterDisconnect(message: DisconnectMessage): boolean {
  // If reason is non-fatal (< 4000), attempt to reconnect
  return message.reason < 4000;
}
