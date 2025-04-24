import { 
  ErrorMessage,
  DisconnectMessage,
  PingMessage,
  PongMessage,
  SocketError,
  DataPacket
} from './types';
import { createPongMessage } from './networking';
import { decryptWithAesGcm } from '../../utils/cryptoUtils';

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

/**
 * Process encrypted data packet with support for both field names
 * @param packet The data packet to process
 * @param sessionKey The session key for decryption
 * @returns Decrypted data or null if decryption fails
 */
export async function processDataPacket(
  packet: DataPacket,
  sessionKey: Uint8Array
): Promise<any | null> {
  try {
    if (!sessionKey) {
      throw new Error('No session key available to decrypt message');
    }
    
    // Convert array data to Uint8Array for decryption
    const encryptedUint8 = new Uint8Array(packet.encrypted);
    const nonceUint8 = new Uint8Array(packet.nonce);
    
    // Check if server specified an encryption algorithm
    // Support both field names for backward compatibility
    const algorithm = packet.encryption_algorithm || (packet as any).encryption || 'aes256gcm';
    
    // Log packet details for debugging
    console.debug('[Socket] Processing encrypted data packet:', {
      encryptedSize: encryptedUint8.length,
      nonceSize: nonceUint8.length,
      counter: packet.counter,
      algorithm: algorithm
    });
    
    // Decrypt using aes256gcm
    const decryptedText = await decryptWithAesGcm(
      encryptedUint8,
      nonceUint8,
      sessionKey,
      'string'   // Output as string
    );
    
    // Parse the decrypted JSON
    return JSON.parse(decryptedText);
  } catch (error) {
    console.error('[Socket] Error processing data packet:', error);
    return null;
  }
}
