// src/utils/keyStorageFallback.ts
/**
 * Fallback storage utility for when IndexedDB fails
 * This provides a localStorage-based alternative
 */

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
export const storeInLocalStorage = (key: string, data: any): boolean => {
  if (!isLocalStorageAvailable()) return false;
  
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(STORAGE_PREFIX + key, serialized);
    return true;
  } catch (e) {
    console.error('[KeyStorageFallback] Failed to store in localStorage:', e);
    return false;
  }
};

// Retrieve data from localStorage with error handling
export const getFromLocalStorage = (key: string): any | null => {
  if (!isLocalStorageAvailable()) return null;
  
  try {
    const serialized = localStorage.getItem(STORAGE_PREFIX + key);
    if (!serialized) return null;
    return JSON.parse(serialized);
  } catch (e) {
    console.error('[KeyStorageFallback] Failed to retrieve from localStorage:', e);
    return null;
  }
};

// Check if a key exists in localStorage
export const existsInLocalStorage = (key: string): boolean => {
  if (!isLocalStorageAvailable()) return false;
  return localStorage.getItem(STORAGE_PREFIX + key) !== null;
};

// Remove data from localStorage
export const removeFromLocalStorage = (key: string): boolean => {
  if (!isLocalStorageAvailable()) return false;
  
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
    return true;
  } catch (e) {
    console.error('[KeyStorageFallback] Failed to remove from localStorage:', e);
    return false;
  }
};
