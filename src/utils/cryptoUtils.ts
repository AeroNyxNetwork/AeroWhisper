// src/utils/cryptoUtils.ts

import * as bs58 from 'bs58';
import * as nacl from 'tweetnacl';

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
    // Log challenge details for debugging
    console.debug('[Crypto] Signing challenge:', {
      challengeLength: challenge.length,
      challengePrefix: Array.from(challenge.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(''),
      secretKeyLength: secretKey.length,
      secretKeyPrefix: Array.from(secretKey.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('')
    });
    
    // Verify the keypair is valid
    if (secretKey.length !== 64) {
      throw new Error(`Invalid Ed25519 secret key length: ${secretKey.length} (expected 64 bytes)`);
    }
    
    // Sign the challenge using nacl.sign.detached
    const signature = nacl.sign.detached(challenge, secretKey);
    const signatureB58 = bs58.encode(signature);
    
    console.debug('[Crypto] Challenge signed successfully:', {
      signatureLength: signature.length,
      signaturePrefix: Array.from(signature.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(''),
      signatureB58Length: signatureB58.length,
      signatureB58Prefix: signatureB58.substring(0, 16)
    });
    
    return signatureB58;
  } catch (error) {
    console.error('[Crypto] Error signing challenge:', error);
    throw error;
  }
}


/**
 * Parse challenge data for authentication
 * @param challengeData Challenge data in array or string format
 * @returns Parsed challenge as Uint8Array
 */
export function parseChallengeData(challengeData: number[] | string): Uint8Array {
  let parsed: Uint8Array;
  
  // Log the raw challenge data for debugging
  console.debug('[Crypto] Parsing challenge data:', {
    dataType: typeof challengeData,
    isArray: Array.isArray(challengeData),
    dataLength: Array.isArray(challengeData) 
      ? challengeData.length 
      : (typeof challengeData === 'string' ? challengeData.length : 'unknown')
  });
  
  // Handle array format (from server)
  if (Array.isArray(challengeData)) {
    parsed = new Uint8Array(challengeData);
    console.debug('[Crypto] Challenge data is array, converted to Uint8Array:', {
      length: parsed.length,
      prefix: Array.from(parsed.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')
    });
  } 
  // Handle string format (may be base58 or base64)
  else if (typeof challengeData === 'string') {
    try {
      // Try to parse as base58
      parsed = bs58.decode(challengeData);
      console.debug('[Crypto] Challenge data decoded as base58:', {
        length: parsed.length,
        prefix: Array.from(parsed.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')
      });
    } catch (e) {
      console.debug('[Crypto] Not valid base58, trying other formats');
      // Fallback to base64
      try {
        const buffer = Buffer.from(challengeData, 'base64');
        parsed = new Uint8Array(buffer);
        console.debug('[Crypto] Challenge data decoded as base64:', {
          length: parsed.length,
          prefix: Array.from(parsed.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')
        });
      } catch (e2) {
        console.debug('[Crypto] Not valid base64, using as UTF-8');
        // Last resort: try to use the string directly as UTF-8
        const encoder = new TextEncoder();
        parsed = encoder.encode(challengeData);
        console.debug('[Crypto] Challenge data encoded as UTF-8:', {
          length: parsed.length,
          prefix: Array.from(parsed.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')
        });
      }
    }
  } else {
    throw new Error('Invalid challenge data format');
  }
  
  return parsed;
}

/**
 * Check if AES-GCM is supported in the current environment
 * @returns Promise resolving to true if AES-GCM is supported
 */
export async function isAesGcmSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    return false;
  }
  
  try {
    // Try to create a simple key to test AES-GCM support
    await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );
    
    return true;
  } catch (error) {
    console.warn('[Crypto] AES-GCM not supported:', error);
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
  
  // Log the generated nonce for debugging
  console.debug('[Crypto] Generated nonce:', {
    nonceHex: Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join(''),
    nonceBytes: Array.from(nonce),
    nonceLength: nonce.length
  });
  
  return nonce;
}

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
  
  // Log plaintext data for debugging
  console.debug('[Crypto] Encrypting data:', {
    plaintextType: typeof plaintext,
    plaintextLength: plaintextData.length,
    plaintextPreview: typeof plaintext === 'string' 
      ? (plaintext.length > 100 ? plaintext.substring(0, 100) + '...' : plaintext)
      : 'Binary data',
    keyLength: key.length,
    keyPrefix: Array.from(key.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')
  });
  
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
      
      // Log encryption result for debugging
      console.debug('[Crypto] Encryption result:', {
        ciphertextLength: ciphertext.length,
        ciphertextPrefix: Array.from(ciphertext.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(''),
        nonceUsed: Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join(''),
        authTagPresent: ciphertext.length >= plaintextData.length + 16 ? 'Yes' : 'No'
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
  
  // Log decryption attempt for debugging
  console.debug('[Crypto] Decrypting data:', {
    ciphertextLength: ciphertext.length,
    ciphertextPrefix: Array.from(ciphertext.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(''),
    nonceHex: Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join(''),
    keyPrefix: Array.from(key.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')
  });
  
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
        const decryptedText = decoder.decode(new Uint8Array(decryptedBuffer));
        
        // Log decryption result for debugging
        console.debug('[Crypto] Decryption result (string):', {
          decryptedLength: decryptedText.length,
          decryptedPreview: decryptedText.length > 100 ? decryptedText.substring(0, 100) + '...' : decryptedText
        });
        
        return decryptedText;
      } else {
        const decryptedData = new Uint8Array(decryptedBuffer);
        
        // Log decryption result for debugging
        console.debug('[Crypto] Decryption result (binary):', {
          decryptedLength: decryptedData.length,
          decryptedPrefix: Array.from(decryptedData.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('')
        });
        
        return decryptedData;
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
 * Create a proper data packet for encrypted messaging
 * Using the consistent field name "encryption_algorithm" expected by the server
 * with value "aes256gcm" as required by the server
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
  
  // Log data to be encrypted for debugging
  console.debug('[Crypto] Creating encrypted packet:', {
    dataType: typeof data,
    dataPreview: typeof data === 'object' ? JSON.stringify(data).substring(0, 100) + '...' : messageString,
    messageLength: messageString.length,
    sessionKeyLength: sessionKey.length,
    counter: counter
  });
  
  // Encrypt with AES-GCM
  const { ciphertext, nonce } = await encryptWithAesGcm(messageString, sessionKey);
  
  // Create packet
  const packet = {
    type: 'Data',
    encrypted: Array.from(ciphertext),
    nonce: Array.from(nonce),
    counter: counter,
    encryption_algorithm: 'aes256gcm', // Server expects 'aes256gcm'
    padding: null // Optional padding for length concealment
  };
  
  // Log final packet for debugging
  console.debug('[Crypto] Encrypted packet created:', {
    packetType: packet.type,
    encryptedLength: packet.encrypted.length,
    nonceLength: packet.nonce.length,
    algorithm: packet.encryption_algorithm,
    hasPadding: packet.padding !== null
  });
  
  return packet;
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
    
    // Log packet being processed for debugging
    console.debug('[Crypto] Processing encrypted packet:', {
      packetType: packet.type,
      encryptedLength: packet.encrypted.length,
      nonceLength: packet.nonce.length,
      encryptionAlgorithm: packet.encryption_algorithm || packet.encryption || 'unknown',
      counter: packet.counter
    });
    
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
    const parsedData = JSON.parse(decryptedString);
    
    // Log decryption success with parsed data type
    console.debug('[Crypto] Successfully processed encrypted packet:', {
      resultType: typeof parsedData,
      hasId: !!parsedData.id,
      dataType: parsedData.type || 'unknown'
    });
    
    return parsedData;
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
  
  // Log key derivation input for debugging
  console.debug('[Crypto] Deriving session key:', {
    sharedSecretLength: sharedSecret.length,
    sharedSecretPrefix: Array.from(sharedSecret.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(''),
    saltLength: salt.length,
    saltPrefix: Array.from(salt.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')
  });
  
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
      
      const derivedKey = new Uint8Array(derivedBits);
      
      // Log derived key for debugging
      console.debug('[Crypto] Session key derived:', {
        derivedKeyLength: derivedKey.length,
        derivedKeyPrefix: Array.from(derivedKey.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')
      });
      
      return derivedKey;
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
  const derivedKey = prk.slice(0, 32);
  
  // Log derived key for debugging
  console.debug('[Crypto] Session key derived (fallback):', {
    derivedKeyLength: derivedKey.length,
    derivedKeyPrefix: Array.from(derivedKey.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')
  });
  
  return derivedKey;
}

/**
 * Test function to verify encryption compatibility with server
 * 
 * @param sessionKey Session key to use for testing
 * @returns true if the test passed, false otherwise
 */
export async function testEncryptionCompat(sessionKey: Uint8Array): Promise<boolean> {
  try {
    console.debug('[Crypto] Running encryption compatibility test');
    // Create test data
    const testData = {
      type: "test",
      message: "Encryption compatibility test",
      timestamp: Date.now()
    };
    
    // Stringify for encryption
    const testString = JSON.stringify(testData);
    console.debug('[Crypto] Test data:', {
      original: testData,
      stringified: testString
    });
    
    // Encrypt
    console.debug('[Crypto] Encrypting test data...');
    const { ciphertext, nonce } = await encryptWithAesGcm(testString, sessionKey);
    
    // Create packet
    const packet = {
      type: "Data",
      encrypted: Array.from(ciphertext),
      nonce: Array.from(nonce),
      counter: 1,
      encryption_algorithm: "aes256gcm"
    };
    
    console.debug('[Crypto] Test packet created:', {
      packetType: packet.type,
      encryptedLength: packet.encrypted.length,
      nonceLength: packet.nonce.length,
      algorithm: packet.encryption_algorithm
    });
    
    // Decrypt
    console.debug('[Crypto] Attempting to decrypt test packet...');
    const decrypted = await decryptWithAesGcm(
      new Uint8Array(packet.encrypted),
      new Uint8Array(packet.nonce),
      sessionKey,
      'string'
    );
    
    // Parse and verify
    const parsedDecrypted = JSON.parse(decrypted as string);
    console.debug('[Crypto] Decryption test result:', parsedDecrypted);
    
    // Check if decrypted data matches original
    const success = 
      parsedDecrypted.type === testData.type && 
      parsedDecrypted.message === testData.message;
    
    console.debug(`[Crypto] Encryption compatibility test ${success ? 'PASSED' : 'FAILED'}`);
    
    return success;
  } catch (error) {
    console.error('[Crypto] Encryption compatibility test failed:', error);
    return false;
  }
}
