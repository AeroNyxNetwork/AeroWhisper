import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';
// Import the ChaCha20-Poly1305 implementation
import { chacha20poly1305, xchacha20poly1305 } from '@noble/ciphers/chacha';

/**
 * ChaCha20-Poly1305 encryption function compatible with Rust's chacha20poly1305 crate
 * @param key 32-byte key as Uint8Array
 * @param nonce 12-byte nonce as Uint8Array
 * @param data Data to encrypt
 * @returns Encrypted data (ciphertext + auth tag)
 */
function chacha20poly1305Encrypt(key: Uint8Array, nonce: Uint8Array, data: Uint8Array): Uint8Array {
  // According to @noble/ciphers docs, we need to provide the key and possibly additional options
  const chacha = chacha20poly1305(key, {});
  
  // Encrypt the data with the nonce
  // Note: @noble/ciphers follows the RFC 8439 standard which is compatible with Rust's implementation
  return chacha.seal(nonce, data);
}

/**
 * ChaCha20-Poly1305 decryption function compatible with Rust's chacha20poly1305 crate
 * @param key 32-byte key as Uint8Array
 * @param nonce 12-byte nonce as Uint8Array
 * @param data Encrypted data to decrypt (ciphertext + auth tag)
 * @returns Decrypted data or null if authentication fails
 */
function chacha20poly1305Decrypt(key: Uint8Array, nonce: Uint8Array, data: Uint8Array): Uint8Array | null {
  try {
    // Create a ChaCha20-Poly1305 instance with the key
    const chacha = chacha20poly1305(key, {});
    
    // Decrypt and verify the data
    // This will throw an error if the authentication tag doesn't match
    return chacha.open(nonce, data);
  } catch (error) {
    console.error('[Socket] ChaCha20-Poly1305 authentication failed:', error);
    return null;
  }
}

/**
 * Encrypt data using the session key
 * @param data Data to encrypt
 * @param sessionKey Session key for encryption
 * @returns Encrypted data and nonce
 */
export async function encryptData(
  data: any, 
  sessionKey: Uint8Array
): Promise<{encrypted: Uint8Array, nonce: Uint8Array}> {
  if (!sessionKey) {
    throw new Error('No session key available for encryption');
  }
  
  // Convert data to JSON string
  const jsonData = JSON.stringify(data);
  
  // Convert string to Uint8Array for encryption
  const encoder = new TextEncoder();
  const messageUint8 = encoder.encode(jsonData);
  
  // Generate a 12-byte nonce as required by the server's ChaCha20-Poly1305 implementation
  const nonce = new Uint8Array(12);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(nonce);
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < 12; i++) {
      nonce[i] = Math.floor(Math.random() * 256);
    }
  }
  
  try {
    let encrypted: Uint8Array;
    
    // First, try to use Web Crypto API with ChaCha20-Poly1305
    try {
      // Import key
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw', 
        sessionKey, 
        { name: 'ChaCha20-Poly1305' },
        false, 
        ['encrypt']
      );
      
      // Encrypt data
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        {
          name: 'ChaCha20-Poly1305',
          iv: nonce
        },
        cryptoKey,
        messageUint8
      );
      
      encrypted = new Uint8Array(encryptedBuffer);
      console.log('[Socket] Successfully used Web Crypto API for ChaCha20-Poly1305 encryption');
    } catch (webCryptoError) {
      // Web Crypto API failed or doesn't support ChaCha20-Poly1305
      console.warn('[Socket] Web Crypto API not available for ChaCha20-Poly1305, using @noble/ciphers implementation', webCryptoError);
      
      // Use @noble/ciphers ChaCha20-Poly1305 implementation which is compatible with Rust's chacha20poly1305
      encrypted = chacha20poly1305Encrypt(sessionKey, nonce, messageUint8);
      console.log('[Socket] Successfully used @noble/ciphers ChaCha20-Poly1305 for encryption');
    }
    
    if (!encrypted) {
      throw new Error('Encryption failed - could not produce ciphertext');
    }
    
    return {
      encrypted,
      nonce
    };
  } catch (error) {
    console.error('[Socket] Encryption error:', error);
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decrypt data using the session key
 * @param encrypted Encrypted data
 * @param nonce Nonce used for encryption
 * @param sessionKey Session key for decryption
 * @returns Decrypted data
 */
export async function decryptData(
  encrypted: Uint8Array, 
  nonce: Uint8Array, 
  sessionKey: Uint8Array
): Promise<any> {
  if (!sessionKey) {
    throw new Error('No session key available for decryption');
  }
  
  try {
    // Validate the nonce size - server should be sending 12-byte nonces
    if (nonce.length !== 12) {
      console.warn(`[Socket] Unexpected nonce length from server: ${nonce.length} bytes (expected 12)`);
      // If the nonce is not 12 bytes but is 24 bytes, try to use only the first 12 bytes
      if (nonce.length === 24) {
        nonce = nonce.slice(0, 12);
      } else {
        throw new Error(`Invalid nonce length: ${nonce.length} (expected 12 bytes)`);
      }
    }
    
    let decryptedData: Uint8Array | null = null;
    
    // First try WebCrypto API with ChaCha20-Poly1305
    try {
      // Import key
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        sessionKey,
        { name: 'ChaCha20-Poly1305' },
        false,
        ['decrypt']
      );
      
      // Decrypt data
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'ChaCha20-Poly1305',
          iv: nonce
        },
        cryptoKey,
        encrypted
      );
      
      decryptedData = new Uint8Array(decryptedBuffer);
      console.log('[Socket] Successfully used Web Crypto API for ChaCha20-Poly1305 decryption');
    } catch (webCryptoError) {
      // Web Crypto API failed or doesn't support ChaCha20-Poly1305
      console.warn('[Socket] Web Crypto API not available for ChaCha20-Poly1305 decryption, using @noble/ciphers implementation', webCryptoError);
      
      // Use @noble/ciphers ChaCha20-Poly1305 implementation which is compatible with Rust's chacha20poly1305
      decryptedData = chacha20poly1305Decrypt(sessionKey, nonce, encrypted);
      
      if (!decryptedData) {
        throw new Error('Decryption failed - authentication tag mismatch or corrupted data');
      }
      
      console.log('[Socket] Successfully used @noble/ciphers ChaCha20-Poly1305 for decryption');
    }
    
    if (!decryptedData) {
      throw new Error('Decryption failed - no decrypted data produced');
    }
    
    // Convert binary data to string
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedData);
    
    try {
      return JSON.parse(jsonString);
    } catch (jsonError) {
      console.error('[Socket] Error parsing decrypted JSON:', jsonError);
      throw new Error('Invalid JSON in decrypted message');
    }
  } catch (error) {
    console.error('[Socket] Decryption error:', error);
    // Log details for debugging
    console.debug('[Socket] Decryption details:', {
      encryptedLength: encrypted.length,
      nonceLength: nonce.length,
      keyLength: sessionKey.length,
      // Don't log the actual key or nonce values for security reasons
    });
    
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Sign a challenge with the secret key
 * @param challenge Challenge data
 * @param secretKey Secret key for signing
 * @returns Signature as a string
 */
export async function signChallenge(challenge: Uint8Array, secretKey: Uint8Array): Promise<string> {
  try {
    // Sign the challenge using Ed25519
    const signature = nacl.sign.detached(challenge, secretKey);
    
    // Convert signature to base58 string
    return bs58.encode(signature);
  } catch (error) {
    console.error('[Socket] Error signing challenge:', error);
    throw error;
  }
}

/**
 * Generate a session key using ECDH if server public key is available
 * @param serverPublicKey Server's public key
 * @param clientSecretKey Client's secret key
 * @returns Generated session key
 */
export async function generateSessionKey(
  serverPublicKey: Uint8Array,
  clientSecretKey: Uint8Array
): Promise<Uint8Array> {
  try {
    // For Ed25519 secret keys, we need to use the first 32 bytes for X25519
    const secretKeyX25519 = clientSecretKey.slice(0, 32);
    
    // Compute shared secret using scalar multiplication (ECDH)
    const sharedSecret = nacl.scalarMult(secretKeyX25519, serverPublicKey);
    
    return sharedSecret;
  } catch (error) {
    console.error('[Socket] Error generating session key:', error);
    throw error;
  }
}
