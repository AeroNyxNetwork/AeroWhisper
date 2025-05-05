// Declaration file for Solana wallet extensions
interface SolanaProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isOKX?: boolean;
  isBackpack?: boolean;
  isSlope?: boolean;
  isConnected: boolean;
  publicKey?: {
    toString(): string;
  };
  connect(): Promise<{ publicKey: string }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, encoding: string): Promise<{ signature: Uint8Array }>;
  signTransaction(transaction: any): Promise<any>;
}

// Add OKX wallet specific interface
interface OKXWalletSolanaProvider {
  isConnected: boolean;
  publicKey?: {
    toString(): string;
  };
  connect(): Promise<{ publicKey: string }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, encoding: string): Promise<{ signature: Uint8Array }>;
  signTransaction(transaction: any): Promise<any>;
  on(event: string, callback: Function): void;
}

interface OKXWalletProvider {
  solana: OKXWalletSolanaProvider;
}

interface Window {
  solana?: SolanaProvider;
  okxwallet?: OKXWalletProvider;
}
