// src/utils/keyStorage.ts
import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';

// --- Constants ---
const DB_NAME = 'AeroWhisperDB';
const DB_VERSION = 1;
const KEYPAIR_STORE_NAME = 'keypairs';
const USER_KEYPAIR_ID = 'userEd25519Keypair';
const PUBLIC_KEY_SIZE = 32;
const SECRET_KEY_SIZE = 64;
const DB_CONNECTION_TIMEOUT = 5000; // 5 seconds timeout for DB operations

// --- Error Types ---
export class KeyStorageError extends Error {
  constructor(message: string, public readonly code: string, public readonly cause?: Error) {
    super(message);
    this.name = 'KeyStorageError';
  }
}

// --- Type Definitions ---
export interface StoredKeypair {
  publicKey: Uint8Array;      // 32 bytes
  secretKey: Uint8Array;      // 64 bytes (raw secret key for nacl compatibility)
  publicKeyBase58: string;    // Base58 encoded public key for convenience
}

/**
 * Interface for an entry stored in the keypair store
 */
interface KeypairDBEntry extends StoredKeypair {
  id: string;                // Unique identifier for the keypair
  createdAt: number;         // Timestamp of when the keypair was created
  lastUsed?: number;         // Timestamp of when the keypair was last used
}

// --- Database Connection Cache ---
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Opens the IndexedDB database with connection pooling and timeout protection
 * @returns Promise resolving to the IDBDatabase instance
 */
function openDatabase(): Promise<IDBDatabase> {
  // Return existing connection if available
  if (dbPromise) {
    return dbPromise;
  }

  // Create a new connection with timeout
  dbPromise = Promise.race([
    new Promise<IDBDatabase>((resolve, reject) => {
      // Check for IndexedDB support
      if (typeof window === 'undefined' || !window.indexedDB) {
        dbPromise = null;
        return reject(new KeyStorageError(
          'IndexedDB is not supported in this environment.',
          'STORAGE_UNSUPPORTED'
        ));
      }

      // Open database
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('[KeyStorage] IndexedDB error:', request.error);
        dbPromise = null;
        reject(new KeyStorageError(
          `IndexedDB error: ${request.error?.message || 'Unknown error'}`,
          'DB_ERROR',
          request.error
        ));
      };

      request.onsuccess = (event) => {
        const db = request.result;
        
        // Add close handler to reset our cache
        db.onclose = () => {
          dbPromise = null;
        };
        
        // Add error handler
        db.onerror = (event) => {
          console.error('[KeyStorage] Database error:', event);
          dbPromise = null;
        };
        
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        console.log('[KeyStorage] Upgrading IndexedDB...');
        const db = request.result;
        
        // Create keypair store if it doesn't exist
        if (!db.objectStoreNames.contains(KEYPAIR_STORE_NAME)) {
          console.log(`[KeyStorage] Creating object store: ${KEYPAIR_STORE_NAME}`);
          const store = db.createObjectStore(KEYPAIR_STORE_NAME, { keyPath: 'id' });
          
          // Add useful indexes
          store.createIndex('by_publicKey', 'publicKeyBase58', { unique: true });
          store.createIndex('by_createdAt', 'createdAt', { unique: false });
        }
      };
    }),
    
    // Add timeout to prevent hanging connections
    new Promise<IDBDatabase>((_, reject) => {
      setTimeout(() => {
        dbPromise = null;
        reject(new KeyStorageError(
          `Database connection timed out after ${DB_CONNECTION_TIMEOUT}ms`,
          'DB_TIMEOUT'
        ));
      }, DB_CONNECTION_TIMEOUT);
    })
  ]).catch(error => {
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

/**
 * Gets an object store from the database for the specified transaction mode
 * @param db The IDBDatabase instance
 * @param mode Transaction mode ('readonly' or 'readwrite')
 * @returns The IDBObjectStore instance
 */
function getKeypairStore(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  try {
    const transaction = db.transaction(KEYPAIR_STORE_NAME, mode);
    return transaction.objectStore(KEYPAIR_STORE_NAME);
  } catch (error) {
    throw new KeyStorageError(
      `Failed to access keypair store: ${error instanceof Error ? error.message : String(error)}`,
      'STORE_ACCESS_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Executes a database operation with proper error handling and connection management
 * @param mode Transaction mode
 * @param operation Function that performs the database operation
 * @returns Promise resolving to the operation result
 */
async function executeDbOperation<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  let db: IDBDatabase | null = null;
  
  try {
    // Get database connection
    db = await openDatabase();
    const store = getKeypairStore(db, mode);
    
    // Execute the operation
    return await new Promise<T>((resolve, reject) => {
      const request = operation(store);
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(new KeyStorageError(
          `Database operation failed: ${request.error?.message || 'Unknown error'}`,
          'OPERATION_FAILED',
          request.error || undefined
        ));
      };
    });
  } catch (error) {
    // Propagate KeyStorageError instances
    if (error instanceof KeyStorageError) {
      throw error;
    }
    
    // Wrap other errors
    throw new KeyStorageError(
      `Keypair storage operation failed: ${error instanceof Error ? error.message : String(error)}`,
      'UNKNOWN_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Validates an Ed25519 keypair for correctness
 * @param keypair The keypair to validate
 * @throws KeyStorageError if the keypair is invalid
 */
function validateKeypair(keypair: { publicKey: Uint8Array; secretKey: Uint8Array }): void {
  // Check keypair existence
  if (!keypair) {
    throw new KeyStorageError('No keypair provided', 'INVALID_KEYPAIR');
  }
  
  // Check key components
  if (!keypair.publicKey || !keypair.secretKey) {
    throw new KeyStorageError('Keypair missing public or secret key', 'INVALID_KEYPAIR');
  }
  
  // Check key sizes
  if (keypair.publicKey.length !== PUBLIC_KEY_SIZE) {
    throw new KeyStorageError(
      `Invalid public key size: expected ${PUBLIC_KEY_SIZE} bytes, got ${keypair.publicKey.length}`,
      'INVALID_PUBLIC_KEY'
    );
  }
  
  if (keypair.secretKey.length !== SECRET_KEY_SIZE) {
    throw new KeyStorageError(
      `Invalid secret key size: expected ${SECRET_KEY_SIZE} bytes, got ${keypair.secretKey.length}`,
      'INVALID_SECRET_KEY'
    );
  }
  
  // Optional: Verify that the public key can be derived from the secret key
  // This is a more expensive check but ensures cryptographic validity
  try {
    // Extract public key from secret key (depends on nacl implementation details)
    const derivedPublicKey = keypair.secretKey.slice(32, 64);
    
    // Compare with provided public key
    if (!arrayEqual(derivedPublicKey, keypair.publicKey)) {
      throw new KeyStorageError(
        'Public key doesn\'t match the one derivable from secret key',
        'KEY_MISMATCH'
      );
    }
  } catch (error) {
    if (error instanceof KeyStorageError) throw error;
    
    throw new KeyStorageError(
      `Keypair validation failed: ${error instanceof Error ? error.message : String(error)}`,
      'VALIDATION_ERROR'
    );
  }
}

/**
 * Compares two Uint8Arrays for equality
 * @param a First array
 * @param b Second array
 * @returns True if arrays have identical content
 */
function arrayEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  
  // Use constant-time comparison to avoid timing attacks
  // This is important for cryptographic material
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Ensures a value is a Uint8Array
 * @param value The value to convert
 * @returns A Uint8Array
 */
function ensureUint8Array(value: Uint8Array | ArrayBuffer | number[]): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }
  
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  
  if (Array.isArray(value)) {
    return new Uint8Array(value);
  }
  
  throw new KeyStorageError(
    `Cannot convert value to Uint8Array: ${typeof value}`,
    'TYPE_ERROR'
  );
}

// --- Public API ---

/**
 * Stores a keypair securely in IndexedDB
 * @param keypair Object containing publicKey and secretKey as Uint8Arrays
 * @returns Promise resolving when the keypair is stored
 */
export async function storeKeypair(keypair: { publicKey: Uint8Array; secretKey: Uint8Array }): Promise<void> {
  validateKeypair(keypair);
  
  // Ensure keys are Uint8Array instances
  const publicKey = ensureUint8Array(keypair.publicKey);
  const secretKey = ensureUint8Array(keypair.secretKey);
  
  // Create Base58 representation of public key
  const publicKeyBase58 = bs58.encode(publicKey);
  
  // Create DB entry
  const dataToStore: KeypairDBEntry = {
    id: USER_KEYPAIR_ID,
    publicKey,
    secretKey,
    publicKeyBase58,
    createdAt: Date.now(),
    lastUsed: Date.now()
  };
  
  // Store in database
  await executeDbOperation('readwrite', (store) => {
    return store.put(dataToStore);
  });
  
  console.log('[KeyStorage] Keypair stored successfully.');
}

/**
 * Retrieves the stored Ed25519 keypair from IndexedDB
 * @returns Promise resolving to the keypair or null if not found
 */
export async function getStoredKeypair(): Promise<StoredKeypair | null> {
  try {
    // Get keypair from database
    const result = await executeDbOperation('readwrite', (store) => {
      return store.get(USER_KEYPAIR_ID);
    });
    
    // If not found, return null
    if (!result) {
      console.log('[KeyStorage] No keypair found in storage.');
      return null;
    }
    
    // Update last used timestamp
    await executeDbOperation('readwrite', (store) => {
      const updateData = { ...result, lastUsed: Date.now() };
      return store.put(updateData);
    });
    
    // Ensure correct types and format for return
    return {
      publicKey: ensureUint8Array(result.publicKey),
      secretKey: ensureUint8Array(result.secretKey),
      publicKeyBase58: result.publicKeyBase58 || bs58.encode(result.publicKey)
    };
  } catch (error) {
    console.error('[KeyStorage] Error retrieving keypair:', error);
    
    // Convert to KeyStorageError if needed
    if (error instanceof KeyStorageError) {
      throw error;
    }
    
    throw new KeyStorageError(
      `Failed to retrieve keypair: ${error instanceof Error ? error.message : String(error)}`,
      'RETRIEVAL_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Generates a new Ed25519 keypair and stores it securely
 * @returns Promise resolving to the generated and stored keypair
 */
export async function generateAndStoreKeypair(): Promise<StoredKeypair> {
  console.log('[KeyStorage] Generating new Ed25519 keypair...');
  
  try {
    // Generate new keypair
    const keypair = nacl.sign.keyPair();
    
    // Validate keypair
    validateKeypair(keypair);
    
    // Store keypair
    await storeKeypair(keypair);
    
    // Return the stored keypair
    return {
      publicKey: keypair.publicKey,
      secretKey: keypair.secretKey,
      publicKeyBase58: bs58.encode(keypair.publicKey)
    };
  } catch (error) {
    console.error('[KeyStorage] Error generating keypair:', error);
    
    if (error instanceof KeyStorageError) {
      throw error;
    }
    
    throw new KeyStorageError(
      `Failed to generate keypair: ${error instanceof Error ? error.message : String(error)}`,
      'GENERATION_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Deletes the stored user keypair
 * @returns Promise resolving when the keypair is deleted
 */
export async function deleteStoredKeypair(): Promise<void> {
  try {
    await executeDbOperation('readwrite', (store) => {
      return store.delete(USER_KEYPAIR_ID);
    });
    
    console.log('[KeyStorage] Keypair deleted successfully.');
  } catch (error) {
    console.error('[KeyStorage] Error deleting keypair:', error);
    
    if (error instanceof KeyStorageError) {
      throw error;
    }
    
    throw new KeyStorageError(
      `Failed to delete keypair: ${error instanceof Error ? error.message : String(error)}`,
      'DELETION_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Checks if a keypair exists in storage
 * @returns Promise resolving to true if keypair exists
 */
export async function keypairExists(): Promise<boolean> {
  try {
    const result = await executeDbOperation('readonly', (store) => {
      return store.get(USER_KEYPAIR_ID);
    });
    
    return !!result;
  } catch (error) {
    console.error('[KeyStorage] Error checking keypair existence:', error);
    return false;
  }
}

/**
 * Gets keypair details without exposing the secret key
 * @returns Promise resolving to public key information
 */
export async function getPublicKeyInfo(): Promise<{ publicKey: Uint8Array; publicKeyBase58: string } | null> {
  const keypair = await getStoredKeypair();
  
  if (!keypair) {
    return null;
  }
  
  return {
    publicKey: keypair.publicKey,
    publicKeyBase58: keypair.publicKeyBase58
  };
}

/**
 * Securely wipes a Uint8Array by overwriting with random data
 * Important for clearing sensitive key material from memory
 * @param array The array to wipe
 */
export function secureWipe(array: Uint8Array): void {
  if (!array || !(array instanceof Uint8Array)) return;
  
  // Overwrite with random data
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    // Fallback for non-browser environments
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  
  // Then zero out
  for (let i = 0; i < array.length; i++) {
    array[i] = 0;
  }
}

/**
 * Export keypair in a format suitable for backup/transfer
 * @returns Promise resolving to keypair data suitable for export
 */
export async function exportKeypair(): Promise<string | null> {
  try {
    const keypair = await getStoredKeypair();
    if (!keypair) return null;
    
    // Create exportable format
    const exportData = {
      version: 1,
      timestamp: Date.now(),
      publicKey: bs58.encode(keypair.publicKey),
      secretKey: bs58.encode(keypair.secretKey)
    };
    
    return JSON.stringify(exportData);
  } catch (error) {
    console.error('[KeyStorage] Error exporting keypair:', error);
    return null;
  }
}

/**
 * Import keypair from exported format
 * @param exportedData The exported keypair data
 * @returns Promise resolving to true if import succeeded
 */
export async function importKeypair(exportedData: string): Promise<boolean> {
  try {
    // Parse exported data
    const data = JSON.parse(exportedData);
    
    // Validate format
    if (!data.version || !data.publicKey || !data.secretKey) {
      throw new KeyStorageError('Invalid keypair export format', 'INVALID_EXPORT');
    }
    
    // Convert from Base58
    const publicKey = bs58.decode(data.publicKey);
    const secretKey = bs58.decode(data.secretKey);
    
    // Validate keypair
    validateKeypair({ publicKey, secretKey });
    
    // Store keypair
    await storeKeypair({ publicKey, secretKey });
    
    return true;
  } catch (error) {
    console.error('[KeyStorage] Error importing keypair:', error);
    
    if (error instanceof KeyStorageError) {
      throw error;
    }
    
    throw new KeyStorageError(
      `Failed to import keypair: ${error instanceof Error ? error.message : String(error)}`,
      'IMPORT_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}
