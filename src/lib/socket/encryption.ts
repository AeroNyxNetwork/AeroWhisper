import * as bs58 from 'bs58';
import * as nacl from 'tweetnacl';
// Import the required cryptoUtils functions
import { encryptWithAesGcm, decryptWithAesGcm, generateNonce } from '../../utils/cryptoUtils';

/**
 * Encrypt data using AES-GCM via Web Crypto API
 * @param data Data to encrypt
 * @param key 32-byte encryption key
 * @returns Encrypted data and nonce
 */
export async function encryptData(
    data: any, 
    sessionKey: Uint8Array
): Promise<{encrypted: Uint8Array, nonce: Uint8Array}> {
    if (!sessionKey || sessionKey.length !== 32) {
        throw new Error(`Invalid session key: length=${sessionKey ? sessionKey.length : 'null'} (expected 32 bytes)`);
    }
    
    // Convert data to JSON string
    const jsonData = JSON.stringify(data);
    
    // Convert string to Uint8Array for encryption
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(jsonData);
    
    // Generate a 12-byte nonce as required by AES-GCM
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
        // Use Web Crypto API with AES-GCM
        if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
            // Import key for AES-GCM
            const cryptoKey = await window.crypto.subtle.importKey(
                'raw', 
                sessionKey, 
                { name: 'AES-GCM' },
                false, 
                ['encrypt']
            );
            
            // Encrypt the data
            const encryptedBuffer = await window.crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: nonce,
                    tagLength: 128 // 16 bytes tag, standard for AES-GCM
                },
                cryptoKey,
                plaintext
            );
            
            const encrypted = new Uint8Array(encryptedBuffer);
            
            console.log('[Socket] Successfully encrypted data with AES-GCM via Web Crypto API', {
                plaintextLength: plaintext.length,
                ciphertextLength: encrypted.length,
                nonceLength: nonce.length
            });
            
            return { encrypted, nonce };
        } else {
            throw new Error('Web Crypto API not available');
        }
    } catch (error) {
        console.error('[Socket] Encryption error:', error);
        throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}



/**
 * Create a proper data packet for encrypted messaging
 * Using the consistent field names expected by the server
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
  
  // Create properly formatted packet with consistent field naming
  return {
    type: 'Data',
    encrypted: Array.from(ciphertext),
    nonce: Array.from(nonce),
    counter: counter,
    encryption_algorithm: 'aes-gcm', // Use this field name consistently
    padding: null // Optional padding for length concealment
  };
}

/**
 * Decrypt data using AES-GCM via Web Crypto API
 * @param encrypted Encrypted data
 * @param nonce Nonce used for encryption
 * @param sessionKey Session key
 * @returns Decrypted data
 */
export async function decryptData(
    encrypted: Uint8Array, 
    nonce: Uint8Array, 
    sessionKey: Uint8Array
): Promise<any> {
    if (!sessionKey || sessionKey.length !== 32) {
        throw new Error(`Invalid session key: length=${sessionKey ? sessionKey.length : 'null'} (expected 32 bytes)`);
    }
    
    // Validate nonce size
    if (nonce.length !== 12) {
        throw new Error(`Invalid nonce length: ${nonce.length} (expected 12 bytes)`);
    }
    
    try {
        // Use Web Crypto API with AES-GCM
        if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
            // Import key for AES-GCM
            const cryptoKey = await window.crypto.subtle.importKey(
                'raw',
                sessionKey,
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );
            
            // Decrypt the data
            const decryptedBuffer = await window.crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: nonce,
                    tagLength: 128 // 16 bytes tag, standard for AES-GCM
                },
                cryptoKey,
                encrypted
            );
            
            // Convert binary data to string
            const decoder = new TextDecoder();
            const jsonString = decoder.decode(new Uint8Array(decryptedBuffer));
            
            console.log('[Socket] Successfully decrypted data with AES-GCM via Web Crypto API', {
                ciphertextLength: encrypted.length,
                plaintextLength: decryptedBuffer.byteLength
            });
            
            try {
                return JSON.parse(jsonString);
            } catch (jsonError) {
                console.error('[Socket] Error parsing decrypted JSON:', jsonError);
                throw new Error('Invalid JSON in decrypted message');
            }
        } else {
            throw new Error('Web Crypto API not available');
        }
    } catch (error) {
        console.error('[Socket] Decryption error:', error);
        throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Sign a challenge using Ed25519
 * @param challenge Challenge data to sign
 * @param secretKey Ed25519 secret key
 * @returns Signature as a base58 string
 */
export async function signChallenge(challenge: Uint8Array, secretKey: Uint8Array): Promise<string> {
    try {
        // Detailed logging to help debug the challenge and signature process
        console.log('[Socket] Challenge signing details:', {
            challengeLength: challenge.length,
            challengePrefix: Array.from(challenge.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(''),
            secretKeyLength: secretKey.length
        });

        // Ensure we have a valid challenge and secret key
        if (challenge.length === 0) {
            throw new Error('Empty challenge data');
        }

        if (secretKey.length !== 64) {
            throw new Error(`Invalid Ed25519 secret key length: ${secretKey.length} (expected 64 bytes)`);
        }

        // Sign the challenge using Ed25519
        // Make sure we're using the correct format for the secret key that TweetNaCl expects
        const signature = nacl.sign.detached(challenge, secretKey);
        
        // Convert signature to base58 string for transmission
        const signatureBase58 = bs58.encode(signature);

        console.log('[Socket] Generated signature:', {
            signatureLength: signature.length,
            signatureBase58Length: signatureBase58.length,
            signatureBase58Prefix: signatureBase58.substring(0, 10)
        });

        return signatureBase58;
    } catch (error) {
        console.error('[Socket] Error signing challenge:', error);
        
        // More detailed error reporting with available data
        if (challenge) {
            console.debug('[Socket] Challenge data:', {
                type: challenge.constructor.name,
                length: challenge.length,
                sample: challenge.length > 0 ? Array.from(challenge.slice(0, Math.min(10, challenge.length))) : 'empty'
            });
        }
        
        if (secretKey) {
            console.debug('[Socket] Secret key info:', {
                type: secretKey.constructor.name,
                length: secretKey.length
            });
        }
        
        throw error;
    }
}

/**
 * Generate a session key using X25519 ECDH
 * @param serverPublicKey Server's public key
 * @param clientSecretKey Client's secret key
 * @returns Generated shared secret
 */
export async function generateSessionKey(
    serverPublicKey: Uint8Array,
    clientSecretKey: Uint8Array
): Promise<Uint8Array> {
    try {
        // Enhanced logging for ECDH key exchange debugging
        console.log('[Socket] Generating session key with ECDH:', {
            serverPublicKeyLength: serverPublicKey.length,
            clientSecretKeyLength: clientSecretKey.length
        });

        // For Ed25519 secret keys, we need to use the first 32 bytes for X25519
        const secretKeyX25519 = clientSecretKey.slice(0, 32);
        
        // Perform X25519 key exchange to derive shared secret
        const sharedSecret = nacl.scalarMult(secretKeyX25519, serverPublicKey);
        
        console.log('[Socket] Generated shared secret:', {
            sharedSecretLength: sharedSecret.length,
            sharedSecretPrefix: Array.from(sharedSecret.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('')
        });
        
        return sharedSecret;
    } catch (error) {
        console.error('[Socket] Error generating session key:', error);
        
        // More detailed error reporting
        if (serverPublicKey) {
            console.debug('[Socket] Server public key info:', {
                type: serverPublicKey.constructor.name,
                length: serverPublicKey.length,
                sample: serverPublicKey.length > 0 ? 
                    Array.from(serverPublicKey.slice(0, Math.min(4, serverPublicKey.length)))
                        .map(b => b.toString(16).padStart(2, '0')).join('') : 'empty'
            });
        }
        
        if (clientSecretKey) {
            console.debug('[Socket] Client secret key info:', {
                type: clientSecretKey.constructor.name,
                length: clientSecretKey.length
            });
        }
        
        throw error;
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
