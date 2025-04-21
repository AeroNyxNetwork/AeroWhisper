import * as nacl from 'tweetnacl'; // Keep for Ed25519 signing and potentially ECDH base
import * as bs58 from 'bs58'; // Keep for Base58
import { chacha20poly1305 } from '@noble/ciphers/chacha'; // Use Noble for ChaCha20
import { randomBytes } from '@noble/ciphers/utils'; // Use Noble for secure random bytes

// --- REMOVE Node.js crypto import and helper functions ---
// import crypto from 'crypto'; // REMOVE THIS
// function chacha20poly1305Encrypt(...) { ... } // REMOVE THIS
// function chacha20poly1305Decrypt(...) { ... } // REMOVE THIS

/**
 * Encrypt data using the session key with IETF ChaCha20-Poly1305 (RFC 8439)
 * @param data Data to encrypt (can be any JSON-serializable object)
 * @param sessionKey 32-byte session key for encryption (Uint8Array)
 * @returns Promise resolving to { encrypted: Uint8Array (ciphertext+tag), nonce: Uint8Array (12 bytes) }
 */
export async function encryptData(
    data: any,
    sessionKey: Uint8Array
): Promise<{ encrypted: Uint8Array; nonce: Uint8Array }> {
    if (!sessionKey || sessionKey.length !== 32) {
        console.error('[Crypto] Invalid session key provided for encryption', sessionKey?.length);
        throw new Error('Invalid or missing 32-byte session key for encryption');
    }

    try {
        // Convert data to JSON string then to Uint8Array
        const messageUint8 = new TextEncoder().encode(JSON.stringify(data));

        // Generate a secure random 12-byte nonce
        const nonce = randomBytes(12);

        // Encrypt using @noble/ciphers implementation (compatible with Rust chacha20poly1305 crate)
        const cipher = chacha20poly1305(sessionKey, nonce); // Key, Nonce
        const encrypted: Uint8Array = cipher.encrypt(messageUint8); // Returns Uint8Array(ciphertext + 16-byte tag)

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
        // Don't fall back to incompatible methods
        throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Decrypt data using the session key with IETF ChaCha20-Poly1305 (RFC 8439)
 * @param encrypted Encrypted data (ciphertext + auth tag) (Uint8Array)
 * @param nonce 12-byte nonce used for encryption (Uint8Array)
 * @param sessionKey 32-byte session key for decryption (Uint8Array)
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
    // Ensure encrypted data includes at least the 16-byte tag
    if (!encrypted || encrypted.length < 16) {
        console.error('[Crypto] Invalid encrypted data provided for decryption', encrypted?.length);
        throw new Error('Invalid or empty encrypted data (must include auth tag)');
    }

    try {
        // Decrypt using @noble/ciphers (handles tag verification)
        const cipher = chacha20poly1305(sessionKey, nonce); // Key, Nonce
        const decrypted: Uint8Array = cipher.decrypt(encrypted); // Pass Ciphertext + Tag

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
        // Don't fall back to incompatible methods
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
            signingKey = secretKey.slice(0, 32);
        } else if (secretKey.length !== 32) {
            throw new Error('Invalid secret key length for signing (expected 32 or 64 bytes)');
        }

        const signature = nacl.sign.detached(challenge, signingKey);
        return bs58.encode(signature); // Return Base58 encoded signature
    } catch (error) {
        console.error('[Crypto] Error signing challenge:', error);
        throw error;
    }
}


/**
 * Generate the raw ECDH shared secret using X25519.
 * WARNING: This function is INCOMPLETE for the AeroNyx protocol.
 * It assumes keys are already X25519 and lacks HKDF.
 * The calling code (e.g., handleIpAssign) MUST perform:
 * 1. Ed25519 -> X25519 conversion for BOTH keys.
 * 2. HKDF-SHA256 derivation on the result of this function.
 *
 * @param serverX25519PublicKey Server's X25519 public key (32 bytes)
 * @param clientX25519SecretKey Client's X25519 secret key (32 bytes, derived from Ed25519)
 * @returns Raw 32-byte ECDH shared secret (Uint8Array)
 */
export async function generateEcdhSharedSecret_INCOMPLETE(
    serverX25519PublicKey: Uint8Array,
    clientX25519SecretKey: Uint8Array // This should be the result of Ed -> X conversion
): Promise<Uint8Array> {
    console.warn("[Crypto] generateEcdhSharedSecret_INCOMPLETE called. Ensure keys are X25519 and HKDF is applied later.");
    try {
        if (serverX25519PublicKey.length !== 32 || clientX25519SecretKey.length !== 32) {
            throw new Error('Invalid X25519 key length (expected 32 bytes)');
        }
        // Compute shared secret using scalar multiplication (ECDH)
        const sharedSecret = nacl.scalarMult(clientX25519SecretKey, serverX25519PublicKey);
        return sharedSecret;
    } catch (error) {
        console.error('[Crypto] Error in ECDH scalarMult:', error);
        throw error;
    }
}

// TODO: Implement Ed25519PublicKey -> X25519PublicKey conversion using a library like @noble/curves
// TODO: Implement Ed25519SecretKey -> X25519SecretKey conversion matching Rust's hash+clamp method (e.g., using SHA512 from @noble/hashes)
// TODO: Implement HKDF-SHA256 using a library like @noble/hashes with info="AERONYX-VPN-KEY"
