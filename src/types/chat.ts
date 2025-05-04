// src/types/chat.ts

// Message status types
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'received';

// Connection status types
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

// Extended connection status including P2P states
export type ExtendedConnectionStatus = ConnectionStatus | 'p2p-connecting' | 'p2p-connected';

// Encryption types
export type EncryptionType = 'standard' | 'high' | 'maximum';

// Metadata protection levels
export type MetadataProtection = 'standard' | 'enhanced' | 'maximum';

// Channel types for web3-inspired routing
export type ChannelType = 'main' | 'shard' | 'private';

// Verification levels
export type VerificationLevel = 'basic' | 'enhanced' | 'maximum';

// Message reaction
export interface MessageReaction {
  type: string; // Emoji or reaction type
  userId: string;
  userName?: string;
  timestamp?: string | Date;
}

// Message type - keeping original interface and extending with web3 enhancements
export interface MessageType {
  id: string;
  content: string;
  senderId: string;
  senderName?: string;
  timestamp: string | Date;
  isEncrypted?: boolean;
  metaData?: {
    encryptionType?: string;
    isP2P?: boolean;
    deviceId?: string;
    reactions?: MessageReaction[];
    // Web3 enhancements
    channelType?: ChannelType;
    signatureType?: 'personal' | 'verifiable';
    encryptionDetails?: {
      algorithm: string;
      keySize: number;
      nonce?: string;
      authTag?: string;
    };
    [key: string]: any;
  };
  status?: MessageStatus;
  isEdited?: boolean;
  editHistory?: { content: string; timestamp: number }[];
  replyToId?: string;
  threadId?: string;
}

// Attachment type
export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'audio' | 'video' | 'link';
  url: string;
  name?: string;
  size?: number;
  mimeType?: string;
  previewUrl?: string;
  width?: number;
  height?: number;
  duration?: number; // For audio/video
  isEncrypted: boolean;
  encryptionDetails?: {
    algorithm: string;
    keyId?: string;
    iv?: string;
  };
}

// Chat room - keeping original interface and extending with web3 enhancements
export interface ChatRoom {
  id: string;
  name: string;
  createdAt: string;
  lastActivity?: string;
  participants: number;
  isEphemeral: boolean;
  useP2P: boolean;
  createdBy: string;
  preview?: string;
  unreadCount?: number;
  // Web3 enhancements
  isArchived?: boolean;
  isStarred?: boolean;
  encryptionType?: EncryptionType;
  messageRetention?: number; // days, 0 = forever
  publicKeyMap?: { [userId: string]: string }; // Mapping of user IDs to public keys
  channelType?: ChannelType;
  verificationLevel?: VerificationLevel;
  metadataProtection?: MetadataProtection;
  shardingEnabled?: boolean;
  keyRotationInterval?: number; // hours
  forwardSecrecy?: boolean;
  consensusLevel?: number; // percentage
  blockchainMetadata?: {
    channelId: string;
    blockHeight: number;
    transactionHash?: string;
    consensusMechanismType?: string;
    participantSignatures?: string[];
    networkLatency?: number; // ms
    peers?: number;
  };
}

// Chat settings - keeping original interface
export interface ChatSettings {
  enableNotifications: boolean;
  autoDeleteMessages: boolean;
  autoDeleteDelay: number; // in hours
  messageRetention: number; // in days, 0 = forever
  useP2P: boolean;
  encryptionLevel: 'standard' | 'high' | 'maximum';
}

// Chat invitation - keeping original interface
export interface ChatInvitation {
  id: string;
  chatId: string;
  chatName: string;
  invitedBy: string;
  expires: string;
  token: string;
}

// Participant type - keeping original interface and extending with web3 enhancements
export interface Participant {
  id: string;
  publicKey: string;
  displayName: string;
  isActive: boolean;
  lastSeen: Date | string;
  // Web3 enhancements
  connectionType?: 'p2p' | 'relay';
  role?: 'admin' | 'member' | 'guest';
  wallet?: string; // Optional wallet address for web3 integration
  verificationLevel?: VerificationLevel;
}

// Chat room info - keeping original interface and extending with web3 enhancements
export interface ChatInfo {
  id: string;
  name: string;
  createdAt: string;
  isEphemeral: boolean;
  useP2P: boolean;
  createdBy: string;
  encryptionType?: 'standard' | 'high' | 'maximum';
  // Web3 enhancements
  channelType?: ChannelType;
  consensusLevel?: number;
  blockchainMetadata?: {
    channelId: string;
    blockHeight: number;
  };
}

// Secure message encryption options
export interface EncryptionOptions {
  algorithm: 'AES-GCM' | 'ChaCha20-Poly1305' | 'AES-CBC';
  keySize: 128 | 256 | 384 | 512;
  forwardSecrecy: boolean;
  metadataProtection: MetadataProtection;
}

// P2P Connection status and info
export interface P2PConnectionInfo {
  isConnected: boolean;
  isConnecting: boolean;
  peerId?: string;
  peerPublicKey?: string;
  latency?: number; // ms
  signalStrength?: number; // 0-100
  connectionType?: 'direct' | 'relay' | 'hybrid';
  encryptionVerified: boolean;
  establishedAt?: Date;
}

// Network status for metrics display
export interface NetworkStatus {
  activeNodes: number;
  messagesThroughput: number;
  encryptionStrength: number;
  averageLatency: number; // ms
  participantCount: number;
  totalMessages: number;
  consensusRatio: number; // %
  cpuUtilization: number; // %
  shardCount: number;
  cryptoOperations: number;
  peakBandwidth: number; // MB/s
  uptime: number; // %
}

// Security profile for user
export interface SecurityProfile {
  encryptionType: EncryptionType;
  keyStrength: number; // bits
  keyRotations: number;
  lastKeyRotation: Date;
  signaturesVerified: number;
  messagingPermissions: 'all' | 'contacts-only' | 'whitelist';
  metadataProtection: MetadataProtection;
  hasBackup: boolean;
}

// Message draft for composition
export interface MessageDraft {
  content: string;
  attachments: Attachment[];
  mentions: string[];
  replyToId?: string;
  encryptionOptions?: Partial<EncryptionOptions>;
}

// Notification preferences
export interface NotificationPreferences {
  enableNotifications: boolean;
  notificationSound: 'standard' | 'subtle' | 'energetic' | 'none';
  notifyOnAllMessages: boolean;
  notifyOnMentions: boolean;
  notifyOnDirectMessages: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // '22:00'
  quietHoursEnd: string; // '08:00'
  showPreview: boolean;
  vibrate: boolean;
}
