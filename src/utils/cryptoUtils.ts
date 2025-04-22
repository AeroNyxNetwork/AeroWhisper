// src/utils/cryptoUtils.ts

import * as bs58 from 'bs58';
import * as nacl from 'tweetnacl';

/**
 * Check if aes256gcm is supported in the current environment
 * @returns Promise resolving to true if aes256gcm is supported
 */
export async function isAesGcmSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    return false;
  }
  
  try {
    // Try to create a simple key to test aes256gcm support
    await window.crypto.subtle.generateKey(
      {
        name: 'aes256gcm',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );
    
    return true;
  } catch (error) {
    console.warn('[Crypto] aes256gcm not supported:', error);
    return false;
  }
}

/**
 * Generate a cryptographically secure random nonce
 * @param length Length of nonce in bytes
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
 * Encrypt data using aes256gcm via Web Crypto API
 * This is a unified implementation that should be used throughout the application
 * 
 * @param plaintext Data to encrypt (string or Uint8Array)
 * @param key 32-byte encryption key
 * @returns Object containing encrypted data and nonce
 */
export async function encryptWithAesGcm(
  plaintext: string | Uint8Array,
  key: Uint8Array
): Promise<{ ciphertext: Uint8Array, nonce: Uint8Array }> {
  if (!key || key.length !== 32) {
    throw new Error(`Invalid encryption key: length=${key?.length ?? 'null'} (expected 32 bytes)`);
  }
  
  // Convert string to Uint8Array if necessary
  const plaintextData = typeof plaintext === 'string' 
    ? new TextEncoder().encode(plaintext)
    : plaintext;
  
  // Generate a 12-byte nonce for aes256gcm
  const nonce = generateNonce(12);
  
  try {
    // Web Crypto API implementation
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // Import the raw key
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw', 
        key, 
        { name: 'aes256gcm' },
        false, 
        ['encrypt']
      );
      
      // Encrypt the data
      const ciphertextBuffer = await window.crypto.subtle.encrypt(
        {
          name: 'aes256gcm',
          iv: nonce,
          tagLength: 128 // 16 bytes tag, standard for aes256gcm
        },
        cryptoKey,
        plaintextData
      );
      
      const ciphertext = new Uint8Array(ciphertextBuffer);
      
      console.debug('[Crypto] aes256gcm encryption successful:', {
        plaintextLength: plaintextData.length,
        ciphertextLength: ciphertext.length,
        nonceLength: nonce.length
      });
      
      return { ciphertext, nonce };
    } else {
      throw new Error('Web Crypto API not available');
    }
  } catch (error) {
    console.error('[Crypto] Encryption error:', error);
    throw new Error(`aes256gcm encryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decrypt data using aes256gcm via Web Crypto API
 * This is a unified implementation that should be used throughout the application
 * 
 * @param ciphertext Encrypted data
 * @param nonce Nonce used for encryption
 * @param key Encryption key
 * @param outputType Output format ('string' or 'binary')
 * @returns Decrypted data as string or Uint8Array
 */
export async function decryptWithAesGcm(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array,
  outputType: 'string' | 'binary' = 'binary'
): Promise<string | Uint8Array> {
  if (!key || key.length !== 32) {
    throw new Error(`Invalid decryption key: length=${key?.length ?? 'null'} (expected 32 bytes)`);
  }
  
  if (!nonce || nonce.length !== 12) {
    throw new Error(`Invalid nonce: length=${nonce?.length ?? 'null'} (expected 12 bytes for aes256gcm)`);
  }
  
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // Import the raw key
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        key,
        { name: 'aes256gcm' },
        false,
        ['decrypt']
      );
      
      // Decrypt the data
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'aes256gcm',
          iv: nonce,
          tagLength: 128 // Must match encryption setting
        },
        cryptoKey,
        ciphertext
      );
      
      // Convert to requested output format
      if (outputType === 'string') {
        const decoder = new TextDecoder();
        return decoder.decode(new Uint8Array(decryptedBuffer));
      } else {
        return new Uint8Array(decryptedBuffer);
      }
    } else {
      throw new Error('Web Crypto API not available');
    }
  } catch (error) {
    console.error('[Crypto] Decryption error:', error);
    throw new Error(`aes256gcm decryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create a proper data packet for encrypted messaging
 * Using the consistent field name "encryption_algorithm" expected by the server
 * 
 * @param data The data to encrypt (object or string)
 * @param sessionKey The session key for encryption
 * @param counter Message counter for replay protection
 * @returns Promise resolving to a properly formatted data packet
 */
export async function createEncryptedPacket(
  data: any,
  sessionKey: Uint8Array,
  counter: number
): Promise<any> {
  // Convert to string if needed
  const messageString = typeof data === 'string' ? data : JSON.stringify(data);
  
  // Encrypt with aes256gcm
  const { ciphertext, nonce } = await encryptWithAesGcm(messageString, sessionKey);
  
  // Create properly formatted packet with CONSISTENT field naming
  return {
    type: 'Data',
    encrypted: Array.from(ciphertext),
    nonce: Array.from(nonce),
    counter: counter,
    encryption_algorithm: 'aes256gcm', // Changed from 'aes256gcm' to 'aes256gcm'
    padding: null // Optional padding for length concealment
  };
}

/**
 * Process an encrypted packet
 * 
 * @param packet The encrypted packet to process
 * @param sessionKey The session key for decryption
 * @returns Promise resolving to the decrypted data or null on failure
 */
export async function processEncryptedPacket(
  packet: any,
  sessionKey: Uint8Array
): Promise<any | null> {
  try {
    // Basic packet validation
    if (!packet || packet.type !== 'Data' || 
        !Array.isArray(packet.encrypted) || 
        !Array.isArray(packet.nonce)) {
      console.warn('[Crypto] Invalid packet format:', packet);
      return null;
    }
    
    // Convert arrays to Uint8Arrays
    const ciphertext = new Uint8Array(packet.encrypted);
    const nonce = new Uint8Array(packet.nonce);
    
    // Support both field names for backward compatibility
    // Log which field name is being used for debugging
    let algorithm: string;
    if (packet.encryption_algorithm !== undefined) {
      algorithm = packet.encryption_algorithm;
      console.debug('[Crypto] Using encryption_algorithm field:', algorithm);
    } else if (packet.encryption !== undefined) {
      algorithm = packet.encryption;
      console.debug('[Crypto] Using deprecated encryption field:', algorithm);
    } else {
      algorithm = 'aes256gcm'; // Default
      console.debug('[Crypto] No algorithm field found, using default:', algorithm);
    }
    
    // Decrypt the data
    const decryptedString = await decryptWithAesGcm(
      ciphertext,
      nonce,
      sessionKey,
      'string'
    ) as string;
    
    // Parse the decrypted JSON
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('[Crypto] Failed to process encrypted packet:', error);
    return null;
  }
}

/**
 * Derive a session key from ECDH shared secret using HKDF
 * Following the server implementation: derive_session_key()
 * 
 * @param sharedSecret The shared secret from ECDH
 * @param salt A salt for the key derivation
 * @returns A 32-byte session key
 */
export async function deriveSessionKey(sharedSecret: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  if (!sharedSecret || sharedSecret.length === 0) {
    throw new Error('Invalid shared secret');
  }
  
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      // Import shared secret as a key
      const baseKey = await window.crypto.subtle.importKey(
        'raw',
        sharedSecret,
        { name: 'HKDF' },
        false,
        ['deriveBits']
      );
      
      // Derive key using HKDF with SHA-256
      const derivedBits = await window.crypto.subtle.deriveBits(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: salt,
          info: new TextEncoder().encode('AERONYX-SESSION-KEY')
        },
        baseKey,
        256 // 32 bytes (256 bits)
      );
      
      return new Uint8Array(derivedBits);
    } catch (error) {
      console.warn('[Crypto] Web Crypto API HKDF failed, using fallback:', error);
      // Fall back to a simplified HMAC-based KDF implementation
    }
  }
  
  // Fallback implementation using TweetNaCl
  // This is a simplified HKDF implementation
  const hmacKey = nacl.hash(new Uint8Array([...salt, ...sharedSecret]));
  const info = new TextEncoder().encode('AERONYX-SESSION-KEY');
  const prk = nacl.hash(new Uint8Array([...hmacKey, ...info]));
  
  // Return first 32 bytes as the session key
  return prk.slice(0, 32);
}

/**
 * Parse challenge data for authentication
 * @param challengeData Challenge data in array or string format
 * @returns Parsed challenge as Uint8Array
 */
export function parseChallengeData(challengeData: number[] | string): Uint8Array {
  let parsed: Uint8Array;
  
  // Handle array format (from server)
  if (Array.isArray(challengeData)) {
    parsed = new Uint8Array(challengeData);
    console.log('[Crypto] Challenge data is array, length:', parsed.length);
  } 
  // Handle string format (may be base58 or base64)
  else if (typeof challengeData === 'string') {
    try {
      // Try to parse as base58
      parsed = bs58.decode(challengeData);
      console.log('[Crypto] Challenge data decoded as base58, length:', parsed.length);
    } catch (e) {
      // Fallback to base64
      try {
        const buffer = Buffer.from(challengeData, 'base64');
        parsed = new Uint8Array(buffer);
        console.log('[Crypto] Challenge data decoded as base64, length:', parsed.length);
      } catch (e2) {
        // Last resort: try to use the string directly as UTF-8
        const encoder = new TextEncoder();
        parsed = encoder.encode(challengeData);
        console.log('[Crypto] Challenge data encoded as UTF-8, length:', parsed.length);
      }
    }
  } else {
    throw new Error('Invalid challenge data format');
  }
  
  return parsed;
}

/**
 * Sign a challenge using Ed25519
 * @param challenge Challenge data to sign
 * @param secretKey Ed25519 secret key
 * @returns Signature as a base58 string
 */
export function signChallenge(
  challenge: Uint8Array,
  secretKey: Uint8Array
): string {
  try {
    // Verify the keypair is valid
    if (secretKey.length !== 64) {
      throw new Error(`Invalid Ed25519 secret key length: ${secretKey.length} (expected 64 bytes)`);
    }
    
    // Sign the challenge using nacl.sign.detached
    const signature = nacl.sign.detached(challenge, secretKey);
    const signatureB58 = bs58.encode(signature);
    
    return signatureB58;
  } catch (error) {
    console.error('[Crypto] Error signing challenge:', error);
    throw error;
  }
}
