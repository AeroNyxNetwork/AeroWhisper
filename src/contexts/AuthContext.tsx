// src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useMemo } from 'react';
import {
  StoredKeypair,
  getStoredKeypair,
  generateAndStoreKeypair,
  keypairExists,
  deleteStoredKeypair,
  getPublicKeyInfo,
  KeyStorageError
} from '../utils/keyStorage';

// --- Constants ---
const DISPLAY_NAME_KEY = 'aero-display-name';
const AUTH_STATE_KEY = 'aero-auth-state';
const REVALIDATION_INTERVAL = 1000 * 60 * 60; // Revalidate auth every hour

// --- Types ---
export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated' | 'error';

export interface User {
  id: string;
  publicKey: string;
  displayName: string;
  createdAt?: number;
  lastLogin?: number;
}

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: Error | null;
  lastValidated?: number;
}

interface AuthContextType {
  // Core state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  authStatus: AuthStatus;
  
  // Actions
  login: () => Promise<User | null>;
  logout: () => Promise<void>;
  generateNewKeypair: () => Promise<User | null>;
  updateDisplayName: (name: string) => Promise<void>;
  validateAuth: () => Promise<boolean>;
}

// --- Helper Functions ---

/**
 * Converts a StoredKeypair to a User object
 */
const createUserFromKeypair = (keypair: StoredKeypair, existingUser?: Partial<User>): User => {
  const now = Date.now();
  const displayName = localStorage.getItem(DISPLAY_NAME_KEY) || 
                      existingUser?.displayName || 
                      `User_${keypair.publicKeyBase58.substring(0, 6)}`;
  
  return {
    id: keypair.publicKeyBase58,
    publicKey: keypair.publicKeyBase58,
    displayName,
    createdAt: existingUser?.createdAt || now,
    lastLogin: now
  };
};

/**
 * Saves authentication state to sessionStorage for quick restoration
 */
const persistAuthState = (state: AuthState): void => {
  try {
    sessionStorage.setItem(AUTH_STATE_KEY, JSON.stringify({
      status: state.status,
      user: state.user,
      lastValidated: state.lastValidated
    }));
  } catch (error) {
    console.warn('[AuthContext] Failed to persist auth state:', error);
  }
};

/**
 * Loads authentication state from sessionStorage
 */
const loadPersistedAuthState = (): Partial<AuthState> | null => {
  try {
    const storedState = sessionStorage.getItem(AUTH_STATE_KEY);
    if (!storedState) return null;
    
    return JSON.parse(storedState);
  } catch (error) {
    console.warn('[AuthContext] Failed to load persisted auth state:', error);
    return null;
  }
};

// --- Context Creation ---
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// --- Provider Component ---
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Core authentication state
  const [authState, setAuthState] = useState<AuthState>(() => {
    // Try to restore state from session storage during initialization
    const persistedState = loadPersistedAuthState();
    
    // Return restored state or initial state
    return {
      status: persistedState?.status || 'initializing',
      user: persistedState?.user || null,
      error: null,
      lastValidated: persistedState?.lastValidated || 0
    };
  });
  
  // Setup derived state for easier access
  const isAuthenticated = authState.status === 'authenticated';
  const isLoading = authState.status === 'initializing';
  
  // Helper to update state and persist changes
  const updateAuthState = useCallback((newState: Partial<AuthState>) => {
    setAuthState(prevState => {
      const updatedState = { ...prevState, ...newState };
      
      // Don't persist error states
      if (newState.status && newState.status !== 'error') {
        persistAuthState(updatedState);
      }
      
      return updatedState;
    });
  }, []);
  
  /**
   * Validates the current authentication state
   * Returns true if authenticated, false otherwise
   */
  const validateAuth = useCallback(async (): Promise<boolean> => {
    try {
      // Skip validation if we've validated recently
      const now = Date.now();
      if (
        authState.status === 'authenticated' && 
        authState.lastValidated && 
        now - authState.lastValidated < REVALIDATION_INTERVAL
      ) {
        return true;
      }
      
      // Check if keypair exists
      const exists = await keypairExists();
      if (!exists) {
        updateAuthState({ 
          status: 'unauthenticated', 
          user: null,
          lastValidated: now
        });
        return false;
      }
      
      // Verify we can access the keypair
      const publicKeyInfo = await getPublicKeyInfo();
      if (!publicKeyInfo) {
        updateAuthState({ 
          status: 'unauthenticated', 
          user: null,
          lastValidated: now
        });
        return false;
      }
      
      // If we already have a user with matching public key, just update lastValidated
      if (authState.user?.publicKey === publicKeyInfo.publicKeyBase58) {
        updateAuthState({ 
          status: 'authenticated',
          lastValidated: now
        });
        return true;
      }
      
      // Otherwise, need to get full keypair to create user object
      const keypair = await getStoredKeypair();
      if (!keypair) {
        updateAuthState({ 
          status: 'unauthenticated', 
          user: null,
          lastValidated: now
        });
        return false;
      }
      
      // Create user from keypair, preserving existing user data if possible
      const user = createUserFromKeypair(keypair, authState.user || undefined);
      updateAuthState({ 
        status: 'authenticated', 
        user,
        lastValidated: now
      });
      return true;
      
    } catch (error) {
      console.error('[AuthContext] Error validating auth state:', error);
      updateAuthState({ 
        status: 'error',
        error: error instanceof Error ? error : new Error('Unknown validation error')
      });
      return false;
    }
  }, [authState.lastValidated, authState.status, authState.user, updateAuthState]);
  
  /**
   * Initializes authentication by loading/creating a keypair
   */
  const login = useCallback(async (): Promise<User | null> => {
    console.log('[AuthContext] Initializing authentication...');
    updateAuthState({ 
      status: 'initializing',
      error: null
    });
    
    try {
      // First check if keypair exists
      const exists = await keypairExists();
      
      let keypair: StoredKeypair;
      if (exists) {
        console.log('[AuthContext] Keypair exists, retrieving...');
        const existingKeypair = await getStoredKeypair();
        if (!existingKeypair) {
          throw new Error('Failed to retrieve existing keypair');
        }
        keypair = existingKeypair;
      } else {
        console.log('[AuthContext] No keypair found, generating new one...');
        keypair = await generateAndStoreKeypair();
      }
      
      // Create user object and update state
      const user = createUserFromKeypair(keypair, authState.user);
      updateAuthState({
        status: 'authenticated',
        user,
        error: null,
        lastValidated: Date.now()
      });
      
      return user;
    } catch (error) {
      console.error('[AuthContext] Authentication failed:', error);
      updateAuthState({ 
        status: 'error',
        user: null,
        error: error instanceof Error ? error : new Error('Unknown authentication error')
      });
      return null;
    }
  }, [authState.user, updateAuthState]);
  
  /**
   * Logs out the current user by deleting their keypair
   */
  const logout = useCallback(async (): Promise<void> => {
    console.log('[AuthContext] Logging out...');
    updateAuthState({ 
      status: 'initializing',
      error: null
    });
    
    try {
      // Delete the keypair
      await deleteStoredKeypair();
      
      // Clear auth state
      updateAuthState({
        status: 'unauthenticated',
        user: null,
        lastValidated: Date.now()
      });
      
      // Clear any local storage items
      localStorage.removeItem(DISPLAY_NAME_KEY);
      sessionStorage.removeItem(AUTH_STATE_KEY);
      
    } catch (error) {
      console.error('[AuthContext] Logout failed:', error);
      
      // Even on error, reset the auth state
      updateAuthState({
        status: 'unauthenticated',
        user: null,
        error: error instanceof Error ? error : new Error('Unknown logout error'),
        lastValidated: Date.now()
      });
    }
  }, [updateAuthState]);
  
  /**
   * Generates a new keypair, replacing any existing one
   */
  const generateNewKeypair = useCallback(async (): Promise<User | null> => {
    console.log('[AuthContext] Generating new keypair...');
    updateAuthState({ 
      status: 'initializing',
      error: null
    });
    
    try {
      // Generate and store a new keypair
      const keypair = await generateAndStoreKeypair();
      
      // Create user with the new keypair
      const user = createUserFromKeypair(keypair);
      updateAuthState({
        status: 'authenticated',
        user,
        error: null,
        lastValidated: Date.now()
      });
      
      return user;
    } catch (error) {
      console.error('[AuthContext] Failed to generate new keypair:', error);
      updateAuthState({
        status: 'error',
        error: error instanceof Error ? error : new Error('Failed to generate new keypair')
      });
      return null;
    }
  }, [updateAuthState]);
  
  /**
   * Updates the user's display name
   */
  const updateDisplayName = useCallback(async (name: string): Promise<void> => {
    if (!authState.user) {
      throw new Error('Cannot update display name: user not authenticated');
    }
    
    // Validate name
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Display name cannot be empty');
    }
    
    // Store in localStorage
    localStorage.setItem(DISPLAY_NAME_KEY, trimmedName);
    
    // Update user in state
    updateAuthState({
      user: {
        ...authState.user,
        displayName: trimmedName
      }
    });
  }, [authState.user, updateAuthState]);
  
  // Initialize auth on mount
  useEffect(() => {
    // Only run initialization if we're not already authenticated or initializing
    if (authState.status !== 'authenticated' && authState.status !== 'initializing') {
      login();
    } else if (authState.status === 'authenticated') {
      // If already authenticated, validate the auth state
      validateAuth();
    }
  }, [authState.status, login, validateAuth]);
  
  // Set up periodic revalidation when authenticated
  useEffect(() => {
    if (authState.status !== 'authenticated') return;
    
    const interval = setInterval(() => {
      validateAuth().catch(error => {
        console.error('[AuthContext] Periodic validation failed:', error);
      });
    }, REVALIDATION_INTERVAL);
    
    return () => clearInterval(interval);
  }, [authState.status, validateAuth]);
  
  // Memoize the context value to prevent unnecessary renders
  const contextValue = useMemo(() => ({
    user: authState.user,
    isAuthenticated,
    isLoading,
    error: authState.error,
    authStatus: authState.status,
    login,
    logout,
    generateNewKeypair,
    updateDisplayName,
    validateAuth
  }), [
    authState.error,
    authState.status,
    authState.user,
    generateNewKeypair,
    isAuthenticated,
    isLoading,
    login,
    logout,
    updateDisplayName,
    validateAuth
  ]);
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
