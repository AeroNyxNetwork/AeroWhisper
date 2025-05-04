// src/utils/authUtils.ts
import { socketManager } from './socketManager'; // If you implemented socketManager from earlier

/**
 * Constants for storage keys
 */
export const AUTH_STORAGE_KEYS = {
  DISPLAY_NAME: 'aero-display-name',
  AUTH_STATE: 'aero-auth-state',
  AUTH_STATE_BACKUP: 'aero-auth-state-backup',
  CURRENT_CHAT_ID: 'aero-current-chat-id',
  CHAT_ROOMS: 'aero-chat-rooms',
};

/**
 * Event name for logout notification
 */
export const LOGOUT_EVENT = 'aeronyx-logout';

/**
 * Dispatches a logout event to notify all components
 */
export const dispatchLogoutEvent = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LOGOUT_EVENT, { detail: { timestamp: Date.now() } }));
  }
};

/**
 * Cleans up all storage items related to authentication and chat
 */
export const cleanupStorageOnLogout = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    // Clear chat-related storage
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.CURRENT_CHAT_ID);
    localStorage.removeItem(AUTH_STORAGE_KEYS.CURRENT_CHAT_ID);
    
    // Clear auth state
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.AUTH_STATE);
    localStorage.removeItem(AUTH_STORAGE_KEYS.AUTH_STATE_BACKUP);
    
    // Clear chat rooms data
    localStorage.removeItem(AUTH_STORAGE_KEYS.CHAT_ROOMS);
  } catch (error) {
    console.warn('[AuthUtils] Error cleaning up storage during logout:', error);
  }
};

/**
 * Disconnects all active sockets
 */
export const disconnectAllSockets = async (): Promise<void> => {
  // If socketManager is available, use it to disconnect all sockets
  if (socketManager) {
    try {
      await socketManager.disconnectAllSockets();
    } catch (error) {
      console.error('[AuthUtils] Error disconnecting sockets:', error);
    }
    return;
  }
  
  // Fallback: Use the logout event to trigger socket disconnection in components
  dispatchLogoutEvent();
};

/**
 * Performs complete logout cleanup
 * This handles all storage, socket, and event dispatching in one place
 */
export const performLogoutCleanup = async (): Promise<void> => {
  // Step 1: Disconnect all active sockets
  await disconnectAllSockets();
  
  // Step 2: Clean up storage items
  cleanupStorageOnLogout();
  
  // Step 3: Dispatch logout event to notify all components
  dispatchLogoutEvent();
  
  console.log('[AuthUtils] Logout cleanup completed');
};
