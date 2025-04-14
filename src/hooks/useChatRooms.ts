// src/hooks/useChatRooms.ts
import { useState, useEffect } from 'react';
import { ChatRoom } from '../types/chat';
import { useAuth } from '../contexts/AuthContext';

export const useChatRooms = () => {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchChatRooms = async () => {
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
    };

    fetchChatRooms();
  }, [user]);

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

  // Function to delete a chat room
  const deleteChatRoom = async (roomId: string): Promise<boolean> => {
    try {
      // In a real implementation, this would be a server call
      const updatedRooms = chatRooms.filter(room => room.id !== roomId);
      setChatRooms(updatedRooms);
      
      // Update local storage
      localStorage.setItem('aero-chat-rooms', JSON.stringify(updatedRooms));

      return true;
    } catch (err) {
      console.error('Error deleting chat room:', err);
      throw err;
    }
  };

  return {
    chatRooms,
    loading,
    error,
    createChatRoom,
    deleteChatRoom
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
    },
  ];
};
