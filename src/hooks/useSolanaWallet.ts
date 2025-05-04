import { useState, useEffect, useCallback } from 'react';
import { detectSolanaWallet, SolanaWalletType } from '../utils/solanaWalletDetector';

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

export const useSolanaWallet = (): UseSolanaWalletResult => {
  const [hasWallet, setHasWallet] = useState(false);
  const [walletType, setWalletType] = useState<SolanaWalletType>('none');
  const [walletName, setWalletName] = useState('None');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize wallet detection on mount
  useEffect(() => {
    const detectWallet = async () => {
      try {
        setIsDetecting(true);
        const detection = await detectSolanaWallet();
        
        setHasWallet(detection.hasWallet);
        setWalletType(detection.walletType);
        setWalletName(detection.walletName);
        setIsConnected(detection.isConnected);
        setPublicKey(detection.publicKey || null);
      } catch (err) {
        console.error('Error detecting Solana wallet:', err);
        setError(err instanceof Error ? err : new Error('Failed to detect wallet'));
      } finally {
        setIsDetecting(false);
      }
    };

    detectWallet();
  }, []);

  // Connect to wallet
  const connect = useCallback(async (): Promise<string | null> => {
    if (!hasWallet || !window.solana) {
      setError(new Error('No Solana wallet found'));
      return null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      await window.solana.connect();
      const key = window.solana.publicKey?.toString() || null;
      
      if (!key) {
        throw new Error('Failed to get public key after connection');
      }
      
      setPublicKey(key);
      setIsConnected(true);
      
      return key;
    } catch (err) {
      console.error('Error connecting to Solana wallet:', err);
      const error = err instanceof Error ? err : new Error('Failed to connect to wallet');
      setError(error);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [hasWallet]);

  // Disconnect from wallet
  const disconnect = useCallback(async (): Promise<void> => {
    if (!hasWallet || !window.solana || !isConnected) {
      return;
    }

    try {
      await window.solana.disconnect();
      setPublicKey(null);
      setIsConnected(false);
    } catch (err) {
      console.error('Error disconnecting from Solana wallet:', err);
      setError(err instanceof Error ? err : new Error('Failed to disconnect from wallet'));
    }
  }, [hasWallet, isConnected]);

  // Refresh wallet state
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const detection = await detectSolanaWallet();
      
      setHasWallet(detection.hasWallet);
      setWalletType(detection.walletType);
      setWalletName(detection.walletName);
      setIsConnected(detection.isConnected);
      setPublicKey(detection.publicKey || null);
    } catch (err) {
      console.error('Error refreshing wallet state:', err);
      setError(err instanceof Error ? err : new Error('Failed to refresh wallet state'));
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
