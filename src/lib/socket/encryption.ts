import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';

/**
 * Constants for IETF ChaCha20-Poly1305 (RFC 8439)
 */
const CHACHA20_KEY_SIZE = 32;
const CHACHA20_IETF_NONCE_SIZE = 12;
const POLY1305_TAG_SIZE = 16;
const CHACHA20_BLOCK_SIZE = 64;

/**
 * Implementation of ChaCha20 block function as defined in RFC 8439 Section 2.3
 * @param key 32-byte key
 * @param nonce 12-byte nonce
 * @param counter Block counter value
 * @returns 64-byte keystream block
 */
function chacha20Block(key: Uint8Array, nonce: Uint8Array, counter: number): Uint8Array {
    // Validate inputs
    if (key.length !== CHACHA20_KEY_SIZE) {
        throw new Error(`ChaCha20 requires a ${CHACHA20_KEY_SIZE}-byte key`);
    }
    if (nonce.length !== CHACHA20_IETF_NONCE_SIZE) {
        throw new Error(`IETF ChaCha20 requires a ${CHACHA20_IETF_NONCE_SIZE}-byte nonce`);
    }
    
    // Initialize state (16 32-bit words) per RFC 8439 Section 2.3
    const state = new Uint32Array(16);
    
    // Setup ChaCha20 state constants ("expand 32-byte k")
    state[0] = 0x61707865; // "expa"
    state[1] = 0x3320646e; // "nd 3"
    state[2] = 0x79622d32; // "2-by"
    state[3] = 0x6b206574; // "te k"
    
    // Setup key (8 32-bit words)
    for (let i = 0; i < 8; i++) {
        state[4 + i] = (
            (key[i * 4] & 0xff) |
            ((key[i * 4 + 1] & 0xff) << 8) |
            ((key[i * 4 + 2] & 0xff) << 16) |
            ((key[i * 4 + 3] & 0xff) << 24)
        );
    }
    
    // Setup counter (1 32-bit word) - RFC 8439 format
    state[12] = counter;
    
    // Setup nonce (3 32-bit words) - RFC 8439 format
    state[13] = (
        (nonce[0] & 0xff) |
        ((nonce[1] & 0xff) << 8) |
        ((nonce[2] & 0xff) << 16) |
        ((nonce[3] & 0xff) << 24)
    );
    state[14] = (
        (nonce[4] & 0xff) |
        ((nonce[5] & 0xff) << 8) |
        ((nonce[6] & 0xff) << 16) |
        ((nonce[7] & 0xff) << 24)
    );
    state[15] = (
        (nonce[8] & 0xff) |
        ((nonce[9] & 0xff) << 8) |
        ((nonce[10] & 0xff) << 16) |
        ((nonce[11] & 0xff) << 24)
    );
    
    // Clone the initial state
    const initialState = new Uint32Array(state);
    
    // Helper function for 32-bit addition (JavaScript uses 32-bit signed arithmetic)
    function add(a: number, b: number): number {
        return (a + b) >>> 0; // Ensures 32-bit unsigned result
    }
    
    // Helper function for left rotation
    function rotl(v: number, c: number): number {
        return (((v << c) | (v >>> (32 - c)))) >>> 0;
    }
    
    // ChaCha20 quarter round function
    function quarterRound(a: number, b: number, c: number, d: number): void {
        state[a] = add(state[a], state[b]);
        state[d] = rotl(state[d] ^ state[a], 16);
        
        state[c] = add(state[c], state[d]);
        state[b] = rotl(state[b] ^ state[c], 12);
        
        state[a] = add(state[a], state[b]);
        state[d] = rotl(state[d] ^ state[a], 8);
        
        state[c] = add(state[c], state[d]);
        state[b] = rotl(state[b] ^ state[c], 7);
    }
    
    // 20 rounds (10 column rounds + 10 diagonal rounds)
    for (let i = 0; i < 10; i++) {
        // Column rounds
        quarterRound(0, 4, 8, 12);
        quarterRound(1, 5, 9, 13);
        quarterRound(2, 6, 10, 14);
        quarterRound(3, 7, 11, 15);
        
        // Diagonal rounds
        quarterRound(0, 5, 10, 15);
        quarterRound(1, 6, 11, 12);
        quarterRound(2, 7, 8, 13);
        quarterRound(3, 4, 9, 14);
    }
    
    // Add the initial state to the final state
    for (let i = 0; i < 16; i++) {
        state[i] = add(state[i], initialState[i]);
    }
    
    // Convert state to bytes (little-endian)
    const output = new Uint8Array(64);
    for (let i = 0; i < 16; i++) {
        output[i * 4] = state[i] & 0xff;
        output[i * 4 + 1] = (state[i] >>> 8) & 0xff;
        output[i * 4 + 2] = (state[i] >>> 16) & 0xff;
        output[i * 4 + 3] = (state[i] >>> 24) & 0xff;
    }
    
    return output;
}

/**
 * ChaCha20 encryption/decryption (IETF version with 12-byte nonce)
 * @param key 32-byte key
 * @param nonce 12-byte nonce
 * @param counter Initial counter value
 * @param data Data to encrypt/decrypt
 * @returns Encrypted/decrypted data
 */
function chacha20Cipher(key: Uint8Array, nonce: Uint8Array, counter: number, data: Uint8Array): Uint8Array {
    const output = new Uint8Array(data.length);
    let blockCounter = counter;
    
    // Process data in 64-byte (512-bit) blocks
    for (let i = 0; i < data.length; i += CHACHA20_BLOCK_SIZE) {
        // Generate keystream block
        const keyStream = chacha20Block(key, nonce, blockCounter++);
        
        // XOR data with keystream (min of remaining data length and block size)
        const blockSize = Math.min(CHACHA20_BLOCK_SIZE, data.length - i);
        for (let j = 0; j < blockSize; j++) {
            output[i + j] = data[i + j] ^ keyStream[j];
        }
    }
    
    return output;
}

// ======= POLY1305 IMPLEMENTATION =======

// Constants for Poly1305
const P1305_PRIME = BigInt('0x3fffffffffffffffffffffffffffffffb'); // 2^130 - 5

/**
 * Pure JavaScript implementation of Poly1305 MAC per RFC 8439
 * @param key 32-byte one-time key
 * @param data Data to authenticate
 * @returns 16-byte authentication tag
 */
function poly1305Mac(key: Uint8Array, data: Uint8Array): Uint8Array {
    // Extract r and s from key
    // r is the first 16 bytes of the key with specific bits cleared
    // s is the last 16 bytes
    const r = new Uint8Array(16);
    const s = new Uint8Array(16);
    
    for (let i = 0; i < 16; i++) {
        r[i] = key[i];
    }
    
    // Clamp r (clear specific bits per Poly1305 requirements)
    r[3] &= 15;
    r[7] &= 15;
    r[11] &= 15;
    r[15] &= 15;
    r[4] &= 252;
    r[8] &= 252;
    r[12] &= 252;
    
    for (let i = 0; i < 16; i++) {
        s[i] = key[i + 16];
    }
    
    // Convert r to a number (little-endian)
    let rNum = BigInt(0);
    for (let i = 0; i < 16; i++) {
        rNum |= BigInt(r[i]) << BigInt(8 * i);
    }
    
    // Initialize accumulator
    let acc = BigInt(0);
    
    // Process input blocks
    for (let i = 0; i < data.length; i += 16) {
        // Get the current block (and pad if needed)
        const block = new Uint8Array(17);
        const blockLen = Math.min(16, data.length - i);
        
        for (let j = 0; j < blockLen; j++) {
            block[j] = data[i + j];
        }
        
        // Add padding bit if this isn't a complete block
        if (blockLen < 16) {
            block[blockLen] = 1;
        }
        
        // Convert block to number (little-endian)
        let n = BigInt(0);
        for (let j = 0; j < 16; j++) {
            n |= BigInt(block[j]) << BigInt(8 * j);
        }
        
        // Add 2^128 to all blocks (except the last one if it's not 16 bytes)
        if (blockLen === 16) {
            n |= BigInt(1) << BigInt(128);
        }
        
        // acc = (acc + n) * r mod p
        acc = (acc + n) % P1305_PRIME;
        acc = (acc * rNum) % P1305_PRIME;
    }
    
    // Convert s to a number (little-endian)
    let sNum = BigInt(0);
    for (let i = 0; i < 16; i++) {
        sNum |= BigInt(s[i]) << BigInt(8 * i);
    }
    
    // Add s to acc
    acc = (acc + sNum) % (BigInt(1) << BigInt(128));
    
    // Convert acc to bytes (little-endian)
    const tag = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        tag[i] = Number((acc >> BigInt(8 * i)) & BigInt(0xff));
    }
    
    return tag;
}

/**
 * RFC 8439 compliant ChaCha20-Poly1305 AEAD encryption
 * 
 * @param key 32-byte key
 * @param nonce 12-byte nonce
 * @param plaintext Data to encrypt
 * @param aad Additional authenticated data (optional)
 * @returns Ciphertext with 16-byte tag appended
 */
function chacha20poly1305Encrypt(
    key: Uint8Array,
    nonce: Uint8Array,
    plaintext: Uint8Array,
    aad: Uint8Array = new Uint8Array(0)
): Uint8Array {
    // Validation
    if (key.length !== CHACHA20_KEY_SIZE) {
        throw new Error(`ChaCha20-Poly1305 requires a ${CHACHA20_KEY_SIZE}-byte key`);
    }
    if (nonce.length !== CHACHA20_IETF_NONCE_SIZE) {
        throw new Error(`IETF ChaCha20-Poly1305 requires a ${CHACHA20_IETF_NONCE_SIZE}-byte nonce`);
    }
    
    // Step 1: Generate Poly1305 one-time key using ChaCha20 with counter 0
    const poly1305Key = chacha20Block(key, nonce, 0);
    
    // Step 2: Encrypt plaintext using ChaCha20 with counter 1
    const ciphertext = chacha20Cipher(key, nonce, 1, plaintext);
    
    // Step 3: Compute Poly1305 tag over AAD and ciphertext
    // According to RFC 8439 Section 2.8
    
    // Prepare the MAC input according to RFC 8439 Section 2.8
    
    // Calculate required padding sizes
    const aadPadding = (16 - (aad.length % 16)) % 16;
    const ciphertextPadding = (16 - (ciphertext.length % 16)) % 16;
    
    // Create MAC input: AAD || pad(AAD) || ciphertext || pad(ciphertext) || len(AAD) || len(ciphertext)
    const macInputLength = 
        aad.length + aadPadding + 
        ciphertext.length + ciphertextPadding + 
        16; // Length block (8 bytes AAD length, 8 bytes ciphertext length)
    
    const macInput = new Uint8Array(macInputLength);
    let macInputPos = 0;
    
    // Add AAD
    macInput.set(aad, macInputPos);
    macInputPos += aad.length;
    
    // Add padding for AAD (zeros)
    macInputPos += aadPadding;
    
    // Add ciphertext
    macInput.set(ciphertext, macInputPos);
    macInputPos += ciphertext.length;
    
    // Add padding for ciphertext (zeros)
    macInputPos += ciphertextPadding;
    
    // Add length block (little-endian 64-bit unsigned integers)
    // AAD length
    for (let i = 0; i < 8; i++) {
        macInput[macInputPos + i] = (aad.length >>> (8 * i)) & 0xff;
    }
    // Ciphertext length
    for (let i = 0; i < 8; i++) {
        macInput[macInputPos + 8 + i] = (ciphertext.length >>> (8 * i)) & 0xff;
    }
    
    // Compute Poly1305 tag
    const tag = poly1305Mac(poly1305Key, macInput);
    
    // Combine ciphertext and tag
    const result = new Uint8Array(ciphertext.length + tag.length);
    result.set(ciphertext);
    result.set(tag, ciphertext.length);
    
    return result;
}

/**
 * RFC 8439 compliant ChaCha20-Poly1305 AEAD decryption
 * 
 * @param key 32-byte key
 * @param nonce 12-byte nonce
 * @param ciphertextWithTag Ciphertext with authentication tag
 * @param aad Additional authenticated data (optional)
 * @returns Decrypted plaintext or null if authentication fails
 */
function chacha20poly1305Decrypt(
    key: Uint8Array,
    nonce: Uint8Array,
    ciphertextWithTag: Uint8Array,
    aad: Uint8Array = new Uint8Array(0)
): Uint8Array | null {
    // Validation
    if (key.length !== CHACHA20_KEY_SIZE) {
        throw new Error(`ChaCha20-Poly1305 requires a ${CHACHA20_KEY_SIZE}-byte key`);
    }
    if (nonce.length !== CHACHA20_IETF_NONCE_SIZE) {
        throw new Error(`IETF ChaCha20-Poly1305 requires a ${CHACHA20_IETF_NONCE_SIZE}-byte nonce`);
    }
    if (ciphertextWithTag.length < POLY1305_TAG_SIZE) {
        throw new Error('Invalid ciphertext: too short to contain authentication tag');
    }
    
    // Extract ciphertext and tag
    const ciphertext = ciphertextWithTag.slice(0, ciphertextWithTag.length - POLY1305_TAG_SIZE);
    const receivedTag = ciphertextWithTag.slice(ciphertextWithTag.length - POLY1305_TAG_SIZE);
    
    // Step 1: Generate Poly1305 one-time key using ChaCha20 with counter 0
    const poly1305Key = chacha20Block(key, nonce, 0);
    
    // Step 2: Compute expected Poly1305 tag
    // Prepare the MAC input according to RFC 8439 Section 2.8
    
    // Calculate required padding sizes
    const aadPadding = (16 - (aad.length % 16)) % 16;
    const ciphertextPadding = (16 - (ciphertext.length % 16)) % 16;
    
    // Create MAC input: AAD || pad(AAD) || ciphertext || pad(ciphertext) || len(AAD) || len(ciphertext)
    const macInputLength = 
        aad.length + aadPadding + 
        ciphertext.length + ciphertextPadding + 
        16; // Length block (8 bytes AAD length, 8 bytes ciphertext length)
    
    const macInput = new Uint8Array(macInputLength);
    let macInputPos = 0;
    
    // Add AAD
    macInput.set(aad, macInputPos);
    macInputPos += aad.length;
    
    // Add padding for AAD (zeros)
    macInputPos += aadPadding;
    
    // Add ciphertext
    macInput.set(ciphertext, macInputPos);
    macInputPos += ciphertext.length;
    
    // Add padding for ciphertext (zeros)
    macInputPos += ciphertextPadding;
    
    // Add length block (little-endian 64-bit unsigned integers)
    // AAD length
    for (let i = 0; i < 8; i++) {
        macInput[macInputPos + i] = (aad.length >>> (8 * i)) & 0xff;
    }
    // Ciphertext length
    for (let i = 0; i < 8; i++) {
        macInput[macInputPos + 8 + i] = (ciphertext.length >>> (8 * i)) & 0xff;
    }
    
    // Compute expected tag
    const expectedTag = poly1305Mac(poly1305Key, macInput);
    
    // Verify the tag (constant-time comparison)
    if (receivedTag.length !== expectedTag.length) {
        return null;
    }
    
    let tagMatch = true;
    let diff = 0;
    
    for (let i = 0; i < receivedTag.length; i++) {
        diff |= receivedTag[i] ^ expectedTag[i];
    }
    
    if (diff !== 0) {
        return null;
    }
    
    // Step 3: Decrypt the ciphertext
    return chacha20Cipher(key, nonce, 1, ciphertext);
}

/**
 * Encrypt data using the session key with IETF ChaCha20-Poly1305
 * @param data Data to encrypt
 * @param sessionKey Session key
 * @returns Encrypted data and nonce
 */
export async function encryptData(
    data: any, 
    sessionKey: Uint8Array
): Promise<{encrypted: Uint8Array, nonce: Uint8Array}> {
    if (!sessionKey) {
        throw new Error('No session key available for encryption');
    }
    
    // Convert data to JSON string
    const jsonData = JSON.stringify(data);
    
    // Convert string to Uint8Array for encryption
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(jsonData);
    
    // Generate a 12-byte nonce as required by IETF ChaCha20-Poly1305
    const nonce = new Uint8Array(CHACHA20_IETF_NONCE_SIZE);
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(nonce);
    } else {
        // Fallback for environments without crypto.getRandomValues
        for (let i = 0; i < CHACHA20_IETF_NONCE_SIZE; i++) {
            nonce[i] = Math.floor(Math.random() * 256);
        }
    }
    
    try {
        let encrypted: Uint8Array;
        
        // Strategy 1: Try Web Crypto API with ChaCha20-Poly1305 if available
        try {
            const cryptoKey = await window.crypto.subtle.importKey(
                'raw', 
                sessionKey, 
                { name: 'ChaCha20-Poly1305' },
                false, 
                ['encrypt']
            );
            
            const encryptedBuffer = await window.crypto.subtle.encrypt(
                {
                    name: 'ChaCha20-Poly1305',
                    iv: nonce
                },
                cryptoKey,
                plaintext
            );
            
            encrypted = new Uint8Array(encryptedBuffer);
            console.log('[Socket] Successfully used Web Crypto API for ChaCha20-Poly1305 encryption');
        } catch (webCryptoError) {
            // Strategy 2: Use our pure JS implementation
            console.warn('[Socket] Web Crypto API not available for ChaCha20-Poly1305, using pure JS implementation:', webCryptoError);
            
            console.time('ChaCha20-Poly1305 Encryption');
            encrypted = chacha20poly1305Encrypt(sessionKey, nonce, plaintext);
            console.timeEnd('ChaCha20-Poly1305 Encryption');
            
            console.log('[Socket] Successfully used pure JS implementation for ChaCha20-Poly1305 encryption');
        }
        
        if (!encrypted) {
            throw new Error('Encryption failed - no output produced');
        }
        
        // Log encryption details for debugging (showing only the first few bytes)
        console.debug('[Socket] Encryption details:', {
            plaintextLength: plaintext.length,
            ciphertextLength: encrypted.length,
            nonceLength: nonce.length,
            nonceHex: Array.from(nonce.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(''),
            ciphertextPrefix: Array.from(encrypted.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('')
        });
        
        return { encrypted, nonce };
    } catch (error) {
        console.error('[Socket] Encryption error:', error);
        throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Decrypt data using the session key with IETF ChaCha20-Poly1305
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
    if (!sessionKey) {
        throw new Error('No session key available for decryption');
    }
    
    try {
        // Validate nonce size
        if (nonce.length !== CHACHA20_IETF_NONCE_SIZE) {
            console.warn(`[Socket] Unexpected nonce length: ${nonce.length} bytes (expected ${CHACHA20_IETF_NONCE_SIZE})`);
            
            if (nonce.length === 24) {
                nonce = nonce.slice(0, CHACHA20_IETF_NONCE_SIZE);
                console.log('[Socket] Truncated 24-byte nonce to 12 bytes for IETF ChaCha20-Poly1305');
            } else {
                throw new Error(`Invalid nonce length: ${nonce.length} bytes`);
            }
        }
        
        // Log decryption attempt details
        console.debug('[Socket] Decryption attempt:', {
            ciphertextWithTagLength: encrypted.length,
            nonceLength: nonce.length,
            keyLength: sessionKey.length,
            nonceHex: Array.from(nonce.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(''),
            ciphertextPrefix: Array.from(encrypted.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('')
        });
        
        let decryptedData: Uint8Array | null = null;
        
        // Strategy 1: Try Web Crypto API with ChaCha20-Poly1305 if available
        try {
            const cryptoKey = await window.crypto.subtle.importKey(
                'raw',
                sessionKey,
                { name: 'ChaCha20-Poly1305' },
                false,
                ['decrypt']
            );
            
            const decryptedBuffer = await window.crypto.subtle.decrypt(
                {
                    name: 'ChaCha20-Poly1305',
                    iv: nonce
                },
                cryptoKey,
                encrypted
            );
            
            decryptedData = new Uint8Array(decryptedBuffer);
            console.log('[Socket] Successfully used Web Crypto API for ChaCha20-Poly1305 decryption');
        } catch (webCryptoError) {
            // Strategy 2: Use our pure JS implementation
            console.warn('[Socket] Web Crypto API not available for ChaCha20-Poly1305 decryption, using pure JS implementation:', webCryptoError);
            
            console.time('ChaCha20-Poly1305 Decryption');
            decryptedData = chacha20poly1305Decrypt(sessionKey, nonce, encrypted);
            console.timeEnd('ChaCha20-Poly1305 Decryption');
            
            if (!decryptedData) {
                console.error('[Socket] ChaCha20-Poly1305 authentication failed - tag verification failed');
                throw new Error('Decryption failed - authentication tag verification failed');
            }
            
            console.log('[Socket] Successfully used pure JS implementation for ChaCha20-Poly1305 decryption');
        }
        
        if (!decryptedData) {
            throw new Error('Decryption failed - no output produced');
        }
        
        // Convert binary data to string
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(decryptedData);
        
        try {
            return JSON.parse(jsonString);
        } catch (jsonError) {
            console.error('[Socket] Error parsing decrypted JSON:', jsonError);
            throw new Error('Invalid JSON in decrypted message');
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
        // Sign the challenge using Ed25519
        const signature = nacl.sign.detached(challenge, secretKey);
        
        // Convert signature to base58 string for transmission
        return bs58.encode(signature);
    } catch (error) {
        console.error('[Socket] Error signing challenge:', error);
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
        // For Ed25519 secret keys, we need to use the first 32 bytes for X25519
        const secretKeyX25519 = clientSecretKey.slice(0, 32);
        
        // Perform X25519 key exchange to derive shared secret
        const sharedSecret = nacl.scalarMult(secretKeyX25519, serverPublicKey);
        
        return sharedSecret;
    } catch (error) {
        console.error('[Socket] Error generating session key:', error);
        throw error;
    }
}
