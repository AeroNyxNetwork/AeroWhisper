import * as bs58 from 'bs58';
import * as nacl from 'tweetnacl';
import { IpAssignMessage } from './types';

/**
 * Process IP assignment message to extract and decrypt the session key
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
        
        // Try Web Crypto API first if available, but use AES-GCM instead of ChaCha20-Poly1305
        let decryptedSessionKey: Uint8Array | null = null;
        
        try {
          if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle && keyNonce.length === 12) {
            // Import shared secret as CryptoKey for AES-GCM (widely supported)
            const cryptoKey = await window.crypto.subtle.importKey(
              'raw',
              sharedSecret,
              { name: 'AES-GCM' },
              false,
              ['decrypt']
            );
            
            // Decrypt session key
            const decryptedBuffer = await window.crypto.subtle.decrypt(
              {
                name: 'AES-GCM',
                iv: keyNonce,
                tagLength: 128
              },
              cryptoKey,
              encryptedSessionKey
            );
            
            decryptedSessionKey = new Uint8Array(decryptedBuffer);
            console.log('[Socket] Successfully decrypted session key with Web Crypto API using AES-GCM');
          } else {
            throw new Error('Web Crypto API not available or nonce size incompatible');
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
          
          console.log('[Socket] Successfully decrypted session key with TweetNaCl');
        }
        
        return decryptedSessionKey;
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
}
