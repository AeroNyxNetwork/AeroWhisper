// Declaration file for Solana wallet extensions
interface SolanaProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isOKX?: boolean;
  isOkx?: boolean; // Alternative property name
  isOkxWallet?: boolean; // Alternative property name
  isBackpack?: boolean;
  isSlope?: boolean;
  _walletName?: string;
  walletName?: string;
  name?: string;
  isConnected: boolean;
  publicKey?: {
    toString(): string;
  };
  connect(): Promise<{ publicKey: string }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, encoding: string): Promise<{ signature: Uint8Array }>;
  signTransaction(transaction: any): Promise<any>;
}

interface Window {
  solana?: SolanaProvider;
}
