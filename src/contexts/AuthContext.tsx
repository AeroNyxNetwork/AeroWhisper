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
import { useSolanaWallet } from '../hooks/useSolanaWallet';
import { SolanaWalletType } from '../utils/solanaWalletDetector';

// --- Constants ---
const DISPLAY_NAME_KEY = 'aero-display-name';
const AUTH_STATE_KEY = 'aero-auth-state';
const REVALIDATION_INTERVAL = 1000 * 60 * 60; // Revalidate auth every hour
const AUTH_TIMEOUT = 30000; // 30 second timeout for auth operations

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
  
  // Solana wallet integration
  solanaWallet: {
    hasWallet: boolean;
    walletType: SolanaWalletType;
    walletName: string;
    isConnected: boolean;
    isDetecting: boolean;
  };
  connectWallet: () => Promise<User | null>;
  disconnectWallet: () => Promise<void>;
  authMethod: 'keypair' | 'wallet' | 'none';
}

// --- Helper Functions ---

/**
 * Creates a timeout promise to prevent indefinite waiting
 */
const createTimeout = (ms: number, message: string): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${message}`)), ms);
  });
}

/**
 * Converts a StoredKeypair to a User object
 */
const createUserFromKeypair = (keypair: StoredKeypair, existingUser?: Partial<User> | null): User => {
  const now = Date.now();
  let displayName;
  
  try {
    displayName = localStorage.getItem(DISPLAY_NAME_KEY) || 
                  existingUser?.displayName || 
                  `User_${keypair.publicKeyBase58.substring(0, 6)}`;
  } catch (error) {
    console.warn('[AuthContext] Failed to get display name from localStorage:', error);
    displayName = existingUser?.displayName || `User_${keypair.publicKeyBase58.substring(0, 6)}`;
  }
  
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
    // Clear potentially corrupted auth state
    try {
      sessionStorage.removeItem(AUTH_STATE_KEY);
    } catch {}
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
  console.log('[AuthContext] AuthProvider initializing');
  
  // Core authentication state
  const [authState, setAuthState] = useState<AuthState>(() => {
    // Try to restore state from session storage during initialization
    try {
      const persistedState = loadPersistedAuthState();
      console.log('[AuthContext] Loaded persisted state:', 
        persistedState ? 
        { status: persistedState.status, hasUser: !!persistedState.user } :
        'none');
      
      // Return restored state or initial state
      return {
        status: persistedState?.status || 'initializing',
        user: persistedState?.user || null,
        error: null,
        lastValidated: persistedState?.lastValidated || 0
      };
    } catch (error) {
      console.error('[AuthContext] Error in initial state setup:', error);
      return {
        status: 'initializing',
        user: null,
        error: null,
        lastValidated: 0
      };
    }
  });
  
  // Add Solana wallet integration
  const solanaWallet = useSolanaWallet();
  const [authMethod, setAuthMethod] = useState<'keypair' | 'wallet' | 'none'>('none');
  
  // Setup derived state for easier access
  const isAuthenticated = authState.status === 'authenticated';
  const isLoading = authState.status === 'initializing';
  
  // Helper to update state and persist changes
  const updateAuthState = useCallback((newState: Partial<AuthState>) => {
    console.log('[AuthContext] Updating auth state:', newState);
    
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
    console.log('[AuthContext] Validating auth...');
    
    try {
      // Skip validation if we've validated recently
      const now = Date.now();
      if (
        authState.status === 'authenticated' && 
        authState.lastValidated && 
        now - authState.lastValidated < REVALIDATION_INTERVAL
      ) {
        console.log('[AuthContext] Skipping validation, recently validated');
        return true;
      }
      
      const validationResult = await Promise.race([
        (async () => {
          try {
            // If using wallet auth, check wallet connection
            if (authMethod === 'wallet') {
              if (!solanaWallet.isConnected || !solanaWallet.publicKey) {
                console.log('[AuthContext] Wallet disconnected, setting unauthenticated');
                updateAuthState({ 
                  status: 'unauthenticated', 
                  user: null,
                  lastValidated: now
                });
                return false;
              }
              
              // Wallet still connected, update last validated
              updateAuthState({
                lastValidated: now
              });
              return true;
            }
            
            // Otherwise, check keypair auth
            // Check if keypair exists
            console.log('[AuthContext] Checking if keypair exists');
            const exists = await keypairExists();
            
            if (!exists) {
              console.log('[AuthContext] No keypair exists');
              updateAuthState({ 
                status: 'unauthenticated', 
                user: null,
                lastValidated: now
              });
              return false;
            }
            
            // Verify we can access the keypair
            console.log('[AuthContext] Getting public key info');
            const publicKeyInfo = await getPublicKeyInfo();
            
            if (!publicKeyInfo) {
              console.log('[AuthContext] Failed to get public key info');
              updateAuthState({ 
                status: 'unauthenticated', 
                user: null,
                lastValidated: now
              });
              return false;
            }
            
            // If we already have a user with matching public key, just update lastValidated
            if (authState.user?.publicKey === publicKeyInfo.publicKeyBase58) {
              console.log('[AuthContext] Existing user validated');
              updateAuthState({ 
                status: 'authenticated',
                lastValidated: now
              });
              return true;
            }
            
            // Otherwise, need to get full keypair to create user object
            console.log('[AuthContext] Getting full keypair');
            const keypair = await getStoredKeypair();
            
            if (!keypair) {
              console.log('[AuthContext] Failed to get keypair');
              updateAuthState({ 
                status: 'unauthenticated', 
                user: null,
                lastValidated: now
              });
              return false;
            }
            
            // Create user from keypair, preserving existing user data if possible
            console.log('[AuthContext] Creating user from keypair');
            const user = createUserFromKeypair(keypair, authState.user || undefined);
            updateAuthState({ 
              status: 'authenticated', 
              user,
              lastValidated: now
            });
            return true;
          } catch (error) {
            console.error('[AuthContext] Error in validation process:', error);
            throw error;
          }
        })(),
        createTimeout(AUTH_TIMEOUT, 'Auth validation timeout')
      ]);
      
      return validationResult;
    } catch (error) {
      console.error('[AuthContext] Error validating auth state:', error);
      updateAuthState({ 
        status: 'error',
        error: error instanceof Error ? error : new Error('Unknown validation error')
      });
      
      // After setting error state, transition to unauthenticated
      setTimeout(() => {
        updateAuthState({
          status: 'unauthenticated',
          error: null
        });
      }, 3000);
      
      return false;
    }
  }, [authState.lastValidated, authState.status, authState.user, authMethod, solanaWallet.isConnected, solanaWallet.publicKey, updateAuthState]);
  
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
      const loginResult = await Promise.race([
        (async () => {
          try {
            // First check if keypair exists
            console.log('[AuthContext] Checking for existing keypair');
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
            console.log('[AuthContext] Creating user from keypair');
            const user = createUserFromKeypair(keypair, authState.user || undefined);
            updateAuthState({
              status: 'authenticated',
              user,
              error: null,
              lastValidated: Date.now()
            });
            
            // Set auth method
            setAuthMethod('keypair');
            
            return user;
          } catch (error) {
            console.error('[AuthContext] Error in login process:', error);
            throw error;
          }
        })(),
        createTimeout(AUTH_TIMEOUT, 'Auth login timeout')
      ]);
      
      return loginResult;
    } catch (error) {
      console.error('[AuthContext] Authentication failed:', error);
      updateAuthState({ 
        status: 'error',
        user: null,
        error: error instanceof Error ? error : new Error('Unknown authentication error')
      });
      
      // After setting error state, transition to unauthenticated
      setTimeout(() => {
        updateAuthState({
          status: 'unauthenticated',
          error: null
        });
      }, 3000);
      
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
      await Promise.race([
        (async () => {
          try {
            // If using wallet auth, disconnect wallet
            if (authMethod === 'wallet') {
              if (solanaWallet.isConnected) {
                await solanaWallet.disconnect();
              }
            } else {
              // Delete the keypair
              await deleteStoredKeypair();
            }
            
            // Clear auth state
            updateAuthState({
              status: 'unauthenticated',
              user: null,
              lastValidated: Date.now()
            });
            
            // Clear any local storage items
            try {
              localStorage.removeItem(DISPLAY_NAME_KEY);
              sessionStorage.removeItem(AUTH_STATE_KEY);
            } catch (e) {
              console.warn('[AuthContext] Error clearing storage during logout:', e);
            }
            
            // Reset auth method
            setAuthMethod('none');
          } catch (error) {
            console.error('[AuthContext] Error in logout process:', error);
            throw error;
          }
        })(),
        createTimeout(AUTH_TIMEOUT, 'Auth logout timeout')
      ]);
    } catch (error) {
      console.error('[AuthContext] Logout failed:', error);
      
      // Even on error, reset the auth state
      updateAuthState({
        status: 'unauthenticated',
        user: null,
        error: error instanceof Error ? error : new Error('Unknown logout error'),
        lastValidated: Date.now()
      });
      
      setAuthMethod('none');
    }
  }, [authMethod, solanaWallet, updateAuthState]);
  
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
      const result = await Promise.race([
        (async () => {
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
            
            // Set auth method
            setAuthMethod('keypair');
            
            return user;
          } catch (error) {
            console.error('[AuthContext] Error in keypair generation:', error);
            throw error;
          }
        })(),
        createTimeout(AUTH_TIMEOUT, 'Keypair generation timeout')
      ]);
      
      return result;
    } catch (error) {
      console.error('[AuthContext] Failed to generate new keypair:', error);
      updateAuthState({
        status: 'error',
        error: error instanceof Error ? error : new Error('Failed to generate new keypair')
      });
      
      // After setting error state, transition to unauthenticated
      setTimeout(() => {
        updateAuthState({
          status: 'unauthenticated',
          error: null
        });
      }, 3000);
      
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
    
    try {
      // Store in localStorage
      localStorage.setItem(DISPLAY_NAME_KEY, trimmedName);
      
      // Update user in state
      updateAuthState({
        user: {
          ...authState.user,
          displayName: trimmedName
        }
      });
    } catch (error) {
      console.error('[AuthContext] Failed to update display name:', error);
      throw error;
    }
  }, [authState.user, updateAuthState]);
  
  /**
   * Connect to Solana wallet
   */
  const connectWallet = useCallback(async (): Promise<User | null> => {
    console.log('[AuthContext] Connecting to Solana wallet...');
    updateAuthState({ 
      status: 'initializing',
      error: null
    });
    
    try {
      // Attempt to connect to wallet
      const publicKey = await solanaWallet.connect();
      
      if (!publicKey) {
        throw new Error('Failed to get public key from wallet');
      }
      
      // Create user object from wallet public key
      const user: User = {
        id: publicKey,
        publicKey,
        displayName: localStorage.getItem(DISPLAY_NAME_KEY) || `${solanaWallet.walletName}_${publicKey.substring(0, 6)}`,
        createdAt: Date.now(),
        lastLogin: Date.now()
      };
      
      // Update display name if needed
      try {
        localStorage.setItem(DISPLAY_NAME_KEY, user.displayName);
      } catch (error) {
        console.warn('[AuthContext] Failed to save display name:', error);
      }
      
      // Update auth state
      updateAuthState({
        status: 'authenticated',
        user,
        error: null,
        lastValidated: Date.now()
      });
      
      // Set auth method
      setAuthMethod('wallet');
      
      return user;
    } catch (error) {
      console.error('[AuthContext] Wallet connection failed:', error);
      updateAuthState({
        status: 'error',
        error: error instanceof Error ? error : new Error('Failed to connect wallet')
      });
      
      // After setting error state, transition to unauthenticated
      setTimeout(() => {
        updateAuthState({
          status: 'unauthenticated',
          error: null
        });
      }, 3000);
      
      return null;
    }
  }, [solanaWallet, updateAuthState]);
  
  /**
   * Disconnect from Solana wallet
   */
  const disconnectWallet = useCallback(async (): Promise<void> => {
    if (authMethod !== 'wallet') {
      return;
    }
    
    try {
      await solanaWallet.disconnect();
      
      // Reset auth state
      updateAuthState({
        status: 'unauthenticated',
        user: null,
        error: null
      });
      
      // Reset auth method
      setAuthMethod('none');
    } catch (error) {
      console.error('[AuthContext] Failed to disconnect wallet:', error);
      throw error;
    }
  }, [authMethod, solanaWallet, updateAuthState]);
  
  // Initialize auth on mount with timeout
  useEffect(() => {
    console.log('[AuthContext] Initial auth effect, status:', authState.status);
    
    let initTimeout: NodeJS.Timeout | null = null;
    
    // Set a timeout to exit initializing state if it takes too long
    if (authState.status === 'initializing') {
      initTimeout = setTimeout(() => {
        console.warn('[AuthContext] Auth initialization timeout - forcing to unauthenticated state');
        updateAuthState({
          status: 'unauthenticated',
          error: new Error('Authentication initialization timed out')
        });
      }, AUTH_TIMEOUT);
    }
    
    // Perform normal initialization if needed
    if (authState.status !== 'authenticated' && authState.status !== 'initializing') {
      login().catch(error => {
        console.error('[AuthContext] Login during initialization failed:', error);
      });
    } else if (authState.status === 'authenticated') {
      // If already authenticated, validate the auth state
      validateAuth().catch(error => {
        console.error('[AuthContext] Auth validation during initialization failed:', error);
      });
    }
    
    // Clean up timeout on unmount
    return () => {
      if (initTimeout) clearTimeout(initTimeout);
    };
  }, [authState.status, login, validateAuth, updateAuthState]);
  
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
  
  // Handle any issues if we stay in initializing state too long
  useEffect(() => {
    if (authState.status !== 'initializing') return;
    
    const timeout = setTimeout(() => {
      if (authState.status === 'initializing') {
        console.warn('[AuthContext] Still in initializing state after timeout - forcing to unauthenticated');
        updateAuthState({
          status: 'unauthenticated',
          error: new Error('Authentication stuck in initializing state')
        });
      }
    }, AUTH_TIMEOUT);
    
    return () => clearTimeout(timeout);
  }, [authState.status, updateAuthState]);
  
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
    validateAuth,
    solanaWallet: {
      hasWallet: solanaWallet.hasWallet,
      walletType: solanaWallet.walletType,
      walletName: solanaWallet.walletName,
      isConnected: solanaWallet.isConnected,
      isDetecting: solanaWallet.isDetecting
    },
    connectWallet,
    disconnectWallet,
    authMethod
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
    validateAuth,
    solanaWallet.hasWallet,
    solanaWallet.walletType,
    solanaWallet.walletName,
    solanaWallet.isConnected,
    solanaWallet.isDetecting,
    connectWallet,
    disconnectWallet,
    authMethod
  ]);
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
