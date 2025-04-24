// src/lib/chatService.ts
import { v4 as uuid } from 'uuid';
import { ChatRoom } from '../types/chat';

// Interface for creating a chat room
interface CreateChatRoomParams {
  name: string;
  isEphemeral: boolean;
  useP2P: boolean;
  createdAt: string;
  createdBy?: string;
  encryptionType?: 'standard' | 'high' | 'maximum'; // Added this line
  messageRetention?: number; // Added this line
}

/**
 * Create a new chat room.
 * In a real implementation, this would call an API endpoint.
 * For now, we'll store it in localStorage.
 */
export const createChatRoom = async (params: CreateChatRoomParams): Promise<ChatRoom> => {
  // Get user ID from local storage
  const userKeypair = localStorage.getItem('aero-keypair');
  const userId = userKeypair ? JSON.parse(userKeypair).publicKey : 'unknown-user';
  
  // Create a new chat room
  const room: ChatRoom = {
    id: `chat-${uuid().substring(0, 8)}`,
    name: params.name,
    createdAt: params.createdAt,
    lastActivity: params.createdAt,
    participants: 1, // Start with just the creator
    isEphemeral: params.isEphemeral,
    useP2P: params.useP2P,
    createdBy: params.createdBy || userId,
    preview: 'Chat room created',
  };
  
  // Get existing rooms from localStorage
  const existingRoomsJson = localStorage.getItem('aero-chat-rooms');
  let existingRooms: ChatRoom[] = [];
  
  if (existingRoomsJson) {
    try {
      existingRooms = JSON.parse(existingRoomsJson);
    } catch (e) {
      console.error('Failed to parse stored chat rooms', e);
    }
  }
  
  // Add new room to the list
  const updatedRooms = [...existingRooms, room];
  
  // Save to localStorage
  localStorage.setItem('aero-chat-rooms', JSON.stringify(updatedRooms));
  
  // Store chat info with extended properties
  try {
    const chatInfo = {
      id: room.id,
      name: room.name,
      createdAt: room.createdAt,
      isEphemeral: room.isEphemeral,
      useP2P: room.useP2P,
      createdBy: room.createdBy,
      encryptionType: params.encryptionType || 'standard',
      messageRetention: params.messageRetention || 0
    };
    
    // Store the chat info separately
    localStorage.setItem(`aero-chat-info-${room.id}`, JSON.stringify(chatInfo));
  } catch (e) {
    console.error('Failed to store chat info', e);
  }
  
  // In a real implementation, we would make an API call here
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return room;
};

/**
 * Get a chat room by ID.
 */
export const getChatRoom = async (id: string): Promise<ChatRoom | null> => {
  // Get rooms from localStorage
  const roomsJson = localStorage.getItem('aero-chat-rooms');
  
  if (!roomsJson) {
    return null;
  }
  
  try {
    const rooms: ChatRoom[] = JSON.parse(roomsJson);
    return rooms.find(room => room.id === id) || null;
  } catch (e) {
    console.error('Failed to parse stored chat rooms', e);
    return null;
  }
};

/**
 * Delete a chat room by ID.
 */
export const deleteChatRoom = async (id: string): Promise<boolean> => {
  // Get rooms from localStorage
  const roomsJson = localStorage.getItem('aero-chat-rooms');
  
  if (!roomsJson) {
    return false;
  }
  
  try {
    const rooms: ChatRoom[] = JSON.parse(roomsJson);
    const updatedRooms = rooms.filter(room => room.id !== id);
    
    // Save to localStorage
    localStorage.setItem('aero-chat-rooms', JSON.stringify(updatedRooms));
    
    // Remove chat info
    localStorage.removeItem(`aero-chat-info-${id}`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return true;
  } catch (e) {
    console.error('Failed to parse stored chat rooms', e);
    return false;
  }
};

/**
 * Get all chat rooms for the current user.
 */
export const getUserChatRooms = async (): Promise<ChatRoom[]> => {
  // Get rooms from localStorage
  const roomsJson = localStorage.getItem('aero-chat-rooms');
  
  if (!roomsJson) {
    return [];
  }
  
  try {
    const rooms: ChatRoom[] = JSON.parse(roomsJson);
    return rooms;
  } catch (e) {
    console.error('Failed to parse stored chat rooms', e);
    return [];
  }
};
