// src/utils/cryptoUtils.ts

import * as bs58 from 'bs58';
import * as nacl from 'tweetnacl';
import { Buffer } from 'buffer';

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
      console.debug('[Crypto:ENCRYPT] Using Web Crypto API for AES-GCM encryption');
      
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
      
      console.debug('[Crypto:ENCRYPT] Encryption successful:', {
        plaintextLength: plaintextData.length,
        ciphertextLength: ciphertext.length,
        ciphertextFirstBytes: Array.from(ciphertext.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')
      });
      
      return { ciphertext, nonce };
    } else {
      console.error('[Crypto:ENCRYPT] Web Crypto API not available for encryption');
      throw new Error('Web Crypto API not available');
    }
  } catch (error) {
    console.error('[Crypto:ENCRYPT] Encryption error:', error);
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
  
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      console.debug('[Crypto:DECRYPT] Using Web Crypto API for AES-GCM decryption');
      
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
    console.error('[Crypto:DECRYPT] Decryption error:', error);
    throw new Error(`AES-GCM decryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
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
    } catch (e) {
      // Fallback to base64
      try {
        const buffer = Buffer.from(challengeData, 'base64');
        parsed = new Uint8Array(buffer);
      } catch (e2) {
        // Last resort: try to use the string directly as UTF-8
        const encoder = new TextEncoder();
        parsed = encoder.encode(challengeData);
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
  
  // Encrypt with AES-GCM
  const { ciphertext, nonce } = await encryptWithAesGcm(messageString, sessionKey);
  
  // Create packet with the correct field names
  return {
    type: 'Data',
    encrypted: Array.from(ciphertext),
    nonce: Array.from(nonce),
    counter: counter,
    encryption_algorithm: 'aes256gcm', // Server expects this format
    padding: null // Optional padding
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
    const algorithm = packet.encryption_algorithm || packet.encryption || 'aes256gcm';
    
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
 * Convert Ed25519 public key to Curve25519 public key for ECDH
 * This function implements the conversion algorithm used by libsodium/tweetnacl
 * 
 * @param edPublicKey Ed25519 public key (32 bytes)
 * @returns Curve25519 public key or null if conversion fails
 */
export function convertEd25519PublicKeyToCurve25519(edPublicKey: Uint8Array): Uint8Array | null {
  if (edPublicKey.length !== 32) {
    console.error("[Crypto] Invalid Ed25519 public key length:", edPublicKey.length);
    return null;
  }
  
  try {
    // Use tweetnacl's built-in conversion function
    const curveKey = nacl.convertPublicKey(edPublicKey);
    if (!curveKey) {
      console.error("[Crypto] Failed to convert Ed25519 public key to Curve25519");
      return null;
    }
    return curveKey;
  } catch (error) {
    console.error("[Crypto] Error converting Ed25519 public key:", error);
    return null;
  }
}

/**
 * Convert Ed25519 secret key to Curve25519 secret key for ECDH
 * This function implements the conversion algorithm used by libsodium/tweetnacl
 * 
 * @param edSecretKey64 Ed25519 secret key (64 bytes)
 * @returns Curve25519 secret key (32 bytes)
 */
export function convertEd25519SecretKeyToCurve25519(edSecretKey64: Uint8Array): Uint8Array {
  if (edSecretKey64.length !== 64) {
    throw new Error(`Invalid Ed25519 secret key length: ${edSecretKey64.length} (expected 64 bytes)`);
  }
  
  // Extract the seed (first 32 bytes) from the Ed25519 secret key
  const seed = edSecretKey64.slice(0, 32);
  
  // Use tweetnacl to derive Curve25519 keys
  const curveKeyPair = nacl.box.keyPair.fromSecretKey(
    nacl.hash(seed).slice(0, 32)
  );
  
  return curveKeyPair.secretKey;
}

/**
 * Derive ECDH shared secret compatible with the Rust server's method
 * 
 * @param clientEdSecretKey64 Client's 64-byte Ed25519 Secret Key
 * @param serverEdPublicKey32 Server's 32-byte Ed25519 Public Key
 * @returns 32-byte shared secret, or null on conversion failure
 */
export function deriveECDHSharedSecret(
  clientEdSecretKey64: Uint8Array,
  serverEdPublicKey32: Uint8Array
): Uint8Array | null {
  if (clientEdSecretKey64.length !== 64) {
    throw new Error(`Invalid client secret key length: ${clientEdSecretKey64.length}`);
  }
  if (serverEdPublicKey32.length !== 32) {
    throw new Error(`Invalid server public key length: ${serverEdPublicKey32.length}`);
  }

  // 1. Convert keys to Curve25519 format
  const clientCurveSecretKey = convertEd25519SecretKeyToCurve25519(clientEdSecretKey64);
  const serverCurvePublicKey = convertEd25519PublicKeyToCurve25519(serverEdPublicKey32);

  if (!serverCurvePublicKey) {
    console.error("[Crypto] Failed to convert server public key for ECDH.");
    return null;
  }

  console.debug("[Crypto] Keys converted for ECDH:", {
    clientCurveSecretKeyLength: clientCurveSecretKey.length,
    serverCurvePublicKeyLength: serverCurvePublicKey.length,
  });

  // 2. Perform ECDH using nacl.box.before
  const sharedSecret = nacl.box.before(serverCurvePublicKey, clientCurveSecretKey);
  
  console.debug("[Crypto] Raw ECDH Shared Secret Derived:", {
    length: sharedSecret.length,
    prefix: Buffer.from(sharedSecret.slice(0, 8)).toString('hex')
  });
  
  return sharedSecret;
}

/**
 * Derive a session key from ECDH shared secret using HKDF-SHA256 (Web Crypto API)
 * Matches the server's use of HKDF.
 * 
 * @param sharedSecret The raw 32-byte shared secret from ECDH
 * @param salt A salt (usually empty or specific string, must match server)
 * @returns Promise resolving to a 32-byte session key
 */
export async function deriveSessionKeyHKDF(sharedSecret: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  if (!sharedSecret || sharedSecret.length !== 32) {
    throw new Error('Invalid shared secret for HKDF');
  }

  console.debug('[Crypto] Deriving session key via HKDF:', {
    sharedSecretPrefix: Buffer.from(sharedSecret.slice(0, 8)).toString('hex'),
    saltLength: salt.length,
    saltPrefix: salt.length > 0 ? Buffer.from(salt.slice(0, 8)).toString('hex') : 'empty',
    info: 'AERONYX-SESSION-KEY'
  });

  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error("Web Crypto API not available for HKDF");
  }

  try {
    // Import shared secret as the base key material for HKDF
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      sharedSecret,
      { name: 'HKDF' },
      false, // not extractable
      ['deriveBits']
    );

    // Derive the key bits using HKDF
    const derivedBits = await window.crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256', // Matches server
        salt: salt,       // Use the provided salt (empty buffer if server uses None)
        info: new TextEncoder().encode('AERONYX-SESSION-KEY') // MUST match server's info
      },
      baseKey,
      256 // Derive 256 bits (32 bytes)
    );

    const derivedKey = new Uint8Array(derivedBits);
    console.debug('[Crypto] HKDF Session Key Derived:', {
      derivedKeyLength: derivedKey.length,
      derivedKeyPrefix: Buffer.from(derivedKey.slice(0, 8)).toString('hex')
    });
    
    return derivedKey;
  } catch (error) {
    console.error('[Crypto] HKDF key derivation failed:', error);
    throw new Error(`HKDF derivation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
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
    
    // Encrypt
    const { ciphertext, nonce } = await encryptWithAesGcm(testString, sessionKey);
    
    // Create packet
    const packet = {
      type: "Data",
      encrypted: Array.from(ciphertext),
      nonce: Array.from(nonce),
      counter: 1,
      encryption_algorithm: "aes256gcm"
    };
    
    // Decrypt
    const decrypted = await decryptWithAesGcm(
      new Uint8Array(packet.encrypted),
      new Uint8Array(packet.nonce),
      sessionKey,
      'string'
    );
    
    // Parse and verify
    const parsedDecrypted = JSON.parse(decrypted as string);
    
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
