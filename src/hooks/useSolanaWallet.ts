// src/hooks/useSolanaWallet.ts
import { useState, useEffect, useCallback } from 'react';
import { SolanaWalletType } from '../utils/solanaWalletDetector';

interface UseSolanaWalletResult {
  hasWallet: boolean;
  walletType: SolanaWalletType;
  walletName: string;
  isConnected: boolean;
  isConnecting: boolean;
  publicKey: string | null;
  isDetecting: boolean;
  error: Error | null;
  connect: () => Promise<string | null>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
}

// Helper function to safely check if solana is available
const isSolanaAvailable = (): boolean => {
  return typeof window !== 'undefined' && !!window.solana;
};

// Cache wallet detection result to improve subsequent loads
const WALLET_CACHE_KEY = 'aero-wallet-detection';
const MAX_CACHE_AGE = 30 * 60 * 1000; // 30 minutes

// Save detection result to localStorage
const cacheWalletDetection = (result: any) => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(WALLET_CACHE_KEY, JSON.stringify({
        ...result,
        timestamp: Date.now()
      }));
    }
  } catch (e) {
    console.warn('Failed to cache wallet detection:', e);
  }
};

// Load cached detection result if available and recent
const loadCachedWalletDetection = () => {
  try {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(WALLET_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < MAX_CACHE_AGE) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load cached wallet detection:', e);
  }
  return null;
};

/**
 * Detects available Solana wallets in the user's browser
 * Optimized for performance with caching
 */
async function detectSolanaWallet(): Promise<{
  hasWallet: boolean;
  walletType: SolanaWalletType;
  walletName: string;
  isConnected: boolean;
  publicKey?: string;
}> {
  try {
    // Check if window is available (browser environment)
    if (typeof window === 'undefined') {
      return {
        hasWallet: false,
        walletType: 'none',
        walletName: 'None',
        isConnected: false
      };
    }
    
    // First check for OKX wallet using their specific API path
    if (window.okxwallet && window.okxwallet.solana) {
      console.log('[Wallet] OKX wallet detected via window.okxwallet.solana');
      return {
        hasWallet: true,
        walletType: 'okx',
        walletName: 'OKX Wallet',
        isConnected: !!window.okxwallet.solana.isConnected,
        publicKey: window.okxwallet.solana.publicKey?.toString()
      };
    }
    
    // Then check for standard Solana wallets
    if (!window.solana) {
      console.log('[Wallet] No Solana wallet detected in window.solana');
      return {
        hasWallet: false,
        walletType: 'none',
        walletName: 'None', 
        isConnected: false
      };
    }
    
    // Verify Phantom wallet
    if (window.solana.isPhantom) {
      console.log('[Wallet] Phantom wallet detected');
      return {
        hasWallet: true,
        walletType: 'phantom',
        walletName: 'Phantom',
        isConnected: window.solana.isConnected,
        publicKey: window.solana.publicKey?.toString()
      };
    }
    
    // Generic fallback - could be any wallet
    console.log('[Wallet] Unknown wallet detected. Properties:', {
      hasPublicKey: !!window.solana.publicKey,
      isConnected: window.solana.isConnected
    });
    
    // Default to generic wallet
    return {
      hasWallet: true,
      walletType: 'other',
      walletName: 'Solana Wallet',
      isConnected: window.solana.isConnected,
      publicKey: window.solana.publicKey?.toString()
    };
  } catch (error) {
    console.error('[Wallet] Error detecting Solana wallet:', error);
    return {
      hasWallet: false,
      walletType: 'none',
      walletName: 'None',
      isConnected: false
    };
  }
}

export const useSolanaWallet = (): UseSolanaWalletResult => {
  // Try to get initial state from cache for faster rendering
  const initialCache = loadCachedWalletDetection();
  
  const [hasWallet, setHasWallet] = useState(initialCache?.hasWallet || false);
  const [walletType, setWalletType] = useState<SolanaWalletType>(initialCache?.walletType || 'none');
  const [walletName, setWalletName] = useState(initialCache?.walletName || 'None');
  const [isConnected, setIsConnected] = useState(initialCache?.isConnected || false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(initialCache?.publicKey || null);
  const [isDetecting, setIsDetecting] = useState(!initialCache);
  const [error, setError] = useState<Error | null>(null);

  // Initialize wallet detection in a non-blocking way
  useEffect(() => {
    // Skip detection if we already have cached data
    if (initialCache && !isDetecting) return;
    
    let mounted = true;
    
    // Don't block initial render - detect in background
    const detectWalletAsync = async () => {
      try {
        const detection = await detectSolanaWallet();
        
        if (!mounted) return;
        
        setHasWallet(detection.hasWallet);
        setWalletType(detection.walletType);
        setWalletName(detection.walletName);
        setIsConnected(detection.isConnected);
        setPublicKey(detection.publicKey || null);
      } catch (err) {
        console.error('Error detecting Solana wallet:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to detect wallet'));
        }
      } finally {
        if (mounted) {
          setIsDetecting(false);
        }
      }
    };

    // Small timeout to avoid blocking initial render
    const timeoutId = setTimeout(detectWalletAsync, 100);
    
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [initialCache, isDetecting]);

  // Connect to wallet
  const connect = useCallback(async (): Promise<string | null> => {
    if (typeof window === 'undefined') {
      setError(new Error('Browser environment required'));
      return null;
    }
  
    setIsConnecting(true);
    setError(null);
  
    try {
      // First try OKX wallet connection
      if (window.okxwallet && window.okxwallet.solana) {
        console.log('[Wallet] Connecting to OKX wallet...');
        await window.okxwallet.solana.connect();
        
        // Wait a brief moment for the connection to establish
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const key = window.okxwallet.solana.publicKey?.toString() || null;
        
        if (!key) {
          throw new Error('Failed to get public key after OKX wallet connection');
        }
        
        // Update state
        setPublicKey(key);
        setIsConnected(true);
        setWalletType('okx');
        setWalletName('OKX Wallet');
        
        return key;
      }
      
      // Then try standard Solana wallet connection
      if (!window.solana) {
        throw new Error('No Solana wallet found');
      }
  
      await window.solana.connect();
      
      // Wait a brief moment for the connection to establish
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const key = window.solana.publicKey?.toString() || null;
      
      if (!key) {
        throw new Error('Failed to get public key after connection');
      }
      
      // Update state
      setPublicKey(key);
      setIsConnected(true);
      
      return key;
    } catch (err) {
      console.error('Error connecting to wallet:', err);
      const error = err instanceof Error ? err : new Error('Failed to connect to wallet');
      setError(error);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  return {
    hasWallet,
    walletType,
    walletName,
    isConnected,
    isConnecting,
    publicKey,
    isDetecting,
    error,
    connect,
    disconnect,
    refresh
  };
};
