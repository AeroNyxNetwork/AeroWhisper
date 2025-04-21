import * as bs58 from 'bs58';
import * as nacl from 'tweetnacl';
import { 
  ChallengeMessage, 
  IpAssignMessage,
  PingMessage,
  PongMessage,
  ErrorMessage,
  DisconnectMessage,
  SocketError
} from './types';
import { signChallenge, generateSessionKey } from './encryption';
import { createPongMessage } from './networking';

/**
 * Parse WebSocket message from different formats
 * @param data Message data in various formats
 * @returns Parsed message object
 */
export async function parseMessage(data: string | ArrayBuffer | Blob): Promise<any> {
  try {
    let message: any;
    
    if (typeof data === 'string') {
      message = JSON.parse(data);
    } else if (data instanceof Blob) {
      // Handle Blob data (for binary WebSocket messages)
      const reader = new FileReader();
      
      // Convert Blob to text using Promise
      const text = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(data);
      });
      
      message = JSON.parse(text);
    } else {
      // Handle ArrayBuffer
      const decoder = new TextDecoder();
      message = JSON.parse(decoder.decode(data));
    }
    
    return message;
  } catch (error) {
    console.error('[Socket] Error parsing message:', error);
    throw new Error('Failed to parse server message');
  }
}

/**
 * Create challenge response message
 * @param challenge Challenge message from server
 * @param publicKey Client's public key
 * @returns Challenge response object with signature
 */
export async function createChallengeResponse(
  message: ChallengeMessage,
  publicKey: string
): Promise<{ type: string; signature: string; public_key: string; challenge_id: string; }> {
  try {
    // Convert challenge data to Uint8Array
    let challengeData: Uint8Array;
    
    if (Array.isArray(message.data)) {
      challengeData = new Uint8Array(message.data);
    } else if (typeof message.data === 'string') {
      // Try to parse as base58 or base64
      try {
        // Try to parse as base58
        challengeData = bs58.decode(message.data);
      } catch {
        // Fallback to base64
        const buffer = Buffer.from(message.data, 'base64');
        challengeData = new Uint8Array(buffer);
      }
    } else {
      throw new Error('Invalid challenge data format');
    }
    
    // Get keypair from localStorage
    const storedKeypair = localStorage.getItem('aero-keypair');
    if (!storedKeypair) {
      throw new Error('No keypair found for authentication');
    }
    
    const keypair = JSON.parse(storedKeypair);
    
    // Decode the secret key
    const secretKey = bs58.decode(keypair.secretKey);
    
    // Sign challenge with proper signature
    const signature = await signChallenge(challengeData, secretKey);
    
    // Create and return response
    return {
      type: 'ChallengeResponse',
      signature,
      public_key: publicKey,
      challenge_id: message.id,
    };
  } catch (error) {
    console.error('[Socket] Error creating challenge response:', error);
    throw error;
  }
}

/**
 * Process IP assignment message to get session key
 * @param message IP assignment message from server
 * @param serverPublicKey Server's public key
 * @returns Decrypted session key
 */
export async function processIpAssign(
  message: IpAssignMessage, 
  serverPublicKey: string | null
): Promise<Uint8Array> {
  try {
    // Handle session key - crucial for encryption
    if (message.session_key && message.key_nonce && serverPublicKey) {
      // Get keypair from localStorage
      const storedKeypair = localStorage.getItem('aero-keypair');
      if (!storedKeypair) {
        throw new Error('No keypair found for decrypting session key');
      }
      
      const keypair = JSON.parse(storedKeypair);
      const secretKey = bs58.decode(keypair.secretKey);
      const serverPubKeyBytes = bs58.decode(serverPublicKey);
      
      try {
        // For Ed25519 secret keys, we need to use the first 32 bytes for X25519
        const secretKeyX25519 = secretKey.slice(0, 32);
        
        // Compute shared secret using scalar multiplication (ECDH)
        const sharedSecret = nacl.scalarMult(secretKeyX25519, serverPubKeyBytes);
        
        // Decode the encrypted session key and nonce
        const encryptedSessionKey = bs58.decode(message.session_key);
        const keyNonce = bs58.decode(message.key_nonce);
        
        // Try Web Crypto API first if available
        let decryptedSessionKey: Uint8Array | null = null;
        
        try {
          if (keyNonce.length === 12) {
            // Import shared secret as CryptoKey
            const cryptoKey = await window.crypto.subtle.importKey(
              'raw',
              sharedSecret,
              { name: 'ChaCha20-Poly1305' },
              false,
              ['decrypt']
            );
            
            // Decrypt session key
            const decryptedBuffer = await window.crypto.subtle.decrypt(
              {
                name: 'ChaCha20-Poly1305',
                iv: keyNonce
              },
              cryptoKey,
              encryptedSessionKey
            );
            
            decryptedSessionKey = new Uint8Array(decryptedBuffer);
          }
        } catch (webCryptoError) {
          console.warn('[Socket] Failed to decrypt session key with Web Crypto API:', webCryptoError);
          // We'll fall back to TweetNaCl
        }
        
        // If Web Crypto API failed or wasn't available, try TweetNaCl
        if (!decryptedSessionKey) {
          // Create a padded nonce if needed (server sends 12 bytes, TweetNaCl expects 24)
          let keyNonceForDecryption = keyNonce;
          if (keyNonce.length === 12) {
            const paddedKeyNonce = new Uint8Array(24);
            paddedKeyNonce.set(keyNonce);
            keyNonceForDecryption = paddedKeyNonce;
          }
          
          // Decrypt the session key using the shared secret
          decryptedSessionKey = nacl.secretbox.open(
            encryptedSessionKey,
            keyNonceForDecryption,
            sharedSecret
          );
          
          if (!decryptedSessionKey) {
            throw new Error('Failed to decrypt session key - authentication failed');
          }
        }
        
        return decryptedSessionKey;
      } catch (error) {
        console.error('[Socket] Error decrypting session key:', error);
        throw error;
      }
    } else {
      // If session key is missing, generate a random one for development
      console.warn('[Socket] No session key or nonce provided by server, generating random key');
      
      // Try to use WebCrypto for key generation if available
      if (window.crypto && window.crypto.getRandomValues) {
        const randomKey = new Uint8Array(32);
        window.crypto.getRandomValues(randomKey);
        return randomKey;
      } else {
        // Fall back to TweetNaCl
        return nacl.randomBytes(32);
      }
    }
  } catch (error) {
    console.error('[Socket] Error processing IP assign message:', error);
    throw error;
  }
}

/**
 * Create socket error object
 * @param type Error type
 * @param message User-friendly error message
 * @param code Error code
 * @param details Additional error details
 * @param retry Whether retry is possible
 * @param originalError Original error object
 * @returns Structured socket error object
 */
export function createSocketError(
  type: SocketError['type'],
  message: string,
  code: string,
  details?: string,
  retry: boolean = true,
  originalError?: any
): SocketError {
  return {
    type,
    message,
    code,
    details,
    retry,
    originalError
  };
}

/**
 * Handles a ping message
 * @param message Ping message
 * @returns Pong response
 */
export function handlePingMessage(message: PingMessage): PongMessage {
  return createPongMessage(message.timestamp, message.sequence);
}

/**
 * Calculate connection latency from pong message
 * @param message Pong message
 * @returns Latency in milliseconds
 */
export function getPongLatency(message: PongMessage): number {
  return Date.now() - message.echo_timestamp;
}

/**
 * Process server error message
 * @param message Error message from server
 * @returns Socket error object
 */
export function processErrorMessage(message: ErrorMessage): SocketError {
  return {
    type: 'server',
    message: message.message,
    code: message.code ? `SERVER_${message.code}` : 'SERVER_ERROR',
    retry: message.code ? message.code < 5000 : true // Retry for non-fatal errors
  };
}

/**
 * Process disconnect message
 * @param message Disconnect message from server
 * @returns Boolean indicating if reconnection should be attempted
 */
export function shouldReconnectAfterDisconnect(message: DisconnectMessage): boolean {
  // If reason is non-fatal (< 4000), attempt to reconnect
  return message.reason < 4000;
}
