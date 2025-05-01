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
import { MessagePayload } from '../lib/socket/types';
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
 * Maps ChatMessageType status to MessagePayload status
 * @param status The status from ChatMessageType
 * @returns Status compatible with MessagePayload
 */
const mapMessageStatus = (status: MessageStatus | undefined): "sending" | "sent" | "delivered" | "failed" | "received" | "read" | undefined => {
    // Direct mapping since both types support the same status values
    return status;
};

/**
 * Converts a frontend ChatMessageType to a Socket's MessagePayload
 * This ensures all required fields are present when sending to the socket
 */
const toSocketMessage = (message: ChatMessageType): MessagePayload => ({
    type: 'message',
    id: message.id,
    // Map to both field formats for compatibility
    content: message.content,
    text: message.content,
    // Map to both field formats for compatibility
    senderId: message.senderId,
    sender: message.senderId,
    senderName: message.senderName || 'Anonymous', // Ensure senderName is never undefined
    timestamp: typeof message.timestamp === 'string' 
        ? message.timestamp 
        : message.timestamp.toISOString(), // Convert Date to ISO string if it's a Date object
    chatId: '', // Will be added by the sending function
    isEncrypted: message.isEncrypted ?? true,
    status: mapMessageStatus(message.status) // Map to compatible status type
});

/**
 * Converts a Socket's MessagePayload to frontend ChatMessageType
 * This ensures consistent data structure in the UI
 */
const fromSocketMessage = (message: MessagePayload): ChatMessageType => ({
    id: message.id,
    // Use content field with fallback to text
    content: message.content || message.text || '',
    // Use senderId field with fallback to sender
    senderId: message.senderId || message.sender || '',
    senderName: message.senderName,
    timestamp: message.timestamp,
    isEncrypted: message.isEncrypted,
    status: message.status || 'received'
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
    const messagesMapRef = useRef<Map<string, ChatMessageType>>(new Map());
    
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
     * Safely adds a message to the messages state with performance optimizations
     */
    const addMessage = useCallback((message: ChatMessageType) => {
        // Skip if already in the Map
        if (messagesMapRef.current.has(message.id)) {
            return;
        }
        
        // Add to the Map for O(1) lookups
        messagesMapRef.current.set(message.id, message);
        
        // Efficiently update the messages array
        setMessages(prev => {
            // Create a new array with the message
            const newMessages = [...prev, message];
            
            // Only sort if we have many messages (otherwise insertion at end is good enough)
            if (newMessages.length > 50) {
                return newMessages.sort((a, b) => {
                    const timeA = new Date(a.timestamp).getTime();
                    const timeB = new Date(b.timestamp).getTime();
                    return timeA - timeB;
                });
            }
            
            return newMessages;
        });
    }, []);

    /**
     * Updates message status
     */
    const updateMessageStatus = useCallback((messageId: string, status: MessageStatus) => {
        // Update in the map first (O(1) lookup)
        const message = messagesMapRef.current.get(messageId);
        if (message) {
            const updatedMessage = { ...message, status };
            messagesMapRef.current.set(messageId, updatedMessage);
        }
        
        // Then update in the state array
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
            // Clear the messages map reference
            messagesMapRef.current.clear();
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
            // Clear the messages map when switching chats
            messagesMapRef.current.clear();
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

        const handleMessage = (messagePayload: MessagePayload) => {
            console.debug('[useChat:RECEIVE] Received message:', messagePayload.id);
            
            // Convert socket message to frontend message format
            const frontendMessage = fromSocketMessage(messagePayload);
            
            // Only process messages from other users (our own messages are added when sent)
            const isCurrentUser = frontendMessage.senderId === user?.id || 
                                  frontendMessage.senderId === user?.publicKey;
                                  
            if (!isCurrentUser || frontendMessage.status === 'received') {
                addMessage(frontendMessage);
                console.debug('[useChat:RECEIVE] Added message to state, current messages length:', messages.length);
            }
        };

        const handleParticipants = (participantsList: Participant[]) => {
            console.debug('[useChat] Received participants list:', participantsList.length);
            setParticipants(participantsList);
        };

        const handleChatInfo = (info: ChatInfo) => {
            console.debug('[useChat] Received chat info:', info);
            setChatInfo(info);
        };
        
        const handleHistoryResponse = (historyData: any) => {
            if (Array.isArray(historyData.messages)) {
                console.debug('[useChat] Received history with', historyData.messages.length, 'messages');
                
                // Convert all history messages to frontend format
                const frontendMessages = historyData.messages.map(fromSocketMessage);
                
                // Add all messages to state efficiently
                const newMessagesMap = new Map(messagesMapRef.current);
                
                for (const message of frontendMessages) {
                    // Skip duplicates
                    if (!newMessagesMap.has(message.id)) {
                        newMessagesMap.set(message.id, message);
                    }
                }
                
                // Update the reference
                messagesMapRef.current = newMessagesMap;
                
                // Convert map to array and sort once
                const allMessages = Array.from(newMessagesMap.values()).sort((a, b) => {
                    const timeA = new Date(a.timestamp).getTime();
                    const timeB = new Date(b.timestamp).getTime();
                    return timeA - timeB;
                });
                
                // Set all messages at once
                setMessages(allMessages);
            }
        };

        // --- Register Event Listeners ---
        socket.on('connected', handleConnect);
        socket.on('disconnected', handleDisconnect);
        socket.on('connectionStatus', handleStatusChange);
        socket.on('message', handleMessage);
        socket.on('participants', handleParticipants);
        socket.on('chatInfo', handleChatInfo);
        socket.on('error', handleSocketError);
        socket.on('historyResponse', handleHistoryResponse);

        // --- Initiate Connection ---
        if (socket.getConnectionStatus() === 'disconnected') {
            console.log('[useChat] Initiating socket connection...');
            setConnectionStatus('connecting');
            
            socket.connect(chatId, user.publicKey)
              .then(() => {
                console.log('[useChat] socket.connect() promise resolved successfully');
                console.log('[useChat] Connection status after connect:', socket.getConnectionStatus());
                
                // Request chat history if available
                if (socket.isConnected()) {
                    console.log('[useChat] Requesting history from connected peers...');
                    // Send history request
                    socket.send({
                        type: 'history_request',
                        chatId: chatId,
                        requesterId: user.id || user.publicKey
                    })
                    .catch(err => console.error('[useChat] Failed to request history:', err));
                }
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
                    socket.requestParticipants().catch(err => console.error("Failed to request participants:", err)),
                    // Request history
                    socket.send({
                        type: 'history_request',
                        chatId: chatId,
                        requesterId: user.id || user.publicKey
                    }).catch(err => console.error('[useChat] Failed to request history:', err))
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
            socket.off('historyResponse', handleHistoryResponse);
        };
    }, [
        chatId, 
        user?.publicKey,
        user?.id,
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

        // Optimistic UI update - add to state immediately
        addMessage(messageToSend);
        setIsSendingMessage(true);

        try {
            // Convert to socket message type before sending
            const socketMessage = toSocketMessage(messageToSend);
            // Add the chatId - this field is required by the server
            socketMessage.chatId = chatId;
            
            // Send the message
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
            messagesMapRef.current.clear();
            
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
