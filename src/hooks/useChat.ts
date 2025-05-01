// src/hooks/useChat.ts
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { v4 as uuid } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import {
    MessageType as ChatMessageType,
    Participant,
    ChatInfo,
    MessageStatus
} from '../types/chat';
import {
    AeroNyxSocket,
    ConnectionStatus as SocketConnectionStatus,
    SendResult,
    SocketError
} from '../lib/socket';
import { MessageType as SocketMessageType } from '../lib/socket/types';
import { useToast } from '@chakra-ui/react';

/**
 * Type mapping to handle the two different MessageType interfaces
 * This creates a clear separation between our hook's message type and the socket's message type
 */
type HookConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'p2p-connecting' | 'p2p-connected';

/**
 * Maps internal socket status to user-facing connection status
 * @param socketStatus The raw socket connection status
 * @returns Mapped user-facing connection status
 */
const mapSocketStatus = (socketStatus: SocketConnectionStatus): HookConnectionStatus => {
    switch (socketStatus) {
        case 'connected': return 'connected';
        case 'connecting': return 'connecting';
        case 'reconnecting': return 'reconnecting';
        case 'disconnected':
        default: return 'disconnected';
    }
};

/**
 * Maps ChatMessageType status to SocketMessageType status
 * @param status The status from ChatMessageType
 * @returns Status compatible with SocketMessageType
 */
const mapMessageStatus = (status: MessageStatus | undefined): "sending" | "sent" | "delivered" | "failed" | "received" | undefined => {
    if (!status) return undefined;
    
    // If status is "read", map it to "delivered" as that's the closest match
    if (status === "read") return "delivered";
    
    // For other values that are common between both types, return as is
    if (status === "sending" || status === "sent" || status === "delivered" || 
        status === "failed" || status === "received") {
        return status;
    }
    
    // Default fallback if none of the above match
    return "sent";
};

/**
 * Converts a ChatMessageType to a SocketMessageType
 * This ensures all required fields are present when sending to the socket
 */
const toSocketMessage = (message: ChatMessageType): SocketMessageType => ({
    id: message.id,
    content: message.content,
    senderId: message.senderId,
    senderName: message.senderName || 'Anonymous', // Ensure senderName is never undefined
    timestamp: typeof message.timestamp === 'string' 
        ? message.timestamp 
        : message.timestamp.toISOString(), // Convert Date to ISO string if it's a Date object
    isEncrypted: message.isEncrypted ?? true,
    status: mapMessageStatus(message.status) // Map to compatible status type
    // chatId is added by the socket implementation
});

/**
 * Custom hook for managing chat room connections and interactions
 * @param chatId The ID of the chat room to connect to
 * @returns Chat state and action methods
 */
export const useChat = (chatId: string | null) => {
    const { user } = useAuth();
    const router = useRouter();
    const toast = useToast();

    // --- State Management ---
    const [messages, setMessages] = useState<ChatMessageType[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<HookConnectionStatus>('disconnected');
    const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [error, setError] = useState<SocketError | null>(null);
    const [currentSocketChatId, setCurrentSocketChatId] = useState<string | null>(null);

    // --- Refs ---
    const socketRef = useRef<AeroNyxSocket | null>(null);
    
    // --- Derived State ---
    const isCreator = useMemo(() => 
        chatInfo?.createdBy === user?.id, 
        [chatInfo?.createdBy, user?.id]
    );

    // --- Helper Functions ---
    
    /**
     * Creates a new message object with the specified content and status
     */
    const createMessage = useCallback((content: string, status: MessageStatus = 'sending'): ChatMessageType => {
      const senderId = user?.id || user?.publicKey || '';
      console.debug('[useChat:CREATE] Creating message with senderId:', senderId);
      
      return {
        id: `temp-${uuid()}`,
        content,
        senderId,
        senderName: user?.displayName || 'Anonymous',
        timestamp: new Date().toISOString(),
        isEncrypted: true,
        status
      };
    }, [user]);

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

    /**
     * Creates a properly formatted SocketError object
     */
    const createSocketError = useCallback((
        error: unknown, 
        type: 'connection' | 'auth' | 'data' | 'signaling' | 'server' | 'message' | 'internal' | 'security' = 'connection', 
        code: string = 'ERROR', 
        retry: boolean = false
    ): SocketError => {
        return {
            type,
            code,
            message: error instanceof Error ? error.message : String(error),
            retry
        };
    }, []);

    /**
     * Safely adds a message to the messages state
     */
    const addMessage = useCallback((message: ChatMessageType) => {
        setMessages(prev => {
            // Skip if duplicate
            if (prev.some(m => m.id === message.id)) {
                return prev;
            }
            
            // Create a new array with the message
            const newMessages = [...prev, message];
            
            // Sort by timestamp
            return newMessages.sort((a, b) => {
                const timeA = new Date(a.timestamp).getTime();
                const timeB = new Date(b.timestamp).getTime();
                return timeA - timeB;
            });
        });
    }, []);

    /**
     * Updates message status
     */
    const updateMessageStatus = useCallback((messageId: string, status: MessageStatus) => {
        setMessages(prev => 
            prev.map(m => m.id === messageId ? { ...m, status } : m)
        );
    }, []);

    // --- Socket Connection Effect ---
    useEffect(() => {
        // Skip if no chatId or user
        if (!chatId || !user?.publicKey) {
            if (socketRef.current) {
                console.log('[useChat] Chat ID or User missing, disconnecting existing socket.');
                socketRef.current.disconnect();
                socketRef.current = null;
                setCurrentSocketChatId(null);
            }
            setConnectionStatus('disconnected');
            setMessages([]);
            setParticipants([]);
            setChatInfo(null);
            setError(null);
            return;
        }

        console.log(`[useChat] Effect triggered for chatId: ${chatId}`);

        // Initialize socket instance if needed
        if (!socketRef.current || currentSocketChatId !== chatId) {
            if (socketRef.current) {
                console.log('[useChat] Chat ID changed, disconnecting previous socket.');
                socketRef.current.disconnect();
            }
            console.log('[useChat] Creating new AeroNyxSocket instance.');
            socketRef.current = new AeroNyxSocket();
            setCurrentSocketChatId(chatId);
        }

        const socket = socketRef.current;

        // --- Event Handlers ---
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

        const handleMessage = (message: ChatMessageType) => {
            console.debug('[useChat] Received message:', message.id);
            
            // Add the received message with a default status if not provided
            const completeMessage: ChatMessageType = {
                ...message,
                status: message.status ?? 'received'
            };
            
            addMessage(completeMessage);
        };

        const handleParticipants = (participantsList: Participant[]) => {
            console.debug('[useChat] Received participants list:', participantsList.length);
            setParticipants(participantsList);
        };

        const handleChatInfo = (info: ChatInfo) => {
            console.debug('[useChat] Received chat info:', info);
            setChatInfo(info);
        };

        // --- Register Event Listeners ---
        socket.on('connected', handleConnect);
        socket.on('disconnected', handleDisconnect);
        socket.on('connectionStatus', handleStatusChange);
        socket.on('message', (message) => {
          console.debug('[useChat:RECEIVE] Received message:', {
            id: message.id, 
            senderId: message.senderId,
            senderName: message.senderName,
            currentUserId: user?.id,
            isCurrentUser: message.senderId === user?.id || message.senderId === user?.publicKey
          });
          
          // Add the received message with a default status if not provided
          const completeMessage: ChatMessageType = {
            ...message,
            status: message.status ?? 'received'
          };
          
          addMessage(completeMessage);
          console.debug('[useChat:RECEIVE] Total messages after adding:', messages.length);
        });
        socket.on('participants', handleParticipants);
        socket.on('chatInfo', handleChatInfo);
        socket.on('error', handleSocketError);

        // --- Initiate Connection ---
        if (socket.getConnectionStatus() === 'disconnected') {
            console.log('[useChat] Initiating socket connection...');
            setConnectionStatus('connecting');
            
            socket.connect(chatId, user.publicKey)
              .then(() => {
                console.log('[useChat] socket.connect() promise resolved successfully');
                console.log('[useChat] Connection status after connect:', socket.getConnectionStatus());
                // Maybe add additional connection validation here
              })
              .catch(connectError => {
                console.error('[useChat] socket.connect() promise rejected:', connectError);
                console.error('[useChat] Error details:', {
                  message: connectError.message,
                  name: connectError.name,
                  stack: connectError.stack
                });
                
                setError(createSocketError(
                  connectError, 
                  'connection', 
                  'CONNECT_FAILED', 
                  true
                ));
                setConnectionStatus('disconnected');
              });
        } else {
            // Update local state if socket already exists
            setConnectionStatus(mapSocketStatus(socket.getConnectionStatus()));
            
            // Refresh data if connected
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
            
            // Remove all event listeners
            socket.off('connected', handleConnect);
            socket.off('disconnected', handleDisconnect);
            socket.off('connectionStatus', handleStatusChange);
            socket.off('message', handleMessage);
            socket.off('participants', handleParticipants);
            socket.off('chatInfo', handleChatInfo);
            socket.off('error', handleSocketError);
        };
    }, [
        chatId, 
        user?.publicKey, 
        handleSocketError,
        currentSocketChatId,
        createSocketError,
        addMessage
    ]);

    // --- Public Actions ---

    /**
     * Sends a message to the chat room
     * @param content Message content to send
     * @returns Promise resolving to success status
     */
    const sendMessage = useCallback(async (content: string): Promise<boolean> => {
        console.debug('[useChat:SEND] Attempting to send message...');
        
        // Validate requirements
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
        addMessage(messageToSend);
        setIsSendingMessage(true);

        try {
            // Convert to socket message type before sending
            const socketMessage = toSocketMessage(messageToSend);
            const result = await socketRef.current.sendMessage(socketMessage);

            // Update message status based on result
            switch (result) {
                case SendResult.SENT:
                    updateMessageStatus(tempId, 'sent');
                    break;
                case SendResult.QUEUED:
                    updateMessageStatus(tempId, 'sending');
                    toast({ 
                        title: "Message queued", 
                        description: "Will send when connected.", 
                        status: "info", 
                        duration: 2000 
                    });
                    break;
                case SendResult.FAILED:
                default:
                    updateMessageStatus(tempId, 'failed');
                    toast({ 
                        title: "Failed to send message", 
                        status: "error" 
                    });
                    return false;
            }

            // Use explicit comparison with possible success values
            return result === SendResult.SENT || result === SendResult.QUEUED;
        } catch (error) {
            console.error('[useChat:SEND] Error sending message:', error);
            
            // Update failed message status
            updateMessageStatus(tempId, 'failed');
            
            toast({ 
                title: "Error sending message", 
                description: error instanceof Error ? error.message : "Unknown error", 
                status: "error" 
            });
            
            return false;
        } finally {
            setIsSendingMessage(false);
        }
    }, [
        user, 
        chatId, 
        toast, 
        createMessage, 
        addMessage, 
        updateMessageStatus
    ]);

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
            
            // Reset state
            setMessages([]);
            setParticipants([]);
            setChatInfo(null);
            
            return true;
        } catch (error) {
            console.error('[useChat:LEAVE] Failed to leave chat:', error);
            
            toast({ 
                title: "Error leaving chat", 
                status: "error" 
            });
            
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
                toast({ 
                    title: "Chat deletion requested", 
                    status: "info" 
                });
                
                return true;
            } else {
                toast({ 
                    title: "Failed to request chat deletion", 
                    status: "error" 
                });
                
                return false;
            }
        } catch (error) {
            console.error('[useChat:DELETE] Failed to delete chat:', error);
            
            toast({ 
                title: "Error deleting chat", 
                status: "error" 
            });
            
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
            
            toast({ 
                title: "Failed to refresh participants", 
                status: "warning" 
            });
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
        isCreator,
        socketInstance: socketRef.current
    };
};
