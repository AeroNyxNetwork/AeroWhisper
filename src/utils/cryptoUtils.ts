// src/utils/cryptoUtils.ts

import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';
import * as ed2curve from 'ed2curve';
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
 * Convert a number array to Uint8Array
 * @param arr Array of numbers
 * @returns Uint8Array representation
 */
export function numberArrayToUint8Array(arr: number[]): Uint8Array {
  return new Uint8Array(arr);
}

/**
 * Encrypt data using AES-GCM via Web Crypto API
 * This is a unified implementation that should be used throughout the application
 * 
 * @param plaintext Data to encrypt (string or Uint8Array)
 * @param key 32-byte encryption key
 * @param nonce Optional nonce (will be generated if not provided)
 * @returns Object containing encrypted data and nonce
 */
export async function encryptWithAesGcm(
  plaintext: string | Uint8Array,
  key: Uint8Array,
  nonce?: Uint8Array
): Promise<{ ciphertext: Uint8Array, nonce: Uint8Array }> {
  if (!key || key.length !== 32) {
    throw new Error(`Invalid encryption key: length=${key?.length ?? 'null'} (expected 32 bytes)`);
  }
  
  // Convert string to Uint8Array if necessary
  const plaintextData = typeof plaintext === 'string' 
    ? new TextEncoder().encode(plaintext)
    : plaintext;
  
  // Generate a 12-byte nonce for AES-GCM if not provided
  const nonceToUse = nonce || generateNonce(12);
  
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
          iv: nonceToUse,
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
      
      return { ciphertext, nonce: nonceToUse };
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
    // Use ed2curve for key conversion
    const curveKey = ed2curve.convertPublicKey(edPublicKey);
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
  const hash = nacl.hash(seed);
  const curve25519SecretKey = hash.slice(0, 32);
  
  // Apply clamping as required for Curve25519
  curve25519SecretKey[0] &= 248;
  curve25519SecretKey[31] &= 127;
  curve25519SecretKey[31] |= 64;
  
  return curve25519SecretKey;
}

/**
 * Derive raw ECDH shared secret
 * @param curveSecretKey Curve25519 secret key (32 bytes)
 * @param curvePublicKey Curve25519 public key (32 bytes)
 * @returns Shared secret (32 bytes)
 */
export function deriveECDHRawSharedSecret(
  curveSecretKey: Uint8Array,
  curvePublicKey: Uint8Array
): Uint8Array {
  if (curveSecretKey.length !== 32) {
    throw new Error(`Invalid Curve25519 secret key length: ${curveSecretKey.length} (expected 32 bytes)`);
  }
  
  if (curvePublicKey.length !== 32) {
    throw new Error(`Invalid Curve25519 public key length: ${curvePublicKey.length} (expected 32 bytes)`);
  }
  
  try {
    // Use nacl.scalarMult for the ECDH computation
    const sharedSecret = nacl.scalarMult(curveSecretKey, curvePublicKey);
    
    console.debug('[Crypto] Derived ECDH shared secret:', {
      secretKeyHex: Buffer.from(curveSecretKey.slice(0, 4)).toString('hex') + '...',
      publicKeyHex: Buffer.from(curvePublicKey.slice(0, 4)).toString('hex') + '...',
      sharedSecretHex: Buffer.from(sharedSecret.slice(0, 4)).toString('hex') + '...'
    });
    
    return sharedSecret;
  } catch (error) {
    console.error('[Crypto] Error deriving ECDH shared secret:', error);
    throw new Error(`ECDH failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Derive a key with HKDF (HMAC-based Key Derivation Function)
 * @param inputKeyMaterial The input key material (e.g., ECDH shared secret)
 * @param salt Optional salt (default: empty array)
 * @param info Optional context and application specific information (default: 'AERONYX-SESSION-KEY')
 * @param length Output key length in bytes (default: 32)
 * @returns Derived key as Uint8Array
 */
export async function deriveKeyWithHKDF(
  inputKeyMaterial: Uint8Array,
  salt: Uint8Array = new Uint8Array(0),
  info: Uint8Array = new TextEncoder().encode('AERONYX-SESSION-KEY'),
  length: number = 32
): Promise<Uint8Array> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available for HKDF');
  }
  
  try {
    // Import the input key material
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      inputKeyMaterial,
      { name: 'HKDF' },
      false,
      ['deriveBits']
    );
    
    // Derive bits using HKDF
    const derivedBits = await window.crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256', // Use SHA-256 as the hash function
        salt: salt,
        info: info
      },
      baseKey,
      length * 8 // Convert bytes to bits
    );
    
    return new Uint8Array(derivedBits);
  } catch (error) {
    console.error('[Crypto] Error deriving key with HKDF:', error);
    throw new Error(`HKDF failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create an encrypted data packet for sending over the network
 * @param data Data to encrypt (object or string)
 * @param sessionKey Session key for encryption
 * @param counter Message counter (for replay protection)
 * @returns Data packet with encrypted content
 */
export async function createEncryptedDataPacket(
  data: any,
  sessionKey: Uint8Array,
  counter: number
): Promise<any> {
  // Convert data to string if it's an object
  const messageString = typeof data === 'string' ? data : JSON.stringify(data);
  
  // Generate nonce and encrypt
  const nonce = generateNonce();
  const { ciphertext } = await encryptWithAesGcm(messageString, sessionKey, nonce);
  
  // Create the data packet with both field names for compatibility
  // This addresses the field name inconsistency issue
  return {
    type: 'Data',
    encrypted: Array.from(ciphertext),
    nonce: Array.from(nonce),
    counter: counter,
    encryption_algorithm: 'aes256gcm', // Primary field name (server expects this)
    encryption: 'aes256gcm' // Secondary field name (for backward compatibility)
  };
}

/**
 * Process an encrypted data packet
 * @param packet Encrypted data packet
 * @param sessionKey Session key for decryption
 * @returns Decrypted data (parsed from JSON) or null on failure
 */
export async function processEncryptedDataPacket(
  packet: any,
  sessionKey: Uint8Array
): Promise<any | null> {
  try {
    if (!packet || !packet.encrypted || !packet.nonce) {
      console.warn('[Crypto] Invalid data packet structure:', packet);
      return null;
    }
    
    // Convert arrays to Uint8Arrays
    const encrypted = new Uint8Array(packet.encrypted);
    const nonce = new Uint8Array(packet.nonce);
    
    // Support both field names for backward compatibility
    const algorithm = packet.encryption_algorithm || packet.encryption;
    if (algorithm && algorithm !== 'aes256gcm') {
      console.warn(`[Crypto] Unsupported encryption algorithm: ${algorithm}`);
      return null;
    }
    
    // Decrypt the data
    const decryptedText = await decryptWithAesGcm(encrypted, nonce, sessionKey, 'string') as string;
    
    // Parse JSON
    try {
      return JSON.parse(decryptedText);
    } catch (parseError) {
      console.error('[Crypto] Failed to parse decrypted data as JSON:', parseError);
      return null;
    }
  } catch (error) {
    console.error('[Crypto] Failed to process encrypted data packet:', error);
    return null;
  }
}

/**
 * Generate a keypair for use with the application
 * @returns Generated keypair
 */
export function generateKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array; publicKeyBase58: string } {
  try {
    // Generate Ed25519 keypair
    const keypair = nacl.sign.keyPair();
    
    // Encode public key to base58 for easier sharing
    const publicKeyBase58 = bs58.encode(keypair.publicKey);
    
    return {
      publicKey: keypair.publicKey,
      secretKey: keypair.secretKey,
      publicKeyBase58
    };
  } catch (error) {
    console.error('[Crypto] Error generating keypair:', error);
    throw new Error(`Keypair generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate a unique session ID
 * @returns Random session ID string
 */
export function generateSessionId(): string {
  // Generate 16 random bytes
  const bytes = generateNonce(16);
  
  // Encode in base58 for readability
  return bs58.encode(bytes);
}

/**
 * Test encryption compatibility with server
 * @param key Session key to test with
 * @returns Promise resolving to true if test passes
 */
export async function testEncryptionCompat(key: Uint8Array): Promise<boolean> {
  try {
    // Create test message
    const testMessage = {
      type: 'test',
      value: 'test-value',
      timestamp: Date.now()
    };
    
    // Encrypt with our utilities
    const encryptedPacket = await createEncryptedDataPacket(testMessage, key, 0);
    
    // Decrypt with our utilities
    const decryptedMessage = await processEncryptedDataPacket(encryptedPacket, key);
    
    // Verify result
    if (!decryptedMessage || 
        decryptedMessage.type !== testMessage.type || 
        decryptedMessage.value !== testMessage.value) {
      console.error('[Crypto] Encryption test failed: mismatch between original and decrypted data');
      return false;
    }
    
    console.log('[Crypto] Encryption compatibility test passed');
    return true;
  } catch (error) {
    console.error('[Crypto] Encryption compatibility test failed:', error);
    return false;
  }
}

/**
 * Test different encryption formats to find a compatible one
 * @returns Promise resolving to an object with test results
 */
export async function findCompatibleEncryptionFormat(): Promise<any> {
  const testKey = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(testKey);
  }
  
  const results = {
    aesGcmSupported: await isAesGcmSupported(),
    fieldTests: {
      encryption: false,
      encryption_algorithm: false
    },
    recommendedField: 'unknown'
  };
  
  try {
    // Test with 'encryption' field
    const test1 = await testEncryptionFormat({ test: 'test1' }, 'encryption');
    results.fieldTests.encryption = test1.success;
    
    // Test with 'encryption_algorithm' field
    const test2 = await testEncryptionFormat({ test: 'test2' }, 'encryption_algorithm');
    results.fieldTests.encryption_algorithm = test2.success;
    
    // Determine recommended field
    if (results.fieldTests.encryption_algorithm) {
      results.recommendedField = 'encryption_algorithm';
    } else if (results.fieldTests.encryption) {
      results.recommendedField = 'encryption';
    }
  } catch (error) {
    console.error('[Crypto] Error finding compatible encryption format:', error);
  }
  
  return results;
}

/**
 * Test encryption with specific field name
 * @param data Test data to encrypt
 * @param fieldName Field name to use ('encryption' or 'encryption_algorithm')
 * @returns Test result with success status
 */
export async function testEncryptionFormat(
  data: any,
  fieldName: 'encryption' | 'encryption_algorithm'
): Promise<{success: boolean, error?: string}> {
  try {
    // Generate test key
    const testKey = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(testKey);
    }
    
    // Create encrypted data packet
    const nonce = generateNonce();
    const messageString = JSON.stringify(data);
    const { ciphertext } = await encryptWithAesGcm(messageString, testKey, nonce);
    
    // Create test packet with specified field name
    const packet: EncryptionPacket = {
      type: 'Data',
      encrypted: Array.from(ciphertext),
      nonce: Array.from(nonce),
      counter: 0
    };
    
    // Add field with correct name
    packet[fieldName] = 'aes256gcm';
    
    // Try to decrypt
    const decrypted = await processEncryptedDataPacket(packet, testKey);
    
    return {
      success: decrypted !== null && JSON.stringify(decrypted) === JSON.stringify(data)
    };
  } catch (error) {
    console.error(`[Crypto] Test failed for field '${fieldName}':`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Securely wipe sensitive data from memory
 * @param data Uint8Array to wipe
 */
export function secureWipe(data: Uint8Array): void {
  if (!data || !(data instanceof Uint8Array)) return;
  
  // First overwrite with random data
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(data);
  } else {
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
  }
  
  // Then zero out
  for (let i = 0; i < data.length; i++) {
    data[i] = 0;
  }
}

/**
 * Verify signature using Ed25519
 * @param message Message that was signed
 * @param signature Signature to verify (Base58 encoded or Uint8Array)
 * @param publicKey Ed25519 public key (Base58 encoded or Uint8Array)
 * @returns True if signature is valid
 */
export function verifySignature(
  message: Uint8Array | string,
  signature: string | Uint8Array,
  publicKey: string | Uint8Array
): boolean {
  try {
    // Convert message to Uint8Array if it's a string
    const messageBytes = typeof message === 'string' 
      ? new TextEncoder().encode(message) 
      : message;
    
    // Convert signature to Uint8Array if it's Base58 encoded
    const signatureBytes = typeof signature === 'string' 
      ? bs58.decode(signature) 
      : signature;
    
    // Convert public key to Uint8Array if it's Base58 encoded
    const publicKeyBytes = typeof publicKey === 'string' 
      ? bs58.decode(publicKey) 
      : publicKey;
    
    // Verify the signature
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    console.error('[Crypto] Signature verification failed:', error);
    return false;
  }
}

/**
 * Calculate SHA-256 hash of data
 * @param data Data to hash (string or Uint8Array)
 * @returns Promise resolving to hash as Uint8Array
 */
export async function sha256(data: string | Uint8Array): Promise<Uint8Array> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available for SHA-256');
  }
  
  try {
    // Convert string to Uint8Array if necessary
    const dataBytes = typeof data === 'string' 
      ? new TextEncoder().encode(data) 
      : data;
    
    // Calculate hash
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBytes);
    return new Uint8Array(hashBuffer);
  } catch (error) {
    console.error('[Crypto] SHA-256 hash calculation failed:', error);
    throw new Error(`SHA-256 failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate a random string for various purposes
 * @param length Length of the random string
 * @param charset Character set to use (default: alphanumeric)
 * @returns Random string of specified length
 */
export function generateRandomString(
  length: number = 16,
  charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
): string {
  const randomValues = new Uint8Array(length);
  
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(randomValues);
  } else {
    for (let i = 0; i < length; i++) {
      randomValues[i] = Math.floor(Math.random() * 256);
    }
  }
  
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(randomValues[i] % charset.length);
  }
  
  return result;
}
