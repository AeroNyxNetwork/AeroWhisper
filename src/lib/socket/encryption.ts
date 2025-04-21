import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';

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
    // Using Web Crypto API for ChaCha20-Poly1305 encryption
    // First, check if we can use WebCrypto with ChaCha20-Poly1305
    let encrypted: Uint8Array;
    
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
      // If Web Crypto API fails or doesn't support ChaCha20-Poly1305, fall back to TweetNaCl
      console.warn('[Socket] Web Crypto API not available for ChaCha20-Poly1305, falling back to TweetNaCl', webCryptoError);
      
      // For fallback, we'll use TweetNaCl but note that this isn't compatible with server
      // This is just a fallback to avoid completely breaking
      // Create a 24-byte nonce for TweetNaCl by padding the original 12-byte nonce with zeros
      const paddedNonce = new Uint8Array(nacl.secretbox.nonceLength);
      paddedNonce.set(nonce); // Copy the first 12 bytes, leaving the rest as zeros
      
      // Use the session key for encryption (ensuring it's 32 bytes for TweetNaCl)
      const key = sessionKey.length === 32 ? 
        sessionKey : 
        (sessionKey.length > 32 ? 
          sessionKey.slice(0, 32) : 
          (() => {
            const fullKey = new Uint8Array(32);
            fullKey.set(sessionKey);
            return fullKey;
          })());
      
      // Encrypt with TweetNaCl's secretbox (but this won't be compatible with server)
      encrypted = nacl.secretbox(messageUint8, paddedNonce, key);
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
      // If the nonce is not 12 bytes but is 24 bytes, we might try to use only the first 12 bytes
      if (nonce.length === 24) {
        nonce = nonce.slice(0, 12);
      } else {
        throw new Error(`Invalid nonce length: ${nonce.length} (expected 12 bytes)`);
      }
    }
    
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
      
      // Convert decrypted data to string
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(new Uint8Array(decryptedBuffer));
      
      console.log('[Socket] Successfully used Web Crypto API for ChaCha20-Poly1305 decryption');
      
      // Parse JSON data
      try {
        return JSON.parse(jsonString);
      } catch (jsonError) {
        console.error('[Socket] Error parsing decrypted JSON:', jsonError);
        throw new Error('Invalid JSON in decrypted message');
      }
    } catch (webCryptoError) {
      // If Web Crypto API fails or doesn't support ChaCha20-Poly1305, fall back to TweetNaCl
      console.warn('[Socket] Web Crypto API not available for ChaCha20-Poly1305, falling back to TweetNaCl', webCryptoError);
      
      // Create a 24-byte nonce for TweetNaCl by padding the original 12-byte nonce with zeros
      const paddedNonce = new Uint8Array(nacl.secretbox.nonceLength);
      paddedNonce.set(nonce); // Copy the 12-byte nonce, leaving the rest as zeros
      
      // Ensure the key is the right size for TweetNaCl (32 bytes)
      const key = sessionKey.length === 32 ? 
        sessionKey : 
        (sessionKey.length > 32 ? 
          sessionKey.slice(0, 32) : 
          (() => {
            const fullKey = new Uint8Array(32);
            fullKey.set(sessionKey);
            return fullKey;
          })());
      
      // Try to decrypt with TweetNaCl (but this will likely fail for server-encrypted data)
      const decrypted = nacl.secretbox.open(encrypted, paddedNonce, key);
      
      if (!decrypted) {
        throw new Error('Decryption failed - authentication tag mismatch or corrupted data');
      }
      
      // Convert binary data to string
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(decrypted);
      
      try {
        return JSON.parse(jsonString);
      } catch (jsonError) {
        console.error('[Socket] Error parsing decrypted JSON:', jsonError);
        throw new Error('Invalid JSON in decrypted message');
      }
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
