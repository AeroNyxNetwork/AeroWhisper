/**
 * Utility functions for cryptographic operations using the Web Crypto API
 * Focused on AES-GCM for broad browser compatibility
 */

/**
 * Generates a random key for AES-GCM encryption
 * @returns A Promise resolving to a 32-byte (256-bit) AES key as Uint8Array
 */
export async function generateAesGcmKey(): Promise<Uint8Array> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  
  try {
    // Generate a random AES-GCM key
    const key = await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );
    
    // Export the key to raw format
    const keyBuffer = await window.crypto.subtle.exportKey('raw', key);
    return new Uint8Array(keyBuffer);
  } catch (error) {
    console.error('Error generating AES-GCM key:', error);
    throw new Error(`Failed to generate encryption key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generates a random nonce/IV for AES-GCM
 * @returns A 12-byte (96-bit) nonce as Uint8Array
 */
export function generateNonce(): Uint8Array {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.getRandomValues) {
    throw new Error('Secure random number generation not available');
  }
  
  const nonce = new Uint8Array(12); // 12 bytes (96 bits) is optimal for AES-GCM
  window.crypto.getRandomValues(nonce);
  return nonce;
}

/**
 * Encrypts data using AES-GCM
 * @param data Data to encrypt (string or Uint8Array)
 * @param key AES-GCM key (32 bytes)
 * @returns Promise resolving to object containing encrypted data and nonce
 */
export async function encryptWithAesGcm(
  data: string | Uint8Array,
  key: Uint8Array
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  
  if (key.length !== 32) {
    throw new Error(`Invalid key length: ${key.length} (expected 32 bytes)`);
  }
  
  try {
    // Convert data to Uint8Array if it's a string
    const dataBytes = typeof data === 'string' 
      ? new TextEncoder().encode(data)
      : data;
    
    // Generate a random nonce
    const nonce = generateNonce();
    
    // Import the key
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    // Encrypt the data without additional authenticated data
    const encryptParams: AesGcmParams = {
      name: 'AES-GCM',
      iv: nonce,
      tagLength: 128 // 16 bytes authentication tag
    };
    
    // Encrypt the data
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      encryptParams,
      cryptoKey,
      dataBytes
    );
    
    // Log encryption details for debugging
    console.debug('[Crypto] AES-GCM encryption succeeded:', {
      plaintextLength: dataBytes.length,
      ciphertextLength: encryptedBuffer.byteLength,
      nonceLength: nonce.length,
      keyLength: key.length
    });
    
    return {
      ciphertext: new Uint8Array(encryptedBuffer),
      nonce
    };
  } catch (error) {
    console.error('Error encrypting with AES-GCM:', error);
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decrypts data using AES-GCM
 * @param ciphertext Encrypted data
 * @param nonce Nonce used for encryption (12 bytes)
 * @param key AES-GCM key (32 bytes)
 * @param outputType Whether to return result as 'string' or 'binary'
 * @returns Promise resolving to decrypted data
 */
export async function decryptWithAesGcm(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array,
  outputType: 'string' | 'binary' = 'binary'
): Promise<Uint8Array | string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  
  if (key.length !== 32) {
    throw new Error(`Invalid key length: ${key.length} (expected 32 bytes)`);
  }
  
  if (nonce.length !== 12) {
    throw new Error(`Invalid nonce length: ${nonce.length} (expected 12 bytes)`);
  }
  
  try {
    // Log decryption attempt details for debugging
    console.debug('[Crypto] Attempting AES-GCM decryption:', {
      ciphertextLength: ciphertext.length,
      nonceLength: nonce.length,
      keyLength: key.length,
      noncePrefix: Array.from(nonce.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('')
    });
    
    // Import the key
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    // Decrypt without additional authenticated data
    const decryptParams: AesGcmParams = {
      name: 'AES-GCM',
      iv: nonce,
      tagLength: 128 // 16 bytes authentication tag
    };
    
    // Decrypt the data
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      decryptParams,
      cryptoKey,
      ciphertext
    );
    
    const decryptedBytes = new Uint8Array(decryptedBuffer);
    
    // Log successful decryption
    console.debug('[Crypto] AES-GCM decryption succeeded:', {
      ciphertextLength: ciphertext.length,
      decryptedLength: decryptedBuffer.byteLength
    });
    
    // Return as string or binary based on outputType
    return outputType === 'string'
      ? new TextDecoder().decode(decryptedBytes)
      : decryptedBytes;
  } catch (error) {
    // AES-GCM will throw if authentication fails (tampered data)
    console.error('Error decrypting with AES-GCM:', error);
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Derives an encryption key using HKDF
 * @param inputKey Base key material
 * @param salt Salt for key derivation
 * @param info Optional context information
 * @param length Desired key length in bytes (default: 32)
 * @returns Promise resolving to derived key
 */
export async function deriveKeyHkdf(
  inputKey: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array = new Uint8Array([]),
  length: number = 32
): Promise<Uint8Array> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  
  try {
    // Import the input key material
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      inputKey,
      { name: 'HKDF' },
      false,
      ['deriveBits']
    );
    
    // Derive bits using HKDF
    const derivedBits = await window.crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info
      },
      baseKey,
      length * 8 // Convert bytes to bits
    );
    
    return new Uint8Array(derivedBits);
  } catch (error) {
    console.error('Error deriving key with HKDF:', error);
    throw new Error(`Key derivation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Prepares encrypted data for transmission in the format expected by the server
 * @param encrypted Encrypted data
 * @param nonce Nonce used for encryption
 * @param counter Message counter for replay protection
 * @param algorithm Encryption algorithm used (default: 'aes-gcm')
 * @param padding Optional padding for traffic analysis protection
 * @returns JSON-safe object for transmission
 */
export function prepareEncryptedPacket(
  encrypted: Uint8Array, 
  nonce: Uint8Array, 
  counter: number,
  algorithm: string = 'aes-gcm',
  padding?: Uint8Array
): any {
  return {
    type: 'Data',
    encrypted: Array.from(encrypted),
    nonce: Array.from(nonce),
    counter,
    encryption: algorithm, // Use 'encryption' field to match server expectations
    padding: padding ? Array.from(padding) : null
  };
}

/**
 * Creates random padding bytes for traffic analysis protection
 * @param minBytes Minimum padding bytes
 * @param maxBytes Maximum padding bytes
 * @returns Random padding as Uint8Array
 */
export function generateRandomPadding(minBytes: number, maxBytes: number): Uint8Array {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.getRandomValues) {
    throw new Error('Secure random number generation not available');
  }
  
  // Generate a random padding length between min and max
  const range = maxBytes - minBytes;
  const randomLength = minBytes + Math.floor(Math.random() * (range + 1));
  
  // Create and fill the padding array
  const padding = new Uint8Array(randomLength);
  window.crypto.getRandomValues(padding);
  
  return padding;
}

/**
 * Checks if the Web Crypto API is available and supports AES-GCM
 * @returns True if AES-GCM is supported
 */
export function isAesGcmSupported(): boolean {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    return false;
  }
  
  // Test if AES-GCM is supported
  try {
    const testKey = window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );
    
    return !!testKey;
  } catch (error) {
    return false;
  }
}
