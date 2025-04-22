import * as bs58 from 'bs58';
import * as nacl from 'tweetnacl';
import { ChallengeMessage } from './types';
import { parseChallengeData, signChallenge } from '../../utils/cryptoUtils';

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
    
    // Sign the challenge using the imported function from cryptoUtils
    const signatureB58 = signChallenge(challengeData, secretKey);
    
    console.log('[Socket] Signature generated, base58 length:', signatureB58.length);
    
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
