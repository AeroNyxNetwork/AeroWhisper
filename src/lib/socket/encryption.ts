// encryption.ts - Modified to use @noble/ciphers for ChaCha20-Poly1305

import * as nacl from 'tweetnacl'; // Keep for signing and potentially ECDH base
import * as bs58 from 'bs58'; // For Base58 encoding/decoding
import { chacha20poly1305 } from '@noble/ciphers/chacha'; // Import compatible ChaCha20
import { randomBytes } from '@noble/ciphers/utils'; // For secure random nonce generation

// --- Removed Node.js crypto helper functions ---
// function chacha20poly1305Encrypt(...) - REMOVED
// function chacha20poly1305Decrypt(...) - REMOVED

/**
 * Encrypt data using the session key with IETF ChaCha20-Poly1305 (RFC 8439)
 * @param data Data to encrypt (can be any JSON-serializable object)
 * @param sessionKey 32-byte session key for encryption
 * @returns Promise resolving to { encrypted: Uint8Array (ciphertext+tag), nonce: Uint8Array (12 bytes) }
 */
export async function encryptData(
    data: any,
    sessionKey: Uint8Array
): Promise<{ encrypted: Uint8Array, nonce: Uint8Array }> {
    if (!sessionKey || sessionKey.length !== 32) {
        console.error('[Crypto] Invalid session key provided for encryption', sessionKey?.length);
        throw new Error('Invalid or missing 32-byte session key for encryption');
    }

    try {
        // Convert data to JSON string then to Uint8Array
        const jsonData = JSON.stringify(data);
        const messageUint8 = new TextEncoder().encode(jsonData);

        // Generate a secure random 12-byte nonce
        const nonce = randomBytes(12); // Use library's secure random generator

        // Encrypt using @noble/ciphers implementation (matches Rust crate)
        // Ensure sessionKey is exactly 32 bytes
        const cipher = chacha20poly1305(sessionKey, nonce);
        const encrypted = cipher.encrypt(messageUint8); // Returns ciphertext + 16-byte tag

        console.log('[Crypto] Successfully encrypted data using @noble/ciphers');
        console.debug('[Crypto] Encrypt details:', {
            plaintextLength: messageUint8.length,
            nonceLength: nonce.length,
            ciphertextTagLength: encrypted.length
        });

        return {
            encrypted, // This Uint8Array contains ciphertext + tag
            nonce      // This is the 12-byte nonce
        };
    } catch (error) {
        console.error('[Crypto] Encryption error:', error);
        throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Decrypt data using the session key with IETF ChaCha20-Poly1305 (RFC 8439)
 * @param encrypted Encrypted data (ciphertext + auth tag)
 * @param nonce 12-byte nonce used for encryption
 * @param sessionKey 32-byte session key for decryption
 * @returns Promise resolving to the original decrypted data (parsed JSON object)
 */
export async function decryptData(
    encrypted: Uint8Array,
    nonce: Uint8Array,
    sessionKey: Uint8Array
): Promise<any> {
    if (!sessionKey || sessionKey.length !== 32) {
        console.error('[Crypto] Invalid session key provided for decryption', sessionKey?.length);
        throw new Error('Invalid or missing 32-byte session key for decryption');
    }
    if (!nonce || nonce.length !== 12) {
        console.error('[Crypto] Invalid nonce provided for decryption', nonce?.length);
        throw new Error('Invalid or missing 12-byte nonce for decryption');
    }
    if (!encrypted || encrypted.length < 16) { // Must contain at least the 16-byte tag
        console.error('[Crypto] Invalid encrypted data provided for decryption', encrypted?.length);
        throw new Error('Invalid or empty encrypted data for decryption (must include auth tag)');
    }

    try {
        // Decrypt using @noble/ciphers implementation
        const cipher = chacha20poly1305(sessionKey, nonce);
        const decrypted: Uint8Array = cipher.decrypt(encrypted); // Throws on tag mismatch

        console.log('[Crypto] Successfully decrypted data using @noble/ciphers');

        // Convert decrypted binary data back to JSON string
        const jsonString = new TextDecoder().decode(decrypted);

        // Parse JSON data
        try {
            return JSON.parse(jsonString);
        } catch (jsonError) {
            console.error('[Crypto] Error parsing decrypted JSON:', jsonString, jsonError);
            throw new Error('Invalid JSON in decrypted message');
        }
    } catch (error) {
        console.error('[Crypto] Decryption error (likely authentication failure):', error);
         console.debug('[Crypto] Decryption details:', {
             encryptedLength: encrypted.length,
             nonceLength: nonce.length,
             keyLength: sessionKey.length,
         });
        // Distinguish specific auth error if possible, otherwise rethrow generic
        if (error instanceof Error && error.message.toLowerCase().includes('tag')) {
             throw new Error(`Decryption failed: Authentication tag mismatch`);
        }
        throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Sign a challenge with the secret key using Ed25519 detached signature
 * @param challenge Challenge data (Uint8Array)
 * @param secretKey 32-byte or 64-byte Ed25519 secret key (Uint8Array)
 * @returns Signature as a Base58 encoded string
 */
export async function signChallenge(challenge: Uint8Array, secretKey: Uint8Array): Promise<string> {
    try {
        // tweetnacl expects the 64-byte seed+pubkey or just 32-byte seed
        let signingKey = secretKey;
        if (secretKey.length === 64) {
            // If full keypair is passed, use the first 32 bytes (seed) for signing
            signingKey = secretKey.slice(0, 32);
        } else if (secretKey.length !== 32) {
            throw new Error('Invalid secret key length for signing (expected 32 or 64 bytes)');
        }

        // Sign the challenge using Ed25519 detached mode
        const signature = nacl.sign.detached(challenge, signingKey);

        // Convert signature to base58 string
        return bs58.encode(signature);
    } catch (error) {
        console.error('[Crypto] Error signing challenge:', error);
        throw error;
    }
}

/**
 * Generate a shared secret using X25519 ECDH.
 * WARNING: This function currently assumes keys are already in X25519 format
 * and DOES NOT perform Ed25519->X25519 conversion or HKDF derivation
 * required to match the Rust server's `generate_shared_secret`.
 * This needs to be updated for full compatibility.
 *
 * @param serverPublicKey Server's public key (ASSUMED to be X25519, 32 bytes)
 * @param clientSecretKey Client's Ed25519 secret key (32 or 64 bytes)
 * @returns Raw 32-byte ECDH shared secret (Uint8Array)
 */
export async function generateEcdhSharedSecret_INCOMPLETE(
    serverX25519PublicKey: Uint8Array, // IMPORTANT: Assumes this is ALREADY X25519
    clientEd25519SecretKey: Uint8Array
): Promise<Uint8Array> {
    console.warn("[Crypto] generateEcdhSharedSecret_INCOMPLETE is used. Needs Ed25519->X25519 public key conversion and HKDF to match server.");
    try {
        // Derive X25519 secret key from Ed25519 secret key (first 32 bytes)
        let secretKeyX25519: Uint8Array;
         if (clientEd25519SecretKey.length === 64) {
             secretKeyX25519 = clientEd25519SecretKey.slice(0, 32);
         } else if (clientEd25519SecretKey.length === 32) {
             secretKeyX25519 = clientEd25519SecretKey;
         } else {
             throw new Error('Invalid client secret key length (expected 32 or 64 bytes)');
         }
         // Note: The proper RFC method involves hashing, not just slicing,
         // but tweetnacl's box keypair derivation handles this internally if using nacl.box.keyPair.fromSecretKey
         // Using scalarMult directly requires the already-derived X25519 secret.
         // For simplicity matching previous code, we slice, but this might differ from Rust's hash+clamp method.

        // Compute shared secret using scalar multiplication (ECDH)
        // This assumes serverX25519PublicKey is a valid X25519 public key
        if(serverX25519PublicKey.length !== 32) {
             throw new Error('Invalid server public key length (expected 32 bytes for X25519)');
        }
        const sharedSecret = nacl.scalarMult(secretKeyX25519, serverX25519PublicKey);

        return sharedSecret; // Return raw secret, HKDF needed separately
    } catch (error) {
        console.error('[Crypto] Error in ECDH:', error);
        throw error;
    }
}

// TODO: Implement Ed25519PublicKey -> X25519PublicKey conversion using a suitable library
//       (e.g., @noble/curves) to match Rust's `ed25519_public_to_x25519`.
// TODO: Implement HKDF-SHA256 using a suitable library (e.g., @noble/hashes)
//       to derive the final session key from the raw ECDH shared secret,
//       using the same salt (if any) and info ("AERONYX-VPN-KEY") as the server.
