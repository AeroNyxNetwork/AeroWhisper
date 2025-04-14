// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
}

// User API types
export interface UserProfile {
  id: string;
  publicKey: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
  lastSeen?: string;
}

// Chat API types
export interface CreateChatRequest {
  name: string;
  isEphemeral: boolean;
  useP2P: boolean;
  expiresIn?: number; // In hours
}

export interface CreateChatResponse {
  id: string;
  name: string;
  inviteLink: string;
  createdAt: string;
}

// Invitation API types
export interface CreateInviteRequest {
  chatId: string;
  expiresIn?: number; // In hours
}

export interface CreateInviteResponse {
  inviteId: string;
  inviteLink: string;
  expiresAt: string;
}
