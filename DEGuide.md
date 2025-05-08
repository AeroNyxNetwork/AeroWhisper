# AeroNyx End-to-End Encryption Implementation Guide

## Overview

This document provides an overview of the encryption implementation used in AeroNyx's secure messaging platform. It explains our approach to encryption field naming consistency, encryption methods, and best practices for developers working with the codebase.

## Encryption Field Naming Standard

One of the critical aspects of our encryption implementation is maintaining consistency in field naming across all components. We've standardized on the following field name:

```
encryption_algorithm
```

### Why Consistent Field Naming Matters

Previously, our codebase used both `encryption` and `encryption_algorithm` fields in different parts of the code, leading to compatibility issues between client components and the server. This inconsistency could cause:

1. Failed message decryption
2. Connection issues between peers
3. Incompatibility between client and server versions
4. Difficulty debugging encryption-related issues

By standardizing on `encryption_algorithm`, we ensure consistent behavior across all system components.

## Supported Encryption Algorithms

AeroNyx currently supports the following encryption algorithms:

1. **AES-GCM (Primary)**: Our preferred algorithm that provides authenticated encryption with modern security
2. **ChaCha20-Poly1305**: Used as a fallback on platforms with limited AES hardware acceleration
3. **AES-CBC with HMAC**: Legacy support for older clients

### Default Configuration

```javascript
// Default to AES-GCM for all new connections
this.encryptionAlgorithm = 'aes-gcm';
```

## Key Components

### 1. Encryption Packet Structure

All encrypted messages follow this structure:

```javascript
{
  type: 'Data',
  encrypted: Array.from(ciphertext),  // Encrypted bytes
  nonce: Array.from(nonce),          // Nonce/IV used for encryption
  counter: counter,                  // Message counter for replay protection
  encryption_algorithm: 'aes-gcm',   // Always use this field name
  padding: null                      // Optional padding for length concealment
}
```

### 2. Encryption & Decryption Functions

All encryption is performed using the `encryptWithAesGcm` and `decryptWithAesGcm` functions from `cryptoUtils.ts`. These provide consistent encryption handling across the application.

### 3. Backward Compatibility

While we now consistently use the `encryption_algorithm` field when creating packets, our decryption logic maintains backward compatibility with both field names:

```javascript
// Support both field names when decrypting
let algorithm: string;
if (packet.encryption_algorithm !== undefined) {
  algorithm = packet.encryption_algorithm;
} else if (packet.encryption !== undefined) {
  algorithm = packet.encryption;
} else {
  algorithm = 'aes-gcm'; // Default
}
```

## Implementation Details

### Socket Communication

The `AeroNyxSocket` class uses `createEncryptedPacket` for all outgoing messages, ensuring consistent field naming. When processing incoming messages, it supports both field names for backward compatibility.

### WebRTC P2P Communication

The `WebRTCManager` class follows the same pattern, using `encryption_algorithm` for all outgoing messages while supporting both field names for incoming messages.

### Authentication Process

During authentication, we send our encryption capabilities using the standard field name:

```javascript
const authMessage = {
  type: 'Auth',
  public_key: this.publicKey,
  version: '1.0.0',
  features: ['aes-gcm', 'chacha20poly1305', 'webrtc'],
  encryption_algorithm: 'aes-gcm', // Use consistent field name
  nonce: Date.now().toString(),
};
```

## Debugging Encryption Issues

When debugging encryption issues, these fields are logged:

1. Which encryption field is being used (`encryption_algorithm` or `encryption`)
2. The algorithm value (usually 'aes-gcm')
3. Encrypted data length and nonce length

Example log:

```
[Crypto] Using encryption_algorithm field: aes-gcm
[Crypto] Encrypted data length: 384, nonce length: 12
```

## Best Practices

1. Always use `encryption_algorithm` as the field name when creating new packets
2. Use the utility functions in `cryptoUtils.ts` for all encryption operations
3. Maintain backward compatibility in decryption logic
4. For any new components, follow the pattern established in the existing code

## Error Handling

Errors during encryption/decryption operations are logged with detailed information:

1. Error message
2. Data being processed (limited to avoid exposing sensitive information)
3. Stack trace for debugging

## Conclusion

Consistent field naming is critical for reliable encryption in our distributed system. Always use `encryption_algorithm` when implementing new features or modifying existing code. This ensures compatibility across all components while maintaining backward compatibility.
