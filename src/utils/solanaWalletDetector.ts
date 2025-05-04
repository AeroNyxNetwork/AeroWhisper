//src/utils/solanaWalletDetector.ts
// Utility to detect Solana wallet environments
export type SolanaWalletType = 'phantom' | 'solflare' | 'okx' | 'slope' | 'backpack' | 'other' | 'none';

interface SolanaWalletDetectionResult {
  hasWallet: boolean;
  walletType: SolanaWalletType;
  walletName: string;
  isConnected: boolean;
  publicKey?: string;
}

/**
 * Detects available Solana wallets in the user's browser
 */
export const detectSolanaWallet = async (): Promise<SolanaWalletDetectionResult> => {
  try {
    // Check if any Solana wallet adapter is available
    if (typeof window === 'undefined' || !window.solana) {
      return {
        hasWallet: false,
        walletType: 'none',
        walletName: 'None',
        isConnected: false
      };
    }

    // Detect which Solana wallet is available
    const solana = window.solana;
    
    // Phantom wallet detection
    if (solana.isPhantom) {
      return {
        hasWallet: true,
        walletType: 'phantom',
        walletName: 'Phantom',
        isConnected: solana.isConnected,
        publicKey: solana.publicKey?.toString()
      };
    }
    
    // Solflare wallet detection
    if (solana.isSolflare) {
      return {
        hasWallet: true,
        walletType: 'solflare',
        walletName: 'Solflare',
        isConnected: solana.isConnected,
        publicKey: solana.publicKey?.toString()
      };
    }

    // OKX wallet detection
    if (solana.isOKX) {
      return {
        hasWallet: true,
        walletType: 'okx',
        walletName: 'OKX Wallet',
        isConnected: solana.isConnected,
        publicKey: solana.publicKey?.toString()
      };
    }
    
    // Slope wallet detection
    if (solana.isSlope) {
      return {
        hasWallet: true,
        walletType: 'slope',
        walletName: 'Slope',
        isConnected: solana.isConnected,
        publicKey: solana.publicKey?.toString()
      };
    }

    // Backpack wallet detection
    if (solana.isBackpack) {
      return {
        hasWallet: true,
        walletType: 'backpack',
        walletName: 'Backpack',
        isConnected: solana.isConnected,
        publicKey: solana.publicKey?.toString()
      };
    }
    
    // Unknown Solana wallet
    return {
      hasWallet: true,
      walletType: 'other',
      walletName: 'Solana Wallet',
      isConnected: solana.isConnected,
      publicKey: solana.publicKey?.toString()
    };
  } catch (error) {
    console.error('Error detecting Solana wallet:', error);
    
    return {
      hasWallet: false,
      walletType: 'none',
      walletName: 'None',
      isConnected: false
    };
  }
};
