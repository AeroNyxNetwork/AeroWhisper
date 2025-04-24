// Message status
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'received';

// Message type
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
    [key: string]: any;
  };
  status?: MessageStatus;
}

// Message reaction
export interface MessageReaction {
  type: string;
  userId: string;
  userName?: string;
  timestamp?: string | Date;
}

// Chat room
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
}

// Chat settings
export interface ChatSettings {
  enableNotifications: boolean;
  autoDeleteMessages: boolean;
  autoDeleteDelay: number; // in hours
  messageRetention: number; // in days, 0 = forever
  useP2P: boolean;
  encryptionLevel: 'standard' | 'high' | 'maximum';
}

// Chat invitation
export interface ChatInvitation {
  id: string;
  chatId: string;
  chatName: string;
  invitedBy: string;
  expires: string;
  token: string;
}

// Participant type
export interface Participant {
  id: string;
  publicKey: string;
  displayName: string;
  isActive: boolean;
  lastSeen: Date | string;
}

// Connection status
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'p2p-connecting' | 'p2p-connected';

// Chat room info
export interface ChatInfo {
  id: string;
  name: string;
  createdAt: string;
  isEphemeral: boolean;
  useP2P: boolean;
  createdBy: string;
  encryptionType?: 'standard' | 'high' | 'maximum';
}
