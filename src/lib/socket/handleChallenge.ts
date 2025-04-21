import * as bs58 from 'bs58';
import * as nacl from 'tweetnacl';
import { ChallengeMessage } from './types';

/**
 * Parses challenge data from various formats
 * @param challengeData Challenge data in array or string format
 * @returns Parsed challenge as Uint8Array
 */
export function parseChallengeData(challengeData: number[] | string): Uint8Array {
  let parsed: Uint8Array;
  
  // Handle array format (from server)
  if (Array.isArray(challengeData)) {
    parsed = new Uint8Array(challengeData);
    console.log('[Socket] Challenge data is array, length:', parsed.length);
  } 
  // Handle string format (may be base58 or base64)
  else if (typeof challengeData === 'string') {
    try {
      // Try to parse as base58
      parsed = bs58.decode(challengeData);
      console.log('[Socket] Challenge data decoded as base58, length:', parsed.length);
    } catch (e) {
      // Fallback to base64
      try {
        const buffer = Buffer.from(challengeData, 'base64');
        parsed = new Uint8Array(buffer);
        console.log('[Socket] Challenge data decoded as base64, length:', parsed.length);
      } catch (e2) {
        // Last resort: try to use the string directly as UTF-8
        const encoder = new TextEncoder();
        parsed = encoder.encode(challengeData);
        console.log('[Socket] Challenge data encoded as UTF-8, length:', parsed.length);
      }
    }
  } else {
    throw new Error('Invalid challenge data format');
  }
  
  return parsed;
}

/**
 * Creates a challenge response using Ed25519 signature
 * @param challenge Challenge message from server
 * @param publicKey Client's public key
 * @returns Complete challenge response with signature
 */
export async function createChallengeResponse(
  message: ChallengeMessage,
  publicKey: string
): Promise<{ type: string; signature: string; public_key: string; challenge_id: string; }> {
  try {
    console.log('[Socket] Creating challenge response for ID:', message.id);
    
    // Parse challenge data
    const challengeData = parseChallengeData(message.data);
    console.log('[Socket] Challenge data parsed, length:', challengeData.length);
    
    // Get keypair from localStorage
    const storedKeypair = localStorage.getItem('aero-keypair');
    if (!storedKeypair) {
      throw new Error('No keypair found for authentication');
    }
    
    const keypair = JSON.parse(storedKeypair);
    console.log('[Socket] Using keypair with public key:', keypair.publicKey.substring(0, 10) + '...');
    
    // Decode the secret key
    const secretKey = bs58.decode(keypair.secretKey);
    
    // Verify the keypair is valid
    if (secretKey.length !== 64) {
      throw new Error(`Invalid Ed25519 secret key length: ${secretKey.length} (expected 64 bytes)`);
    }
    
    // Log public key for verification
    const derivedPublicKey = nacl.sign.keyPair.fromSecretKey(secretKey).publicKey;
    const derivedPublicKeyB58 = bs58.encode(derivedPublicKey);
    console.log('[Socket] Derived public key:', derivedPublicKeyB58.substring(0, 10) + '...');
    
    // Verify that we're using the correct keypair
    if (derivedPublicKeyB58 !== keypair.publicKey) {
      console.warn('[Socket] Warning: Derived public key does not match stored public key');
    }
    
    // Sign the challenge
    const signature = nacl.sign.detached(challengeData, secretKey);
    const signatureB58 = bs58.encode(signature);
    
    console.log('[Socket] Signature generated, length:', signature.length, 'base58 length:', signatureB58.length);
    
    // Create and return response
    return {
      type: 'ChallengeResponse',
      signature: signatureB58,
      public_key: publicKey, 
      challenge_id: message.id,
    };
  } catch (error) {
    console.error('[Socket] Error creating challenge response:', error);
    throw error;
  }
}
