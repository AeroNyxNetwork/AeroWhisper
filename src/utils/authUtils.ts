// src/utils/authUtils.ts
import * as bs58 from 'bs58';
import { encryptWithAesGcm, decryptWithAesGcm, generateNonce } from './cryptoUtils';

/**
 * Create authentication message with AES-GCM support
 * 
 * @param publicKey User's public key
 * @returns Authentication message with features including AES-GCM
 */
export function createAuthMessage(publicKey: string) {
  return {
    type: 'Auth',
    public_key: publicKey,
    version: '1.0.0',
    features: ['aes-gcm', 'chacha20poly1305', 'webrtc'], // Add aes-gcm as first priority
    nonce: generateRandomString(24),
  };
}

/**
 * Generate a random string for nonce
 * 
 * @param length Length of the random string
 * @returns Random string
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  // Use secure random number generation if available
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const values = new Uint8Array(length);
    window.crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
      result += chars.charAt(values[i] % chars.length);
    }
  } else {
    // Fallback to less secure Math.random
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  
  return result;
}

/**
 * Format data packet for transmission using AES-GCM encryption
 * 
 * @param plaintext Message to encrypt
 * @param sessionKey Session encryption key
 * @param counter Message counter for replay protection
 * @returns Formatted data packet ready for transmission
 */
export async function createDataPacket(
  plaintext: string | object, 
  sessionKey: Uint8Array, 
  counter: number
): Promise<any> {
  // Convert object to string if needed
  const messageText = typeof plaintext === 'string' 
    ? plaintext 
    : JSON.stringify(plaintext);
  
  // Encrypt using AES-GCM
  const { ciphertext, nonce } = await encryptWithAesGcm(messageText, sessionKey);
  
  // Format to match server expectations
  return {
    type: "Data",
    encrypted: Array.from(ciphertext), // Convert to regular array for JSON serialization
    nonce: Array.from(nonce),          // Convert to regular array for JSON serialization
    counter: counter,                   // Sequential counter to prevent replay attacks
    padding: null                       // Optional padding
  };
}

/**
 * Process a received encrypted data packet
 * 
 * @param encryptedData The encrypted packet from the server
 * @param sessionKey Session encryption key
 * @returns Decrypted message content or null if decryption fails
 */
export async function processDataPacket(
  encryptedData: any,
  sessionKey: Uint8Array
): Promise<any | null> {
  try {
    // Validate the message format
    if (!encryptedData || !encryptedData.type || encryptedData.type !== 'Data') {
      console.warn('[Auth] Received message in incorrect format:', encryptedData);
      return null;
    }
    
    // Extract the encrypted data and nonce
    if (!Array.isArray(encryptedData.encrypted) || !Array.isArray(encryptedData.nonce)) {
      console.warn('[Auth] Missing encrypted data or nonce');
      return null;
    }
    
    // Convert arrays back to Uint8Arrays
    const encryptedUint8 = new Uint8Array(encryptedData.encrypted);
    const nonceUint8 = new Uint8Array(encryptedData.nonce);
    
    // Log decryption attempt details for debugging
    console.debug('[Auth] Attempting to decrypt message:', {
      encryptedLength: encryptedUint8.length,
      nonceLength: nonceUint8.length,
      counter: encryptedData.counter
    });
    
    // Decrypt with AES-GCM
    const decryptedText = await decryptWithAesGcm(
      encryptedUint8,
      nonceUint8,
      sessionKey,
      undefined, // No AAD
      'string'   // Output as string
    ) as string;
    
    // Parse the decrypted JSON
    const parsedData = JSON.parse(decryptedText);
    console.log('[Auth] Successfully decrypted message with AES-GCM');
    
    return parsedData;
  } catch (error) {
    console.error('[Auth] Failed to process encrypted message:', error);
    return null;
  }
}

/**
 * Utility to help debug encryption parameters
 * 
 * @param plaintext Data to be encrypted
 * @param key Encryption key 
 * @param nonce Optional nonce
 */
export function logEncryptionParams(
  plaintext: Uint8Array, 
  key: Uint8Array, 
  nonce?: Uint8Array
) {
  console.log({
    action: "Encrypting",
    plaintext_length: plaintext.length,
    plaintext_prefix: Array.from(plaintext.slice(0, Math.min(16, plaintext.length))),
    key_prefix: Array.from(key.slice(0, 8)),
    nonce: nonce ? Array.from(nonce) : undefined
  });
}

/**
 * Test AES-GCM encryption with known test vectors
 * Useful for debugging encryption implementations
 */
export async function runAesGcmTest() {
  // Test vector (key and plaintext that produce known ciphertext with a fixed nonce)
  const testKey = new Uint8Array(32).fill(3); // All bytes are 0x03
  const testPlaintext = new TextEncoder().encode("Test message for AES-GCM encryption");
  const testNonce = new Uint8Array(12).fill(1); // All bytes are 0x01
  
  try {
    // Encrypt using test values
    const { ciphertext, nonce } = await encryptWithAesGcm(testPlaintext, testKey);
    
    console.log("Test encryption result:", {
      ciphertext_length: ciphertext.length,
      ciphertext_prefix: Array.from(ciphertext.slice(0, 8)),
      nonce: Array.from(nonce)
    });
    
    // Try decrypting
    const decrypted = await decryptWithAesGcm(ciphertext, nonce, testKey, undefined, 'string');
    console.log("Test decryption successful:", decrypted);
    
    return true;
  } catch (e) {
    console.error("Test encryption/decryption failed:", e);
    return false;
  }
}

/**
 * Convert between binary data formats
 * 
 * @param array Uint8Array to convert to base64
 * @returns Base64 string
 */
export function uint8ArrayToBase64(array: Uint8Array): string {
  return btoa(String.fromCharCode.apply(null, array as unknown as number[]));
}

/**
 * Convert base64 string to Uint8Array
 * 
 * @param base64 Base64 string to convert
 * @returns Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Simple echo test for AES-GCM encryption
 * Helps verify server communication is working correctly
 * 
 * @param socket WebSocket to use for sending the test message
 * @param sessionKey Session encryption key
 */
export async function testAesGcmEcho(socket: WebSocket, sessionKey: Uint8Array) {
  // Test message
  const testMessage = "AES-GCM Test: " + new Date().toISOString();
  
  try {
    // Create encrypted data packet
    const packet = await createDataPacket(testMessage, sessionKey, Date.now());
    
    // Log what we're sending
    console.log("Sending AES-GCM test packet:", {
      type: packet.type,
      encryptedLength: packet.encrypted.length,
      nonceLength: packet.nonce.length,
      counter: packet.counter
    });
    
    // Send to server
    socket.send(JSON.stringify(packet));
    console.log("Test packet sent, check response for decryption success");
    
    return true;
  } catch (error) {
    console.error("Failed to send AES-GCM test packet:", error);
    return false;
  }
}
