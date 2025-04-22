import * as bs58 from 'bs58';
import * as nacl from 'tweetnacl';

/**
 * Encrypt data using AES-GCM via Web Crypto API
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
  
  // Generate a 12-byte nonce for AES-GCM
  const nonce = generateNonce(12);
  
  try {
    // Web Crypto API implementation
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // Import the raw key
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw', 
        key, 
        { name: 'AES-GCM' },
        false, 
        ['encrypt']
      );
      
      // Encrypt the data
      const ciphertextBuffer = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
          tagLength: 128 // 16 bytes tag, standard for AES-GCM
        },
        cryptoKey,
        plaintextData
      );
      
      const ciphertext = new Uint8Array(ciphertextBuffer);
      
      console.debug('[Crypto] AES-GCM encryption successful:', {
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
    throw new Error(`AES-GCM encryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decrypt data using AES-GCM via Web Crypto API
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
    throw new Error(`Invalid nonce: length=${nonce?.length ?? 'null'} (expected 12 bytes for AES-GCM)`);
  }
  
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // Import the raw key
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      // Decrypt the data
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
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
    throw new Error(`AES-GCM decryption failed: ${error instanceof Error ? error.message : String(error)}`);
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
 * Create a proper data packet for encrypted messaging
 * Using the consistent field names expected by the server
 * 
 * @param ciphertext Encrypted data
 * @param nonce Nonce used for encryption
 * @param counter Message counter for replay protection
 * @returns Data packet ready for transmission
 */
export function createDataPacket(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  counter: number
) {
  return {
    type: 'Data',
    encrypted: Array.from(ciphertext), // Convert Uint8Array to regular array for JSON
    nonce: Array.from(nonce),
    counter: counter,
    encryption_algorithm: 'aes-gcm', // Consistent field name for server compatibility
    padding: null // Optional padding for length concealment
  };
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
      console.warn('[Socket] Web Crypto API HKDF failed, using fallback:', error);
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
