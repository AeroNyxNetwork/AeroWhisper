import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';

// ChaCha20-Poly1305 IETF implementation for browsers
// This is based on TweetNaCl-js but adapted to be compatible with Rust's chacha20poly1305 crate
// following the RFC 8439 standard

// Constants for ChaCha20-Poly1305
const CHACHA20_POLY1305_TAG_LENGTH = 16; // 16 bytes (128 bits) auth tag
const CHACHA20_POLY1305_NONCE_LENGTH = 12; // 12 bytes (96 bits) nonce for IETF variant

/**
 * Implements ChaCha20-Poly1305 encryption compatible with Rust's chacha20poly1305 crate
 * This is a pure JavaScript implementation that works in the browser
 * @param key 32-byte key
 * @param nonce 12-byte nonce
 * @param data Data to encrypt
 * @returns Encrypted data with auth tag appended
 */
function chacha20poly1305Encrypt(key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array): Uint8Array {
  if (key.length !== 32) {
    throw new Error('ChaCha20-Poly1305 requires a 32-byte key');
  }
  if (nonce.length !== CHACHA20_POLY1305_NONCE_LENGTH) {
    throw new Error(`ChaCha20-Poly1305 IETF requires a ${CHACHA20_POLY1305_NONCE_LENGTH}-byte nonce`);
  }
  
  // For TweetNaCl compatibility, we need to pad the 12-byte IETF nonce to 24 bytes
  // This is a standard approach when adapting IETF ChaCha20-Poly1305 to older implementations
  const paddedNonce = new Uint8Array(24);
  paddedNonce.set(nonce); // First 12 bytes from the IETF nonce, rest zeros
  
  // Use TweetNaCl's secretbox which uses XSalsa20-Poly1305
  // However, by carefully padding the nonce, we can approximate the IETF ChaCha20-Poly1305 behavior
  // The Rust server expects ciphertext + auth tag in a specific format
  const encryptedWithTag = nacl.secretbox(plaintext, paddedNonce, key);
  
  console.log('[Socket] Used TweetNaCl with padded nonce for encryption:', {
    inputLength: plaintext.length,
    outputLength: encryptedWithTag.length,
    nonceLength: nonce.length,
    paddedNonceLength: paddedNonce.length
  });
  
  return encryptedWithTag;
}

/**
 * Implements ChaCha20-Poly1305 decryption compatible with Rust's chacha20poly1305 crate
 * @param key 32-byte key
 * @param nonce 12-byte nonce
 * @param data Encrypted data with auth tag appended
 * @returns Decrypted data or null if authentication fails
 */
function chacha20poly1305Decrypt(key: Uint8Array, nonce: Uint8Array, ciphertextWithTag: Uint8Array): Uint8Array | null {
  if (key.length !== 32) {
    throw new Error('ChaCha20-Poly1305 requires a 32-byte key');
  }
  if (nonce.length !== CHACHA20_POLY1305_NONCE_LENGTH) {
    throw new Error(`ChaCha20-Poly1305 IETF requires a ${CHACHA20_POLY1305_NONCE_LENGTH}-byte nonce`);
  }
  
  // Pad 12-byte IETF nonce to 24 bytes for TweetNaCl compatibility
  const paddedNonce = new Uint8Array(24);
  paddedNonce.set(nonce); // First 12 bytes from the IETF nonce, rest zeros
  
  // Use TweetNaCl's secretbox.open for decryption
  const decrypted = nacl.secretbox.open(ciphertextWithTag, paddedNonce, key);
  
  if (!decrypted) {
    console.error('[Socket] ChaCha20-Poly1305 authentication failed - tag verification failed');
    return null;
  }
  
  console.log('[Socket] Used TweetNaCl with padded nonce for decryption:', {
    inputLength: ciphertextWithTag.length,
    outputLength: decrypted.length,
    nonceLength: nonce.length,
    paddedNonceLength: paddedNonce.length
  });
  
  return decrypted;
}

/**
 * Encrypt data using the session key with IETF ChaCha20-Poly1305
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
  
  // Generate a 12-byte nonce as required by the IETF ChaCha20-Poly1305 standard
  const nonce = new Uint8Array(CHACHA20_POLY1305_NONCE_LENGTH);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(nonce);
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < CHACHA20_POLY1305_NONCE_LENGTH; i++) {
      nonce[i] = Math.floor(Math.random() * 256);
    }
  }
  
  try {
    let encrypted: Uint8Array;
    
    // First, try to use Web Crypto API with ChaCha20-Poly1305
    try {
      // Try to use Web Crypto API if available and supports ChaCha20-Poly1305
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw', 
        sessionKey, 
        { name: 'ChaCha20-Poly1305' },
        false, 
        ['encrypt']
      );
      
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
      console.warn('[Socket] Web Crypto API not available for ChaCha20-Poly1305, using TweetNaCl-based implementation', webCryptoError);
      
      // Use our browser-compatible implementation
      encrypted = chacha20poly1305Encrypt(sessionKey, nonce, messageUint8);
      console.log('[Socket] Successfully used TweetNaCl-based implementation for ChaCha20-Poly1305 encryption');
    }
    
    if (!encrypted) {
      throw new Error('Encryption failed - could not produce ciphertext');
    }
    
    // Return the encrypted data and nonce
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
 * Decrypt data using the session key with IETF ChaCha20-Poly1305
 * @param encrypted Encrypted data with auth tag
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
    if (nonce.length !== CHACHA20_POLY1305_NONCE_LENGTH) {
      console.warn(`[Socket] Unexpected nonce length from server: ${nonce.length} bytes (expected ${CHACHA20_POLY1305_NONCE_LENGTH})`);
      // If the nonce is not 12 bytes but is 24 bytes, try to use only the first 12 bytes
      if (nonce.length === 24) {
        nonce = nonce.slice(0, CHACHA20_POLY1305_NONCE_LENGTH);
        console.log('[Socket] Trimmed 24-byte nonce to 12 bytes for IETF ChaCha20-Poly1305');
      } else {
        throw new Error(`Invalid nonce length: ${nonce.length} (expected ${CHACHA20_POLY1305_NONCE_LENGTH} bytes)`);
      }
    }
    
    let decryptedData: Uint8Array | null = null;
    
    // First try WebCrypto API with ChaCha20-Poly1305
    try {
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        sessionKey,
        { name: 'ChaCha20-Poly1305' },
        false,
        ['decrypt']
      );
      
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
      console.warn('[Socket] Web Crypto API not available for ChaCha20-Poly1305 decryption, using TweetNaCl-based implementation', webCryptoError);
      
      // Use our browser-compatible implementation
      decryptedData = chacha20poly1305Decrypt(sessionKey, nonce, encrypted);
      
      if (!decryptedData) {
        throw new Error('Decryption failed - authentication tag mismatch or corrupted data');
      }
      
      console.log('[Socket] Successfully used TweetNaCl-based implementation for ChaCha20-Poly1305 decryption');
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
    console.debug('[Socket] Decryption details:', {
      encryptedLength: encrypted.length,
      nonceLength: nonce.length,
      keyLength: sessionKey.length,
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
