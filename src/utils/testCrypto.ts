// src/utils/testCrypto.ts
import { 
  isAesGcmSupported, 
  generateNonce, 
  encryptWithAesGcm, 
  decryptWithAesGcm,
  generateSessionId
} from './cryptoUtils';

/**
 * Test encryption with a specific field name
 * @param data Test data to encrypt
 * @param fieldName Field name to use ('encryption' or 'encryption_algorithm')
 * @returns Test result with success status
 */
export async function testEncryptionFormat(
  data: any,
  fieldName: 'encryption' | 'encryption_algorithm'
): Promise<{success: boolean, error?: string}> {
  try {
    // Generate test key
    const testKey = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(testKey);
    } else {
      // Fallback
      for (let i = 0; i < testKey.length; i++) {
        testKey[i] = Math.floor(Math.random() * 256);
      }
    }
    
    // Create encrypted data packet
    const nonce = generateNonce();
    const messageString = JSON.stringify(data);
    const { ciphertext } = await encryptWithAesGcm(messageString, testKey, nonce);
    
    // Create test packet with specified field name
    const packet: any = {
      type: 'Data',
      encrypted: Array.from(ciphertext),
      nonce: Array.from(nonce),
      counter: 0
    };
    
    // Add field with correct name
    packet[fieldName] = 'aes256gcm';
    
    // Try to decrypt
    try {
      const decryptedText = await decryptWithAesGcm(ciphertext, nonce, testKey, 'string') as string;
      const decrypted = JSON.parse(decryptedText);
      
      // Check if decrypted data matches original
      const success = JSON.stringify(decrypted) === JSON.stringify(data);
      
      return { success };
    } catch (decryptError) {
      return {
        success: false,
        error: `Decryption failed: ${decryptError instanceof Error ? decryptError.message : String(decryptError)}`
      };
    }
  } catch (error) {
    console.error(`[TestCrypto] Test failed for field '${fieldName}':`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test different encryption formats to find a compatible one
 * @returns Promise resolving to an object with test results
 */
export async function findCompatibleEncryptionFormat(): Promise<any> {
  const results = {
    aesGcmSupported: await isAesGcmSupported(),
    fieldTests: {
      encryption: false,
      encryption_algorithm: false
    },
    recommendedField: 'unknown'
  };
  
  try {
    // Test with 'encryption' field
    const test1 = await testEncryptionFormat({ test: 'test1' }, 'encryption');
    results.fieldTests.encryption = test1.success;
    
    // Test with 'encryption_algorithm' field
    const test2 = await testEncryptionFormat({ test: 'test2' }, 'encryption_algorithm');
    results.fieldTests.encryption_algorithm = test2.success;
    
    // Determine recommended field
    if (results.fieldTests.encryption_algorithm) {
      results.recommendedField = 'encryption_algorithm';
    } else if (results.fieldTests.encryption) {
      results.recommendedField = 'encryption';
    }
  } catch (error) {
    console.error('[TestCrypto] Error finding compatible encryption format:', error);
  }
  
  return results;
}
