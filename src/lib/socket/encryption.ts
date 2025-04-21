import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';

// Add ChaCha20-Poly1305 polyfill implementation
// This is a placeholder where you'd import a compatible implementation
// NOTE: You'll need to add a compatible library to your project

/**
 * ChaCha20-Poly1305 IETF implementation that is compatible with Rust's chacha20poly1305 crate
 * 
 * !!! IMPORTANT: This is a placeholder. You MUST replace this with a proper implementation !!!
 * 
 * Recommendation: Use a library like '@noble/ciphers' that provides IETF standard ChaCha20-Poly1305
 * with 12-byte nonce support to ensure compatibility with your Rust server.
 * 
 * @param key 32-byte key as Uint8Array
 * @param nonce 12-byte nonce as Uint8Array
 * @param data Data to encrypt
 * @returns Encrypted data (ciphertext + auth tag)
 */
function chacha20poly1305Encrypt(key: Uint8Array, nonce: Uint8Array, data: Uint8Array): Uint8Array {
  // THIS IS A PLACEHOLDER - Replace with actual implementation using a proper library
  // Example using hypothetical library:
  // return chacha20poly1305.encrypt(key, nonce, data);
  
  throw new Error('PLACEHOLDER: You must implement proper ChaCha20-Poly1305 encryption');
}

/**
 * ChaCha20-Poly1305 IETF implementation that is compatible with Rust's chacha20poly1305 crate
 * 
 * !!! IMPORTANT: This is a placeholder. You MUST replace this with a proper implementation !!!
 * 
 * @param key 32-byte key as Uint8Array
 * @param nonce 12-byte nonce as Uint8Array
 * @param data Encrypted data to decrypt (ciphertext + auth tag)
 * @returns Decrypted data or null if authentication fails
 */
function chacha20poly1305Decrypt(key: Uint8Array, nonce: Uint8Array, data: Uint8Array): Uint8Array | null {
  // THIS IS A PLACEHOLDER - Replace with actual implementation using a proper library
  // Example using hypothetical library:
  // return chacha20poly1305.decrypt(key, nonce, data);
  
  throw new Error('PLACEHOLDER: You must implement proper ChaCha20-Poly1305 decryption');
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
        // Try different algorithm identifiers if needed
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
      // Web Crypto API didn't work - use compatible polyfill implementation
      console.warn('[Socket] Web Crypto API not available for ChaCha20-Poly1305, using polyfill', webCryptoError);
      
      // CRITICAL FIX: Use ChaCha20-Poly1305 polyfill that's compatible with the server
      // instead of falling back to incompatible nacl.secretbox (XSalsa20-Poly1305)
      try {
        encrypted = chacha20poly1305Encrypt(sessionKey, nonce, messageUint8);
        console.log('[Socket] Successfully used ChaCha20-Poly1305 polyfill for encryption');
      } catch (polyfillError) {
        console.error('[Socket] ChaCha20-Poly1305 polyfill failed:', polyfillError);
        throw new Error('Encryption failed - ChaCha20-Poly1305 implementation required');
      }
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
      // Web Crypto API failed - use compatible polyfill implementation
      console.warn('[Socket] Web Crypto API not available for ChaCha20-Poly1305 decryption, using polyfill', webCryptoError);
      
      // CRITICAL FIX: Use ChaCha20-Poly1305 polyfill that's compatible with the server
      // instead of falling back to incompatible nacl.secretbox.open (XSalsa20-Poly1305)
      try {
        decryptedData = chacha20poly1305Decrypt(sessionKey, nonce, encrypted);
        
        if (!decryptedData) {
          throw new Error('Decryption failed - authentication tag mismatch or corrupted data');
        }
        
        console.log('[Socket] Successfully used ChaCha20-Poly1305 polyfill for decryption');
      } catch (polyfillError) {
        console.error('[Socket] ChaCha20-Poly1305 polyfill failed:', polyfillError);
        throw new Error('Decryption failed - ChaCha20-Poly1305 implementation required');
      }
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
