// src/hooks/useChat.ts
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { v4 as uuid } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import {
    MessageType,
    Participant,
    ChatInfo,
    MessageStatus, // Added this import
} from '../types/chat';
import {
    AeroNyxSocket,
    ConnectionStatus as SocketConnectionStatus,
    SendResult,
    SocketError
} from '../lib/socket';
import { useToast } from '@chakra-ui/react';

// Map internal socket state to user-facing status
const mapSocketStatus = (socketStatus: SocketConnectionStatus): 'connecting' | 'connected' | 'disconnected' | 'reconnecting' => {
    switch (socketStatus) {
        case 'connected': return 'connected';
        case 'connecting': return 'connecting';
        case 'reconnecting': return 'reconnecting';
        case 'disconnected':
        default: return 'disconnected';
    }
};

/**
 * Custom hook for managing chat room connections and interactions
 * @param chatId The ID of the chat room to connect to
 * @returns Chat state and action methods
 */
export const useChat = (chatId: string | null) => {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  // State
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [error, setError] = useState<SocketError | null>(null);
    
  const [currentSocketChatId, setCurrentSocketChatId] = useState<string | null>(null);
  // Refs
  const socketRef = useRef<AeroNyxSocket | null>(null);
  
  // Memoized values
  const isCreator = useMemo(() => 
    chatInfo?.createdBy === user?.id, 
    [chatInfo?.createdBy, user?.id]
  );

  // --- Helper Functions ---
  
  /**
   * Creates a new message object with the specified content and status
   */
  const createMessage = useCallback((content: string, status: MessageStatus = 'sending'): MessageType => ({
    id: `temp-${uuid()}`,
    content,
    senderId: user?.id || user?.publicKey || '',
    senderName: user?.displayName || 'Me',
    timestamp: new Date().toISOString(),
    isEncrypted: true,
    status
  }), [user]);

  /**
   * Handles socket errors based on their type and severity
   */
  const handleSocketError = useCallback((err: SocketError) => {
    console.error('[useChat] Socket error event received:', err);
    setError(err);
    
    // Customize toast based on error type
    const errorCategory = err.type.charAt(0).toUpperCase() + err.type.slice(1);
    
    toast({
      title: `${errorCategory} Error (${err.code})`,
      description: err.message || 'An unknown error occurred.',
      status: "error",
      duration: 5000,
      isClosable: true,
    });
  }, [toast]);

  // --- Socket Connection Effect ---
  useEffect(() => {
    // Don't connect if chatId or user is missing
    if (!chatId || !user?.publicKey) {
        if (socketRef.current) {
            console.log('[useChat] Chat ID or User missing, disconnecting existing socket.');
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        setConnectionStatus('disconnected');
        setMessages([]);
        setParticipants([]);
        setChatInfo(null);
        setError(null);
        return;
    }

    console.log(`[useChat] Effect triggered for chatId: ${chatId}`);

    // Initialize socket instance if it doesn't exist or chatId changed
    if (!socketRef.current || currentSocketChatId !== chatId) {
        if (socketRef.current) {
            console.log('[useChat] Chat ID changed, disconnecting previous socket.');
            socketRef.current.disconnect();
        }
        console.log('[useChat] Creating new AeroNyxSocket instance.');
        socketRef.current = new AeroNyxSocket();
        // Store the chatId in our local state
        setCurrentSocketChatId(chatId);
    }

    const socket = socketRef.current;

    // --- Event Listeners ---
    const handleConnect = ({ ip, sessionId }: { ip: string, sessionId: string }) => {
        console.log(`[useChat] Socket connected: IP=${ip}, SessionID=${sessionId}`);
        setError(null);
        
        // Request initial data in parallel
        Promise.all([
            socket?.requestChatInfo().catch(err => console.error("Failed to request chat info:", err)),
            socket?.requestParticipants().catch(err => console.error("Failed to request participants:", err))
        ]);
    };

    const handleDisconnect = (code: number, reason: string) => {
        console.warn(`[useChat] Socket disconnected event received: ${code} - ${reason}`);
        // Status handled by handleStatusChange
    };

    const handleStatusChange = (status: SocketConnectionStatus) => {
        console.log(`[useChat] Socket connection status changed: ${status}`);
        setConnectionStatus(mapSocketStatus(status));
    };

    const handleMessage = (message: MessageType) => {
        console.debug('[useChat] Received message:', message.id);
        
        // Add message with timestamp-based ordering
        setMessages(prev => {
            // Skip if duplicate
            if (prev.some(m => m.id === message.id)) {
                return prev;
            }
            
            // Create new array with the message
            const newMessages = [...prev, { ...message, status: message.status ?? 'received' }];
            
            // Sort by timestamp (optional)
            return newMessages.sort((a, b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
        });
    };

    const handleParticipants = (participantsList: Participant[]) => {
        console.debug('[useChat] Received participants list:', participantsList.length);
        setParticipants(participantsList);
    };

    const handleChatInfo = (info: ChatInfo) => {
        console.debug('[useChat] Received chat info:', info);
        setChatInfo(info);
    };

    // Attach listeners
    socket.on('connected', handleConnect);
    socket.on('disconnected', handleDisconnect);
    socket.on('connectionStatus', handleStatusChange);
    socket.on('message', handleMessage);
    socket.on('participants', handleParticipants);
    socket.on('chatInfo', handleChatInfo);
    socket.on('error', handleSocketError);

    // --- Initiate Connection ---
    if (socket.getConnectionStatus() === 'disconnected') {
        console.log('[useChat] Initiating socket connection...');
        setConnectionStatus('connecting');
        socket.connect(chatId, user.publicKey)
            .then(() => {
                console.log('[useChat] socket.connect() promise resolved.');
            })
            .catch(connectError => {
                console.error('[useChat] socket.connect() promise rejected:', connectError);
                const errorObj: SocketError = connectError instanceof Error 
                    ? { 
                        type: 'connection', 
                        message: connectError.message, 
                        code: 'CONNECT_FAILED',
                        retry: true
                      } 
                    : { 
                        type: 'connection',
                        message: String(connectError),
                        code: 'CONNECT_FAILED',
                        retry: true
                      };
                      
                setError(errorObj);
                setConnectionStatus('disconnected');
            });
    } else {
         // If socket already exists and is connecting/connected, update local state
         setConnectionStatus(mapSocketStatus(socket.getConnectionStatus()));
         
         // If connected, refresh data in parallel
         if (socket.isConnected()) {
             Promise.all([
                 socket.requestChatInfo().catch(err => console.error("Failed to request chat info:", err)),
                 socket.requestParticipants().catch(err => console.error("Failed to request participants:", err))
             ]);
         }
    }

    // --- Cleanup Function ---
    return () => {
      console.log(`[useChat] Cleanup effect for chatId: ${chatId}`);
      
      if (!socket) return;
      
      // Remove listeners
      socket.off('connected', handleConnect);
      socket.off('disconnected', handleDisconnect);
      socket.off('connectionStatus', handleStatusChange);
      socket.off('message', handleMessage);
      socket.off('participants', handleParticipants);
      socket.off('chatInfo', handleChatInfo);
      socket.off('error', handleSocketError);
    };
  }, [chatId, user?.publicKey, toast, handleSocketError, currentSocketChatId]);

  // --- Actions ---

  /**
   * Sends a message to the chat room
   * @param content Message content to send
   * @returns Promise resolving to success status
   */
  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    console.debug('[useChat:SEND] Attempting to send message...');
    if (!user || !socketRef.current || !chatId || content.trim() === '') {
      console.error('[useChat:SEND] Cannot send message: missing required data or connection.');
      toast({ 
        title: "Cannot send message", 
        description: "Connection not ready or content empty.", 
        status: "warning" 
      });
      return false;
    }

    // Create message with optimistic ID
    const messageToSend = createMessage(content, 'sending');
    const tempId = messageToSend.id;

    // Optimistic UI update
    setMessages(prev => [...prev, messageToSend]);
    setIsSendingMessage(true);

    try {
      const result = await socketRef.current.sendMessage(messageToSend);

      // Update message status based on send result
      setMessages(prev => prev.map(m => {
          if (m.id === tempId) {
              switch (result) {
                  case SendResult.SENT:
                      return { ...m, status: 'sent' };
                  case SendResult.QUEUED:
                      return { ...m, status: 'sending' };
                  case SendResult.FAILED:
                  default:
                      return { ...m, status: 'failed' };
              }
          }
          return m;
      }));

      // Show appropriate toast based on result
      if (result === SendResult.FAILED) {
         toast({ title: "Failed to send message", status: "error" });
         return false;
      }
      
      if (result === SendResult.QUEUED) {
         toast({ 
           title: "Message queued", 
           description: "Will send when connected.", 
           status: "info", 
           duration: 2000 
         });
      }

      return result !== SendResult.FAILED;

    } catch (error) {
      console.error('[useChat:SEND] Error sending message:', error);
      
      // Update failed message status
      setMessages(prev => 
        prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m)
      );
      
      toast({ 
        title: "Error sending message", 
        description: error instanceof Error ? error.message : "Unknown error", 
        status: "error" 
      });
      
      return false;
    } finally {
      setIsSendingMessage(false);
    }
  }, [user, chatId, toast, createMessage]);

  /**
   * Leaves the current chat room
   * @returns Promise resolving to success status
   */
  const leaveChat = useCallback(async (): Promise<boolean> => {
    console.debug('[useChat:LEAVE] Attempting to leave chat room:', chatId);
    if (!socketRef.current) return false;
    
    try {
      await socketRef.current.leaveChat();
      toast({ 
        title: "Left chat", 
        status: "success",
        duration: 3000
      });
      // Optionally navigate away after leaving
      // router.push('/dashboard');
      return true;
    } catch (error) {
      console.error('[useChat:LEAVE] Failed to leave chat:', error);
      toast({ title: "Error leaving chat", status: "error" });
      return false;
    }
  }, [chatId, toast]);

  /**
   * Deletes the current chat room (if user is creator)
   * @returns Promise resolving to success status
   */
  const deleteChat = useCallback(async (): Promise<boolean> => {
    console.debug('[useChat:DELETE] Attempting to delete chat room:', chatId);
    
    if (!socketRef.current || !isCreator) {
        console.error('[useChat:DELETE] Not authorized or chat info unavailable.');
        toast({ 
          title: "Cannot delete chat", 
          description: "You are not the creator or chat info is missing.", 
          status: "error"
        });
        return false;
    }
    
    try {
      const result = await socketRef.current.deleteChat();
      
      if (result === SendResult.SENT || result === SendResult.QUEUED) {
         toast({ title: "Chat deletion requested", status: "info" });
         // Optionally navigate away
         // router.push('/dashboard');
         return true;
      } else {
         toast({ title: "Failed to request chat deletion", status: "error" });
         return false;
      }
    } catch (error) {
      console.error('[useChat:DELETE] Failed to delete chat:', error);
      toast({ title: "Error deleting chat", status: "error" });
      return false;
    }
  }, [chatId, isCreator, toast]);

  /**
   * Refreshes the participants list from the server
   */
  const refreshParticipants = useCallback(async (): Promise<void> => {
      console.debug('[useChat:REFRESH] Refreshing participants list');
      
      if (!socketRef.current?.isConnected()) {
          console.warn('[useChat:REFRESH] Cannot refresh participants: Not connected.');
          return;
      }
      
      try {
          await socketRef.current.requestParticipants();
      } catch (error) {
          console.error('[useChat:REFRESH] Failed to request participants refresh:', error);
          toast({ title: "Failed to refresh participants", status: "warning" });
      }
  }, [toast]);

  // --- Return Hook State and Actions ---
  return {
    messages,
    sendMessage,
    participants,
    connectionStatus,
    chatInfo,
    leaveChat,
    deleteChat,
    refreshParticipants,
    isSendingMessage,
    error,
    isCreator,  // Export the memoized isCreator value
    socketInstance: socketRef.current
  };
};
