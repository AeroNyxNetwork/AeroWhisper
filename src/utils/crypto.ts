import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
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
  return {
    publicKey: nacl.box.keyPair.fromSecretKey(keypair.secretKey).publicKey,
    secretKey: nacl.box.keyPair.fromSecretKey(keypair.secretKey).secretKey
  };
};

// Derive shared secret from local secret key and remote public key
export const deriveSharedSecret = (
  localSecretKey: Uint8Array,
  remotePublicKey: Uint8Array
): Uint8Array => {
  // Convert keys to X25519 format
  const localX25519SecretKey = nacl.box.keyPair.fromSecretKey(localSecretKey).secretKey;
  const remoteX25519PublicKey = convertEd25519PublicKeyToX25519(remotePublicKey);
  
  // Perform X25519 Diffie-Hellman
  const sharedSecret = nacl.scalarMult(localX25519SecretKey, remoteX25519PublicKey);
  
  // Hash the shared secret to derive a symmetric key
  return nacl.hash(sharedSecret).slice(0, nacl.secretbox.keyLength);
};

// Convert Ed25519 public key to X25519
export const convertEd25519PublicKeyToX25519 = (publicKey: Uint8Array): Uint8Array => {
  // Note: This is a simplified conversion and actual implementation should
  // properly convert Edwards curve to Montgomery curve
  return nacl.box.keyPair.fromSecretKey(
    nacl.sign.keyPair.fromSeed(publicKey.slice(0, 32)).secretKey
  ).publicKey;
};

// Encrypt message for a specific recipient
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

// Decrypt message from a specific sender
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
