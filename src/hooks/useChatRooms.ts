// src/hooks/useChatRooms.ts
import { useState, useEffect, useCallback } from 'react';
import { ChatRoom } from '../types/chat';
import { useAuth } from '../contexts/AuthContext';

export const useChatRooms = () => {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  // Function to fetch chat rooms from storage or generate samples
  const fetchChatRooms = useCallback(async () => {
    if (!user) {
      setChatRooms([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // In a real implementation, this would be a server call
      // For now, we'll use mock data stored in localStorage
      
      const storedRooms = localStorage.getItem('aero-chat-rooms');
      let rooms: ChatRoom[] = [];
      
      if (storedRooms) {
        try {
          rooms = JSON.parse(storedRooms);
        } catch (e) {
          console.error('Failed to parse stored chat rooms', e);
          // If parsing fails, reset storage
          localStorage.removeItem('aero-chat-rooms');
        }
      }
      
      // If there are no stored rooms, generate some sample ones
      if (rooms.length === 0) {
        rooms = generateSampleChatRooms(user.id);
        localStorage.setItem('aero-chat-rooms', JSON.stringify(rooms));
      }
      
      setChatRooms(rooms);
    } catch (err) {
      console.error('Error fetching chat rooms:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch on mount
  useEffect(() => {
    fetchChatRooms();
  }, [fetchChatRooms]);

  // Function to refresh chat rooms (used by dashboard)
  const refreshRooms = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      await fetchChatRooms();
      console.log('Chat rooms refreshed successfully');
    } catch (err) {
      console.error('Error refreshing chat rooms:', err);
      setError(err instanceof Error ? err : new Error('Failed to refresh chat rooms'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchChatRooms]);

  // Function to create a new chat room
  const createChatRoom = async (chatData: Partial<ChatRoom>): Promise<ChatRoom> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      // In a real implementation, this would be a server call
      const newRoom: ChatRoom = {
        id: `chat-${Date.now()}`,
        name: chatData.name || 'Untitled Chat',
        createdAt: new Date().toISOString(),
        participants: 1,
        isEphemeral: chatData.isEphemeral ?? false,
        useP2P: chatData.useP2P ?? true,
        createdBy: user.id,
        lastActivity: new Date().toISOString(),
        isStarred: false,
        isArchived: false,
        encryptionType: chatData.encryptionType || 'high'
      };

      // Update local state
      const updatedRooms = [...chatRooms, newRoom];
      setChatRooms(updatedRooms);
      
      // Update local storage
      localStorage.setItem('aero-chat-rooms', JSON.stringify(updatedRooms));

      return newRoom;
    } catch (err) {
      console.error('Error creating chat room:', err);
      throw err;
    }
  };

  // Function to delete a chat room (renamed from deleteChatRoom to match dashboard)
  const deleteRoom = async (roomId: string): Promise<void> => {
    try {
      // In a real implementation, this would be a server call
      const updatedRooms = chatRooms.filter(room => room.id !== roomId);
      setChatRooms(updatedRooms);
      
      // Update local storage
      localStorage.setItem('aero-chat-rooms', JSON.stringify(updatedRooms));
    } catch (err) {
      console.error('Error deleting chat room:', err);
      throw err;
    }
  };

  // Function to archive a chat room
  const archiveRoom = async (roomId: string): Promise<void> => {
    try {
      // In a real implementation, this would be a server call
      const updatedRooms = chatRooms.map(room => 
        room.id === roomId 
          ? { ...room, isArchived: true, lastActivity: new Date().toISOString() }
          : room
      );
      
      setChatRooms(updatedRooms);
      
      // Update local storage
      localStorage.setItem('aero-chat-rooms', JSON.stringify(updatedRooms));
    } catch (err) {
      console.error('Error archiving chat room:', err);
      throw err;
    }
  };

  // Function to star/unstar a chat room
  const starRoom = async (roomId: string): Promise<void> => {
    try {
      // Find current room to toggle its starred status
      const currentRoom = chatRooms.find(room => room.id === roomId);
      if (!currentRoom) {
        throw new Error(`Room with id ${roomId} not found`);
      }
      
      const newStarredState = !currentRoom.isStarred;
      
      // Update the room's starred status
      const updatedRooms = chatRooms.map(room => 
        room.id === roomId 
          ? { ...room, isStarred: newStarredState, lastActivity: new Date().toISOString() }
          : room
      );
      
      setChatRooms(updatedRooms);
      
      // Update local storage
      localStorage.setItem('aero-chat-rooms', JSON.stringify(updatedRooms));
    } catch (err) {
      console.error('Error updating star status:', err);
      throw err;
    }
  };

  return {
    chatRooms,
    loading,
    error,
    refreshRooms,
    createChatRoom,
    deleteRoom,
    archiveRoom,
    starRoom
  };
};

// Helper function to generate sample chat rooms
const generateSampleChatRooms = (userId: string): ChatRoom[] => {
  return [
    {
      id: 'chat-1',
      name: 'AeroNyx Team',
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      lastActivity: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
      participants: 5,
      isEphemeral: false,
      useP2P: true,
      createdBy: userId,
      preview: 'Welcome to AeroNyx secure messaging!',
      unreadCount: 2,
      isStarred: true,
      isArchived: false,
      encryptionType: 'high'
    },
    {
      id: 'chat-2',
      name: 'Project Alpha',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      lastActivity: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
      participants: 3,
      isEphemeral: true,
      useP2P: true,
      createdBy: userId,
      preview: 'Let\'s discuss the security features',
      isStarred: false,
      isArchived: false,
      encryptionType: 'maximum'
    },
    {
      id: 'chat-3',
      name: 'Development Chat',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      lastActivity: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      participants: 8,
      isEphemeral: false,
      useP2P: false,
      createdBy: userId,
      preview: 'Backend deployment status update',
      isStarred: false,
      isArchived: true,
      encryptionType: 'standard'
    }
  ];
};
