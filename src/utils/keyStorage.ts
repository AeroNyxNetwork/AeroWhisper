// src/utils/keyStorage.ts
import { generateKeyPair as generateEd25519KeyPair } from '@noble/ed25519';
import { encode, decode } from 'bs58';

// Type definitions
export interface StoredKeypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  publicKeyBase58: string;
}

export class KeyStorageError extends Error {
  cause?: Error;
  
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'KeyStorageError';
    this.cause = cause;
  }
}

// Constants
const DB_NAME = 'AeroNyxKeyStore';
const DB_VERSION = 1;
const KEYPAIR_STORE = 'keypairs';
const KEYPAIR_KEY = 'userKeypair';

// LocalStorage fallback constants
const STORAGE_PREFIX = 'aero-keys-';

// Check if localStorage is available
const isLocalStorageAvailable = (): boolean => {
  try {
    const test = 'test';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

// Store data in localStorage with error handling
const storeInLocalStorage = (key: string, data: any): boolean => {
  if (!isLocalStorageAvailable()) return false;
  
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(STORAGE_PREFIX + key, serialized);
    return true;
  } catch (e) {
    console.error('[KeyStorage] Failed to store in localStorage:', e);
    return false;
  }
};

// Retrieve data from localStorage with error handling
const getFromLocalStorage = (key: string): any | null => {
  if (!isLocalStorageAvailable()) return null;
  
  try {
    const serialized = localStorage.getItem(STORAGE_PREFIX + key);
    if (!serialized) return null;
    return JSON.parse(serialized);
  } catch (e) {
    console.error('[KeyStorage] Failed to retrieve from localStorage:', e);
    return null;
  }
};

// Check if a key exists in localStorage
const existsInLocalStorage = (key: string): boolean => {
  if (!isLocalStorageAvailable()) return false;
  return localStorage.getItem(STORAGE_PREFIX + key) !== null;
};

// Remove data from localStorage
const removeFromLocalStorage = (key: string): boolean => {
  if (!isLocalStorageAvailable()) return false;
  
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
    return true;
  } catch (e) {
    console.error('[KeyStorage] Failed to remove from localStorage:', e);
    return false;
  }
};

// Helper to open the database
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = (event) => {
        const error = new KeyStorageError('IndexedDB error: ' + (request.error?.message || 'Unknown error'), request.error || undefined);
        console.error('[KeyStorage] IndexedDB error:', request.error);
        reject(error);
      };
      
      request.onupgradeneeded = (event) => {
        const db = request.result;
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(KEYPAIR_STORE)) {
          db.createObjectStore(KEYPAIR_STORE);
        }
      };
      
      request.onsuccess = (event) => {
        resolve(request.result);
      };
    } catch (error) {
      const keyStorageError = new KeyStorageError('Failed to open IndexedDB', error instanceof Error ? error : undefined);
      console.error('[KeyStorage] Error opening IndexedDB:', error);
      reject(keyStorageError);
    }
  });
};

// Helper to execute database operations with error handling
const executeDbOperation = <T>(operation: (db: IDBDatabase) => IDBRequest<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    openDatabase()
      .then(db => {
        try {
          const request = operation(db);
          
          request.onsuccess = () => {
            db.close();
            resolve(request.result);
          };
          
          request.onerror = () => {
            db.close();
            const error = new KeyStorageError('IndexedDB error: ' + (request.error?.message || 'Unknown error'), request.error || undefined);
            console.error('[KeyStorage] IndexedDB error:', request.error);
            reject(error);
          };
        } catch (error) {
          db.close();
          const keyStorageError = new KeyStorageError('Error executing database operation', error instanceof Error ? error : undefined);
          console.error('[KeyStorage] Error in DB operation:', error);
          reject(keyStorageError);
        }
      })
      .catch(reject);
  });
};

// Convert keypair to a serializable format
const keypairToSerializable = (keypair: StoredKeypair): any => {
  return {
    publicKey: Array.from(keypair.publicKey),
    secretKey: Array.from(keypair.secretKey),
    publicKeyBase58: keypair.publicKeyBase58
  };
};

// Convert from serializable format back to a keypair
const serializableToKeypair = (serializable: any): StoredKeypair => {
  return {
    publicKey: new Uint8Array(serializable.publicKey),
    secretKey: new Uint8Array(serializable.secretKey),
    publicKeyBase58: serializable.publicKeyBase58
  };
};

/**
 * Check if a keypair exists in storage
 */
export const keypairExists = async (): Promise<boolean> => {
  try {
    // Try IndexedDB first
    return await executeDbOperation(db => {
      const transaction = db.transaction(KEYPAIR_STORE, 'readonly');
      const store = transaction.objectStore(KEYPAIR_STORE);
      return store.getKey(KEYPAIR_KEY);
    }).then(result => !!result);
  } catch (error) {
    console.warn('[KeyStorage] Error checking keypair existence:', error);
    
    // Fall back to localStorage
    return existsInLocalStorage(KEYPAIR_KEY);
  }
};

/**
 * Get the stored keypair
 */
export const getStoredKeypair = async (): Promise<StoredKeypair | null> => {
  try {
    // Try IndexedDB first
    const result = await executeDbOperation(db => {
      const transaction = db.transaction(KEYPAIR_STORE, 'readonly');
      const store = transaction.objectStore(KEYPAIR_STORE);
      return store.get(KEYPAIR_KEY);
    });
    
    if (!result) {
      return null;
    }
    
    return serializableToKeypair(result);
  } catch (error) {
    console.warn('[KeyStorage] Error retrieving keypair, falling back to localStorage:', error);
    
    // Fall back to localStorage
    const storedKeypair = getFromLocalStorage(KEYPAIR_KEY);
    return storedKeypair ? serializableToKeypair(storedKeypair) : null;
  }
};

/**
 * Store a keypair
 */
export const storeKeypair = async (keypair: StoredKeypair): Promise<void> => {
  try {
    // Try IndexedDB first
    const serializable = keypairToSerializable(keypair);
    
    await executeDbOperation(db => {
      const transaction = db.transaction(KEYPAIR_STORE, 'readwrite');
      const store = transaction.objectStore(KEYPAIR_STORE);
      return store.put(serializable, KEYPAIR_KEY);
    });
  } catch (error) {
    console.warn('[KeyStorage] Error storing keypair, falling back to localStorage:', error);
    
    // Fall back to localStorage
    const success = storeInLocalStorage(KEYPAIR_KEY, keypairToSerializable(keypair));
    if (!success) {
      throw new KeyStorageError('Failed to store keypair in fallback storage');
    }
  }
};

/**
 * Delete the stored keypair
 */
export const deleteStoredKeypair = async (): Promise<void> => {
  try {
    // Try IndexedDB first
    await executeDbOperation(db => {
      const transaction = db.transaction(KEYPAIR_STORE, 'readwrite');
      const store = transaction.objectStore(KEYPAIR_STORE);
      return store.delete(KEYPAIR_KEY);
    });
  } catch (error) {
    console.warn('[KeyStorage] Error deleting keypair, falling back to localStorage:', error);
    
    // Fall back to localStorage
    removeFromLocalStorage(KEYPAIR_KEY);
  }
};

/**
 * Generate a new keypair for the user
 */
export const generateKeyPair = async (): Promise<StoredKeypair> => {
  try {
    // Generate the keypair
    const privateKey = await generateEd25519KeyPair();
    const publicKey = await privateKey.getPublicKey();
    const publicKeyBase58 = encode(publicKey);
    
    return {
      publicKey,
      secretKey: privateKey.secretKey,
      publicKeyBase58
    };
  } catch (error) {
    console.error('[KeyStorage] Error generating keypair:', error);
    throw new KeyStorageError('Failed to generate keypair', error instanceof Error ? error : undefined);
  }
};

/**
 * Generate and store a new keypair for the user
 */
export const generateAndStoreKeypair = async (): Promise<StoredKeypair> => {
  try {
    const keypair = await generateKeyPair();
    await storeKeypair(keypair);
    return keypair;
  } catch (error) {
    console.error('[KeyStorage] Error generating keypair:', error);
    throw new KeyStorageError('Error generating keypair', error instanceof Error ? error : undefined);
  }
};

/**
 * Get public key info without exposing the private key
 */
export const getPublicKeyInfo = async (): Promise<{ publicKeyBase58: string } | null> => {
  const keypair = await getStoredKeypair();
  if (!keypair) return null;
  
  return {
    publicKeyBase58: keypair.publicKeyBase58
  };
};
