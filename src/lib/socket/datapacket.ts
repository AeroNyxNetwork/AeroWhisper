/**
 * DataPacket Creation and Handling
 * 
 * This module provides unified functions for creating, sending, and processing
 * encrypted data packets with consistent field naming for server compatibility.
 */
import { 
  encryptWithAesGcm, 
  decryptWithAesGcm
} from '../../utils/cryptoUtils';

import { DataPacket } from './types';

/**
 * Create an encrypted data packet with proper field naming
 * 
 * @param data The data to encrypt (object that will be JSON stringified)
 * @param sessionKey The encryption key
 * @param counter Message counter for replay protection
 * @returns Complete data packet ready for transmission
 */
export async function createEncryptedPacket(
  data: any,
  sessionKey: Uint8Array,
  counter: number
): Promise<DataPacket> {
  // Convert data to JSON string
  const messageString = JSON.stringify(data);
  
  // Encrypt with aes256gcm
  const { ciphertext, nonce } = await encryptWithAesGcm(messageString, sessionKey);
  
  // Create packet with the correct field names
  return {
    type: 'Data',
    encrypted: Array.from(ciphertext),
    nonce: Array.from(nonce),
    counter: counter,
    encryption_algorithm: 'aes256gcm', // Use consistent field name expected by server
    padding: null // Optional padding
  };
}

/**
 * Decrypt and process a data packet
 * 
 * @param packet The received data packet
 * @param sessionKey The decryption key
 * @returns Decrypted data object or null if decryption fails
 */
export async function processEncryptedPacket(
  packet: any,
  sessionKey: Uint8Array
): Promise<any | null> {
  try {
    // Validate the packet format
    if (!packet || packet.type !== 'Data' || 
        !Array.isArray(packet.encrypted) || 
        !Array.isArray(packet.nonce)) {
      console.warn('[Socket] Invalid data packet format');
      return null;
    }
    
    // Convert arrays to Uint8Arrays
    const encryptedData = new Uint8Array(packet.encrypted);
    const nonce = new Uint8Array(packet.nonce);
    
    // Support both field names for backward compatibility
    const algorithm = packet.encryption_algorithm || packet.encryption || 'aes256gcm';
    console.debug('[Socket] Processing encrypted packet:', {
      algorithm,
      encryptedSize: encryptedData.length,
      nonceSize: nonce.length,
      counter: packet.counter
    });
    
    // Decrypt the data
    const decryptedText = await decryptWithAesGcm(
      encryptedData,
      nonce,
      sessionKey,
      'string' // Request string output
    ) as string;
    
    // Parse the JSON
    return JSON.parse(decryptedText);
  } catch (error) {
    console.error('[Socket] Error processing encrypted packet:', error);
    return null;
  }
}

/**
 * Create common message type for chat messaging
 * 
 * @param content Message content
 * @param senderId Sender's ID
 * @param senderName Sender's display name
 * @returns Formatted message object
 */
export function createChatMessage(
  content: string,
  senderId: string,
  senderName: string
): any {
  return {
    type: 'message',
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    content,
    senderId,
    senderName,
    timestamp: new Date().toISOString()
  };
}
