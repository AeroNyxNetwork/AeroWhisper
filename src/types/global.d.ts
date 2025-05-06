// src/types/global.d.ts

// This file extends the global Window interface to include Web3 wallet properties
// that might be injected by browser extensions or mobile wallet browsers

interface Window {
  // Ethereum wallets (MetaMask, etc.)
  ethereum?: any;
  web3?: any;
  
  // Solana wallets
  solana?: any;
  phantom?: any;
  
  // Other Web3 wallet injections can be added here
  coinbase?: any;
  walletConnect?: any;
  trustWallet?: any;
  
  // For wallet API methods that might be used elsewhere
  // Feel free to add more specific types if needed
  fs?: {
    readFile: (path: string, options?: { encoding?: string }) => Promise<any>;
  };
}

// If using TypeScript modules, uncomment this line:
export {};
