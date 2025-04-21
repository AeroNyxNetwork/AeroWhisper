import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import * as bs58 from 'bs58';
import { v4 as uuid } from 'uuid';

/**
 * Wrapper class for using WebCryptoAPI when available,
 * falling back to TweetNaCl when necessary
 */
class CryptoHelper {
  private static instance: CryptoHelper;
  private webCryptoSupported: boolean;
  
  /**
   * Private constructor - use getInstance() to get singleton
   */
  private constructor() {
    // Check if Web Crypto API is available and supports required algorithms
    this.webCryptoSupported = this.isWebCryptoSupported();
    
    if (this.webCryptoSupported) {
      console.log('Using Web Crypto API for cryptographic operations');
    } else {
      console.log('Web Crypto API not fully supported, using TweetNaCl');
    }
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): CryptoHelper {
    if (!CryptoHelper.instance) {
      CryptoHelper.instance = new CryptoHelper();
    }
    return CryptoHelper.instance;
  }
  
  /**
   * Check if Web Crypto API is supported with required algorithms
   */
  private isWebCryptoSupported(): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      return typeof window.crypto !== 'undefined' && 
             typeof window.crypto.subtle !== 'undefined' &&
             typeof window.crypto.subtle.encrypt === 'function' &&
             typeof window.crypto.subtle.decrypt === 'function' &&
             typeof window.crypto.subtle.generateKey === 'function' &&
             typeof window.crypto.subtle.deriveKey === 'function';
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Generate random bytes
   * @param length - Number of bytes to generate
   */
  public getRandomBytes(length: number): Uint8Array {
    if (this.webCryptoSupported) {
      const bytes = new Uint8Array(length);
      window.crypto.getRandomValues(bytes);
      return bytes;
    } else {
      return nacl.randomBytes(length);
    }
  }
  
  /**
   * Derive a key from a password
   * @param password - Password to derive key from
   * @param salt - Salt for key derivation
   */
  public async deriveKeyFromPassword(
    password: string, 
    salt: Uint8Array
  ): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    
    if (this.webCryptoSupported) {
      try {
        // Convert password to bytes
        const passwordBytes = encoder.encode(password);
        
        // Import the password as a key
        const passwordKey = await window.crypto.subtle.importKey(
          'raw',
          passwordBytes,
          { name: 'PBKDF2' },
          false,
          ['deriveKey']
        );
        
        // Derive a key using PBKDF2
        const derivedKey = await window.crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
          },
          passwordKey,
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        
        // Export the key as raw bytes
        const keyBuffer = await window.crypto.subtle.exportKey('raw', derivedKey);
        return new Uint8Array(keyBuffer);
      } catch (e) {
        console.error('Web Crypto API key derivation failed, falling back to TweetNaCl:', e);
        // Fallback to TweetNaCl
        const hashKey = nacl.hash(new Uint8Array([...encoder.encode(password), ...salt]));
        return hashKey.slice(0, nacl.secretbox.keyLength);
      }
    } else {
      // Use TweetNaCl
      const hashKey = nacl.hash(new Uint8Array([...encoder.encode(password), ...salt]));
      return hashKey.slice(0, nacl.secretbox.keyLength);
    }
  }
}

// Get singleton instance
const cryptoHelper = CryptoHelper.getInstance();

/**
 * Generate a unique session ID for a chat
 */
export const generateSessionId = (): string => {
  return uuid();
};

/**
 * Generate Solana-compatible keypair
 */
export const generateKeyPair = () => {
  const keypair = nacl.sign.keyPair();
  return {
    publicKey: bs58.encode(keypair.publicKey),
    secretKey: bs58.encode(keypair.secretKey)
  };
};

/**
 * Convert Ed25519 keypair to X25519 for ECDH
 */
export const convertEd25519ToX25519KeyPair = (keypair: nacl.SignKeyPair): nacl.BoxKeyPair => {
  const x25519PublicKey = nacl.scalarMult.base(nacl.sign.keyPair.fromSecretKey(keypair.secretKey).secretKey.slice(0, 32));
  return {
    publicKey: x25519PublicKey,
    secretKey: keypair.secretKey.slice(0, 32)
  };
};

/**
 * Properly convert Ed25519 public key to X25519
 */
export const convertEd25519PublicKeyToX25519 = (publicKey: Uint8Array): Uint8Array => {
  // Use nacl.sign.keyPair.fromSeed to create a keypair from the first 32 bytes of publicKey
  // This is a common approach but not cryptographically accurate for all cases
  // In a production environment, use a dedicated library for this conversion
  const seed = publicKey.slice(0, 32);
  const keypair = nacl.sign.keyPair.fromSeed(seed);
  const x25519PublicKey = nacl.scalarMult.base(keypair.secretKey.slice(0, 32));
  return x25519PublicKey;
};

/**
 * Derive shared secret from local secret key and remote public key
 */
export const deriveSharedSecret = async (
  localSecretKey: Uint8Array,
  remotePublicKey: Uint8Array
): Promise<Uint8Array> => {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      return await deriveSharedSecretWebCrypto(localSecretKey, remotePublicKey);
    }
  } catch (e) {
    console.error('Web Crypto API shared secret derivation failed, falling back to TweetNaCl:', e);
  }
  
  // Fallback to TweetNaCl implementation
  return deriveSharedSecretTweetNaCl(localSecretKey, remotePublicKey);
};

/**
 * Derive shared secret using Web Crypto API (ECDH)
 */
async function deriveSharedSecretWebCrypto(
  localSecretKey: Uint8Array,
  remotePublicKey: Uint8Array
): Promise<Uint8Array> {
  try {
    // Import local private key
    const localPrivateKey = await window.crypto.subtle.importKey(
      'raw',
      localSecretKey.slice(0, 32), // Use first 32 bytes for X25519
      {
        name: 'ECDH',
        namedCurve: 'P-256', // Using P-256 as X25519 might not be widely supported
      },
      false,
      ['deriveKey', 'deriveBits']
    );
    
    // Import remote public key
    const remotePublicKeyImported = await window.crypto.subtle.importKey(
      'raw',
      remotePublicKey.length === 32 ? remotePublicKey : remotePublicKey.slice(0, 32),
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      false,
      []
    );
    
    // Derive shared bits
    const sharedBits = await window.crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: remotePublicKeyImported,
      },
      localPrivateKey,
      256 // 32 bytes
    );
    
    // Hash the shared bits to create a symmetric key
    const sharedBitsHash = await window.crypto.subtle.digest(
      'SHA-256',
      sharedBits
    );
    
    return new Uint8Array(sharedBitsHash);
  } catch (e) {
    throw new Error(`Web Crypto API ECDH failed: ${e.message}`);
  }
}

/**
 * Derive shared secret using TweetNaCl
 */
function deriveSharedSecretTweetNaCl(
  localSecretKey: Uint8Array,
  remotePublicKey: Uint8Array
): Uint8Array {
  // Convert secret key to X25519 format if needed
  const localX25519SecretKey = localSecretKey.length === 64 
    ? localSecretKey.slice(0, 32) // If Ed25519 secret key (64 bytes), use first 32 bytes
    : localSecretKey; // Already X25519 format (32 bytes)
  
  // Convert remote public key to X25519 format if needed
  const remoteX25519PublicKey = remotePublicKey.length === 32 
    ? remotePublicKey // Already X25519 format
    : convertEd25519PublicKeyToX25519(remotePublicKey);
  
  // Perform X25519 Diffie-Hellman
  const sharedSecret = nacl.scalarMult(localX25519SecretKey, remoteX25519PublicKey);
  
  // Hash the shared secret to derive a symmetric key
  return nacl.hash(sharedSecret).slice(0, nacl.secretbox.keyLength);
}

/**
 * Encrypt message with shared secret using the most secure available method
 */
export const encryptMessage = async (
  message: string,
  sharedSecret: Uint8Array
): Promise<{ ciphertext: string, nonce: string }> => {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      return await encryptMessageWebCrypto(message, sharedSecret);
    }
  } catch (e) {
    console.error('Web Crypto API encryption failed, falling back to TweetNaCl:', e);
  }
  
  // Fallback to TweetNaCl implementation
  return encryptMessageTweetNaCl(message, sharedSecret);
};

/**
 * Encrypt message using Web Crypto API (AES-GCM)
 */
async function encryptMessageWebCrypto(
  message: string,
  key: Uint8Array
): Promise<{ ciphertext: string, nonce: string }> {
  try {
    // Generate a random IV/nonce (12 bytes for AES-GCM)
    const iv = new Uint8Array(12);
    window.crypto.getRandomValues(iv);
    
    // Import the key
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Encode the message
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    
    // Encrypt the message
    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128 // 16 bytes authentication tag
      },
      cryptoKey,
      data
    );
    
    // Return base58-encoded ciphertext and nonce
    return {
      ciphertext: bs58.encode(new Uint8Array(ciphertext)),
      nonce: bs58.encode(iv)
    };
  } catch (e) {
    throw new Error(`Web Crypto API encryption failed: ${e.message}`);
  }
}

/**
 * Encrypt message using TweetNaCl
 */
function encryptMessageTweetNaCl(
  message: string,
  sharedSecret: Uint8Array
): { ciphertext: string, nonce: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageUint8 = new TextEncoder().encode(message);
  
  const encrypted = nacl.secretbox(messageUint8, nonce, sharedSecret);
  
  return {
    ciphertext: bs58.encode(encrypted),
    nonce: bs58.encode(nonce)
  };
}

/**
 * Decrypt message with shared secret, trying Web Crypto API first
 */
export const decryptMessage = async (
  ciphertext: string,
  nonce: string,
  sharedSecret: Uint8Array
): Promise<string> => {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      return await decryptMessageWebCrypto(ciphertext, nonce, sharedSecret);
    }
  } catch (e) {
    console.error('Web Crypto API decryption failed, falling back to TweetNaCl:', e);
  }
  
  // Fallback to TweetNaCl implementation
  return decryptMessageTweetNaCl(ciphertext, nonce, sharedSecret);
};

/**
 * Decrypt message using Web Crypto API (AES-GCM)
 */
async function decryptMessageWebCrypto(
  ciphertext: string,
  nonce: string,
  key: Uint8Array
): Promise<string> {
  try {
    // Decode base58 ciphertext and nonce
    const ciphertextData = bs58.decode(ciphertext);
    const ivData = bs58.decode(nonce);
    
    // Import the key
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    // Decrypt the message
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivData,
        tagLength: 128 // 16 bytes authentication tag
      },
      cryptoKey,
      ciphertextData
    );
    
    // Decode the decrypted data
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (e) {
    throw new Error(`Web Crypto API decryption failed: ${e.message}`);
  }
}

/**
 * Decrypt message using TweetNaCl
 */
function decryptMessageTweetNaCl(
  ciphertext: string,
  nonce: string,
  sharedSecret: Uint8Array
): string {
  const encryptedData = bs58.decode(ciphertext);
  const nonceData = bs58.decode(nonce);
  
  const decrypted = nacl.secretbox.open(encryptedData, nonceData, sharedSecret);
  
  if (!decrypted) {
    throw new Error('Failed to decrypt message');
  }
  
  return new TextDecoder().decode(decrypted);
}

/**
 * Create a signature for challenge-response authentication
 */
export const signChallenge = (
  challenge: Uint8Array,
  secretKey: Uint8Array
): string => {
  try {
    // Detailed logs for debugging
    console.log('Challenge data length:', challenge.length);
    console.log('Challenge first bytes:', Array.from(challenge.slice(0, 8)));
    console.log('Secret key length:', secretKey.length);
    
    // Ensure secret key is correct length
    if (secretKey.length !== 64) {
      // Try to handle various key formats
      if (secretKey.length === 32) {
        console.warn('Secret key is only 32 bytes, expected 64 bytes. Converting to compatible format.');
        // This is just the private portion, reconstruct a full keypair
        const keypair = nacl.sign.keyPair.fromSecretKey(secretKey);
        secretKey = keypair.secretKey;
      } else {
        throw new Error(`Invalid secret key length: ${secretKey.length}, expected 64 bytes`);
      }
    }
    
    // In Solana, signatures are created with detached signing
    // This creates a 64-byte signature without prepending the message
    const signature = nacl.sign.detached(challenge, secretKey);
    
    // Server expects Base58 encoded signature
    const base58Signature = bs58.encode(signature);
    
    console.log('Generated signature first bytes:', Array.from(signature.slice(0, 8)));
    console.log('Base58 signature:', base58Signature.substring(0, 10) + '...');
    
    return base58Signature;
  } catch (error) {
    console.error('Error in signChallenge:', error);
    throw error;
  }
};

/**
 * Verify a signature against the original challenge
 */
export const verifySignature = (
  challenge: Uint8Array,
  signature: string,
  publicKey: string
): boolean => {
  const signatureUint8 = bs58.decode(signature);
  const publicKeyUint8 = new PublicKey(publicKey).toBytes();
  
  return nacl.sign.detached.verify(challenge, signatureUint8, publicKeyUint8);
};

/**
 * Generate a random encryption key for a session
 */
export const generateSessionKey = (): Uint8Array => {
  return cryptoHelper.getRandomBytes(nacl.secretbox.keyLength);
};

/**
 * Encrypt a session key for secure transmission
 */
export const encryptSessionKey = async (
  sessionKey: Uint8Array,
  sharedSecret: Uint8Array
): Promise<{ encryptedKey: string, keyNonce: string }> => {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // Generate a random IV/nonce (12 bytes for AES-GCM)
      const iv = new Uint8Array(12);
      window.crypto.getRandomValues(iv);
      
      // Import the key
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        sharedSecret,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );
      
      // Encrypt the session key
      const ciphertext = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128 // 16 bytes authentication tag
        },
        cryptoKey,
        sessionKey
      );
      
      // Return base58-encoded ciphertext and nonce
      return {
        encryptedKey: bs58.encode(new Uint8Array(ciphertext)),
        keyNonce: bs58.encode(iv)
      };
    }
  } catch (e) {
    console.error('Web Crypto API session key encryption failed, falling back to TweetNaCl:', e);
  }
  
  // Fallback to TweetNaCl
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const encrypted = nacl.secretbox(sessionKey, nonce, sharedSecret);
  
  return {
    encryptedKey: bs58.encode(encrypted),
    keyNonce: bs58.encode(nonce)
  };
};

/**
 * Decrypt a session key after receiving it
 */
export const decryptSessionKey = async (
  encryptedKey: string,
  keyNonce: string,
  sharedSecret: Uint8Array
): Promise<Uint8Array> => {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // Decode base58 encryptedKey and nonce
      const encryptedKeyData = bs58.decode(encryptedKey);
      const ivData = bs58.decode(keyNonce);
      
      // Import the key
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        sharedSecret,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      
      // Decrypt the session key
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivData,
          tagLength: 128 // 16 bytes authentication tag
        },
        cryptoKey,
        encryptedKeyData
      );
      
      return new Uint8Array(decrypted);
    }
  } catch (e) {
    console.error('Web Crypto API session key decryption failed, falling back to TweetNaCl:', e);
  }
  
  // Fallback to TweetNaCl
  const encryptedKeyUint8 = bs58.decode(encryptedKey);
  const keyNonceUint8 = bs58.decode(keyNonce);
  
  const sessionKey = nacl.secretbox.open(encryptedKeyUint8, keyNonceUint8, sharedSecret);
  
  if (!sessionKey) {
    throw new Error('Failed to decrypt session key');
  }
  
  return sessionKey;
};

/**
 * Simple encrypt packet for transmission
 */
export const encryptPacket = async (
  data: any,
  sessionKey: Uint8Array
): Promise<{ encrypted: string, nonce: string }> => {
  // Convert the data to JSON string
  const jsonData = JSON.stringify(data);
  
  // Convert to Uint8Array for encryption
  const encoder = new TextEncoder();
  const messageUint8 = encoder.encode(jsonData);
  
  // Generate random nonce
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  
  // Encrypt with nacl.secretbox (XSalsa20-Poly1305)
  const encrypted = nacl.secretbox(messageUint8, nonce, sessionKey);
  
  // Return base58 encoded values
  return {
    encrypted: bs58.encode(encrypted),
    nonce: bs58.encode(nonce)
  };
};


/**
 * Decrypt packet after receiving
 */
export const decryptPacket = async (
  encrypted: string,
  nonce: string,
  sessionKey: Uint8Array
): Promise<any> => {
  // Decode base58 strings
  const encryptedUint8 = bs58.decode(encrypted);
  const nonceUint8 = bs58.decode(nonce);
  
  // Decrypt the data
  const decrypted = nacl.secretbox.open(encryptedUint8, nonceUint8, sessionKey);
  
  if (!decrypted) {
    throw new Error('Failed to decrypt packet');
  }
  
  // Convert binary data to text and parse JSON
  const decoder = new TextDecoder();
  const jsonData = decoder.decode(decrypted);
  return JSON.parse(jsonData);
};

/**
 * Hash a string using SHA-256
 */
export const hashString = async (input: string): Promise<string> => {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.error('Web Crypto API hashing failed, falling back to TweetNaCl:', e);
  }
  
  // Fallback to TweetNaCl
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = nacl.hash(data);
  
  return Array.from(hash)
    .slice(0, 32) // Take only first 32 bytes for SHA-256 equivalent
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Generate a secure random password
 * @param length Length of the password
 */
export const generateRandomPassword = (length: number = 16): string => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+';
  const randomBytes = cryptoHelper.getRandomBytes(length);
  let password = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = randomBytes[i] % charset.length;
    password += charset[randomIndex];
  }
  
  return password;
};
