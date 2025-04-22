/**
 * Test utilities for testing encryption functionality
 * For debugging and troubleshooting encryption issues
 */

import { encryptWithAesGcm, decryptWithAesGcm, generateNonce } from './cryptoUtils';

/**
 * Test AES-GCM encryption/decryption cycle with a given format
 * This helps verify the crypto functions work properly and match the server's expectations
 * 
 * @param messageData The data to test encryption with
 * @param fieldName The field name to use for the encryption algorithm in data packet
 * @returns Result object with success status and details
 */
export async function testEncryptionFormat(
  messageData: any = { test: "AES-GCM Test Message" },
  fieldName: string = 'encryption' // The field name to use ('encryption' or 'encryption_algorithm')
): Promise<{success: boolean, details: any}> {
  try {
    console.log('[TestCrypto] Starting encryption format test with field name:', fieldName);
    
    // Generate a session key (32 bytes for AES-256-GCM)
    const sessionKey = new Uint8Array(32);
    crypto.getRandomValues(sessionKey);
    
    // Convert the data to JSON string
    const messageString = JSON.stringify(messageData);
    console.log('[TestCrypto] Message to encrypt:', messageString);
    
    // Encrypt the message
    const { ciphertext, nonce } = await encryptWithAesGcm(messageString, sessionKey);
    console.log('[TestCrypto] Message encrypted successfully. Ciphertext length:', ciphertext.length);
    
    // Create packet with the specified field name
    const packet: any = {
      type: 'Data',
      encrypted: Array.from(ciphertext),
      nonce: Array.from(nonce),
      counter: 1,
      padding: null
    };
    
    // Set the encryption algorithm field with the specified field name
    packet[fieldName] = 'aes-gcm';
    
    // Serialize the packet
    const packetJson = JSON.stringify(packet);
    console.log('[TestCrypto] Packet created with field name:', fieldName);
    console.log('[TestCrypto] Sample packet:', packetJson.substring(0, 100) + '...');
    
    // Deserialize to simulate transmission
    const receivedPacket = JSON.parse(packetJson);
    
    // Extract encrypted data and nonce
    const encryptedUint8 = new Uint8Array(receivedPacket.encrypted);
    const nonceUint8 = new Uint8Array(receivedPacket.nonce);
    
    // Attempt to decrypt
    const decryptedText = await decryptWithAesGcm(
      encryptedUint8,
      nonceUint8,
      sessionKey,
      'string'
    ) as string;
    
    // Parse the decrypted data
    const decryptedData = JSON.parse(decryptedText);
    
    console.log('[TestCrypto] Successfully decrypted test packet');
    console.log('[TestCrypto] Original:', messageData);
    console.log('[TestCrypto] Decrypted:', decryptedData);
    
    // Check if the encryption/decryption cycle was successful
    const success = JSON.stringify(messageData) === JSON.stringify(decryptedData);
    
    return {
      success,
      details: {
        original: messageData,
        decrypted: decryptedData,
        packetSize: packetJson.length,
        ciphertextSize: ciphertext.length,
        nonceSize: nonce.length,
        fieldName,
        fieldValue: packet[fieldName]
      }
    };
  } catch (error) {
    console.error('[TestCrypto] Test failed:', error);
    
    return {
      success: false,
      details: {
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

/**
 * Run encryption tests with both field names to determine which one works
 * This can help troubleshoot server compatibility issues
 * 
 * @returns Results from both tests
 */
export async function findCompatibleEncryptionFormat(): Promise<{
  encryptionField: boolean,
  encryptionAlgorithmField: boolean,
  recommendedField: string
}> {
  // Test message with timestamp to ensure uniqueness
  const testMessage = {
    type: 'test',
    content: 'AES-GCM encryption test',
    timestamp: new Date().toISOString()
  };
  
  // Test both field names
  const test1 = await testEncryptionFormat(testMessage, 'encryption');
  const test2 = await testEncryptionFormat(testMessage, 'encryption_algorithm');
  
  return {
    encryptionField: test1.success,
    encryptionAlgorithmField: test2.success,
    recommendedField: test1.success ? 'encryption' : (test2.success ? 'encryption_algorithm' : 'unknown')
  };
}

/**
 * Generate an encrypted test packet to send to the server
 * This can be used to test server compatibility directly
 * 
 * @param sessionKey The session key to use for encryption
 * @param fieldName Field name to use for encryption algorithm
 * @returns Encrypted packet ready to send
 */
export async function generateTestPacket(
  sessionKey: Uint8Array, 
  fieldName: string = 'encryption'
): Promise<any> {
  // Create test message
  const message = {
    type: 'test',
    content: 'Test message for server compatibility',
    timestamp: new Date().toISOString(),
    id: `test-${Date.now()}`
  };
  
  // Convert to string
  const messageString = JSON.stringify(message);
  
  // Encrypt
  const { ciphertext, nonce } = await encryptWithAesGcm(messageString, sessionKey);
  
  // Create packet
  const packet: any = {
    type: 'Data',
    encrypted: Array.from(ciphertext),
    nonce: Array.from(nonce),
    counter: Date.now(),
    padding: null
  };
  
  // Set encryption algorithm field
  packet[fieldName] = 'aes-gcm';
  
  return packet;
}
