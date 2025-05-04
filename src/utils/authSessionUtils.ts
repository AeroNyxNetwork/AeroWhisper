// src/utils/authSessionUtils.ts

/**
 * Constants for authentication and session storage
 */
export const SESSION_KEYS = {
  // Auth related
  AUTH_STATE: 'aero-auth-state',
  AUTH_STATE_BACKUP: 'aero-auth-state-backup',
  DISPLAY_NAME: 'aero-display-name',
  
  // Chat related
  CURRENT_CHAT_ID: 'aero-current-chat-id',
  CHAT_ROOMS: 'aero-chat-rooms',
  
  // Other persistent settings
  USER_PREFERENCES: 'aero-user-preferences'
};

/**
 * The standard event name used for signaling logout
 * This needs to be consistent across the application
 */
export const LOGOUT_EVENT_NAME = 'aeronyx-logout';

/**
 * Dispatches a logout event to notify all components about logout
 * @param reason Optional reason for the logout
 */
export function dispatchLogoutEvent(reason?: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    window.dispatchEvent(new CustomEvent(LOGOUT_EVENT_NAME, { 
      detail: { 
        timestamp: Date.now(),
        reason
      } 
    }));
    console.log('[AuthSessionUtils] Dispatched logout event:', reason || 'No reason specified');
  } catch (error) {
    console.error('[AuthSessionUtils] Failed to dispatch logout event:', error);
  }
}

/**
 * Clears all auth and session-related data from storage
 */
export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  
  try {
    console.log('[AuthSessionUtils] Clearing auth session data');
    
    // Auth state in session storage (primary)
    sessionStorage.removeItem(SESSION_KEYS.AUTH_STATE);
    
    // Auth state in local storage (backup)
    localStorage.removeItem(SESSION_KEYS.AUTH_STATE_BACKUP);
    
    // Chat-related data that should be cleared on logout
    sessionStorage.removeItem(SESSION_KEYS.CURRENT_CHAT_ID);
    localStorage.removeItem(SESSION_KEYS.CURRENT_CHAT_ID);
    localStorage.removeItem(SESSION_KEYS.CHAT_ROOMS);
    
    // Preserve display name since it's user-specific preference
    // We don't remove it on logout to maintain user convenience
    
    console.log('[AuthSessionUtils] Auth session data cleared successfully');
  } catch (error) {
    console.error('[AuthSessionUtils] Error clearing auth session data:', error);
  }
}

/**
 * Performs a complete logout sequence
 * @param options Configuration for the logout process
 */
export async function performLogout(options?: {
  clearUserData?: boolean; // Whether to clear user preferences
  reason?: string;         // Reason for logout
}): Promise<void> {
  const { clearUserData = false, reason } = options || {};
  console.log('[AuthSessionUtils] Performing logout sequence', options);
  
  try {
    // Step 1: Clear authentication session data
    clearAuthSession();
    
    // Step 2: Optionally clear user preferences if requested
    if (clearUserData) {
      console.log('[AuthSessionUtils] Clearing user preferences');
      localStorage.removeItem(SESSION_KEYS.USER_PREFERENCES);
      localStorage.removeItem(SESSION_KEYS.DISPLAY_NAME);
    }
    
    // Step 3: Dispatch the logout event to notify all components
    dispatchLogoutEvent(reason);
    
    console.log('[AuthSessionUtils] Logout sequence completed successfully');
  } catch (error) {
    console.error('[AuthSessionUtils] Error during logout sequence:', error);
    
    // Despite errors, still try to dispatch the event as a fallback
    try {
      dispatchLogoutEvent('error_during_logout');
    } catch {}
    
    // Re-throw to allow calling code to handle the error if needed
    throw error;
  }
}

/**
 * Verifies if the current auth session is valid
 * @returns True if the session appears valid, false otherwise
 */
export function isAuthSessionValid(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    // Check session storage (primary location)
    const sessionData = sessionStorage.getItem(SESSION_KEYS.AUTH_STATE);
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      
      // Basic validation: check if we have user data and authenticated status
      if (parsed && parsed.status === 'authenticated' && parsed.user) {
        return true;
      }
    }
    
    // If not in session storage, check localStorage (backup)
    const backupData = localStorage.getItem(SESSION_KEYS.AUTH_STATE_BACKUP);
    if (backupData) {
      const parsed = JSON.parse(backupData);
      
      // Basic validation for backup data
      if (parsed && parsed.status === 'authenticated' && parsed.user) {
        // If valid data found in backup but not in session, restore it
        sessionStorage.setItem(SESSION_KEYS.AUTH_STATE, backupData);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('[AuthSessionUtils] Error checking auth session validity:', error);
    return false;
  }
}
