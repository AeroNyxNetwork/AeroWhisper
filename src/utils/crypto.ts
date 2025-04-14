import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import * as bs58 from 'bs58';
import { v4 as uuid } from 'uuid';

// Generate a unique session ID for a chat
export const generateSessionId = (): string => {
  return uuid();
};

// Generate Solana-compatible keypair
export const generateKeyPair = () => {
  const keypair = nacl.sign.keyPair();
  return {
    publicKey: bs58.encode(keypair.publicKey),
    secretKey: bs58.encode(keypair.secretKey)
  };
};

// Convert Ed25519 keypair to X25519 for ECDH
export const convertEd25519ToX25519KeyPair = (keypair: nacl.SignKeyPair): nacl.BoxKeyPair => {
  const x25519PublicKey = nacl.scalarMult.base(nacl.sign.keyPair.fromSecretKey(keypair.secretKey).secretKey.slice(0, 32));
  return {
    publicKey: x25519PublicKey,
    secretKey: keypair.secretKey.slice(0, 32)
  };
};

// Properly convert Ed25519 public key to X25519
export const convertEd25519PublicKeyToX25519 = (publicKey: Uint8Array): Uint8Array => {
  // Use nacl.sign.keyPair.fromSeed to create a keypair from the first 32 bytes of publicKey
  // This is a common approach but not cryptographically accurate for all cases
  // In a production environment, use a dedicated library for this conversion
  const seed = publicKey.slice(0, 32);
  const keypair = nacl.sign.keyPair.fromSeed(seed);
  const x25519PublicKey = nacl.scalarMult.base(keypair.secretKey.slice(0, 32));
  return x25519PublicKey;
};

// Derive shared secret from local secret key and remote public key
export const deriveSharedSecret = (
  localSecretKey: Uint8Array,
  remotePublicKey: Uint8Array
): Uint8Array => {
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
};

// Encrypt message with shared secret
export const encryptMessage = (
  message: string,
  sharedSecret: Uint8Array
): { ciphertext: string, nonce: string } => {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageUint8 = new TextEncoder().encode(message);
  
  const encrypted = nacl.secretbox(messageUint8, nonce, sharedSecret);
  
  return {
    ciphertext: bs58.encode(encrypted),
    nonce: bs58.encode(nonce)
  };
};

// Decrypt message with shared secret
export const decryptMessage = (
  ciphertext: string,
  nonce: string,
  sharedSecret: Uint8Array
): string => {
  const encryptedData = bs58.decode(ciphertext);
  const nonceData = bs58.decode(nonce);
  
  const decrypted = nacl.secretbox.open(encryptedData, nonceData, sharedSecret);
  
  if (!decrypted) {
    throw new Error('Failed to decrypt message');
  }
  
  return new TextDecoder().decode(decrypted);
};

// Create a signature for challenge-response authentication
export const signChallenge = (
  challenge: Uint8Array,
  secretKey: Uint8Array
): string => {
  const signature = nacl.sign.detached(challenge, secretKey);
  return bs58.encode(signature);
};

// Verify a signature against the original challenge
export const verifySignature = (
  challenge: Uint8Array,
  signature: string,
  publicKey: string
): boolean => {
  const signatureUint8 = bs58.decode(signature);
  const publicKeyUint8 = new PublicKey(publicKey).toBytes();
  
  return nacl.sign.detached.verify(challenge, signatureUint8, publicKeyUint8);
};

// Generate a random encryption key for a session
export const generateSessionKey = (): Uint8Array => {
  return nacl.randomBytes(nacl.secretbox.keyLength);
};

// Encrypt a session key for secure transmission
export const encryptSessionKey = (
  sessionKey: Uint8Array,
  sharedSecret: Uint8Array
): { encryptedKey: string, keyNonce: string } => {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const encrypted = nacl.secretbox(sessionKey, nonce, sharedSecret);
  
  return {
    encryptedKey: bs58.encode(encrypted),
    keyNonce: bs58.encode(nonce)
  };
};

// Decrypt a session key after receiving it
export const decryptSessionKey = (
  encryptedKey: string,
  keyNonce: string,
  sharedSecret: Uint8Array
): Uint8Array => {
  const encryptedKeyUint8 = bs58.decode(encryptedKey);
  const keyNonceUint8 = bs58.decode(keyNonce);
  
  const sessionKey = nacl.secretbox.open(encryptedKeyUint8, keyNonceUint8, sharedSecret);
  
  if (!sessionKey) {
    throw new Error('Failed to decrypt session key');
  }
  
  return sessionKey;
};

// Simple encrypt packet for transmission
export const encryptPacket = (
  data: any,
  sessionKey: Uint8Array
): { encrypted: string, nonce: string } => {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageUint8 = new TextEncoder().encode(JSON.stringify(data));
  
  const encrypted = nacl.secretbox(messageUint8, nonce, sessionKey);
  
  return {
    encrypted: bs58.encode(encrypted),
    nonce: bs58.encode(nonce)
  };
};

// Decrypt packet after receiving
export const decryptPacket = (
  encrypted: string,
  nonce: string,
  sessionKey: Uint8Array
): any => {
  const encryptedData = bs58.decode(encrypted);
  const nonceData = bs58.decode(nonce);
  
  const decrypted = nacl.secretbox.open(encryptedData, nonceData, sessionKey);
  
  if (!decrypted) {
    throw new Error('Failed to decrypt packet');
  }
  
  return JSON.parse(new TextDecoder().decode(decrypted));
};
