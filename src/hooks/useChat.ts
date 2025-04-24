// src/hooks/useChat.ts
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { v4 as uuid } from 'uuid';
import { useAuth, User } from '../contexts/AuthContext'; // Import User type from AuthContext
import {
    MessageType as ChatMessageType, // Rename imported type to avoid conflict
    Participant,
    ChatInfo,
    MessageStatus // Import the hook's internal status type
} from '../types/chat'; // Adjust path if needed
import {
    AeroNyxSocket,
    ConnectionStatus as SocketConnectionStatus,
    SendResult,
    SocketError
} from '../lib/socket';
// Import the specific message type definition expected by the socket's send method, if different
// Assuming the socket's send method expects an object structurally similar to ChatMessageType
// but potentially with a stricter status type or no status field needed for outgoing messages.
// If socket.sendMessage expects a specific type from socket/types, import that instead.
// For now, we assume the structure is compatible minus the 'status' field for outgoing.
// import { MessagePayload as SocketMessagePayload } from '../lib/socket/types'; // Example if socket needs specific type
import { useToast } from '@chakra-ui/react';

/**
 * Type mapping for user-facing connection status
 */
type HookConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

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
 * Converts the hook's internal ChatMessageType to the payload expected by socket.send()
 * Specifically removes or adjusts fields not relevant for sending (like client-side status).
 */
const createSendPayload = (message: ChatMessageType): Omit<ChatMessageType, 'status'> & { type: 'message' } => {
    // Omit 'status' as the socket layer/receiver handles delivery status.
    // Add 'type: message' as the application-level identifier for the payload.
    return {
        type: 'message', // Add the application-level message type identifier
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        senderName: message.senderName || 'Anonymous', // Ensure senderName exists
        timestamp: typeof message.timestamp === 'string'
            ? message.timestamp
            : message.timestamp.toISOString(), // Ensure ISO string
        isEncrypted: message.isEncrypted ?? true,
        // DO NOT include message.status here - this was the source of the error
    };
};


/**
 * Custom hook for managing chat room connections and interactions
 * @param chatId The ID of the chat room to connect to
 * @returns Chat state and action methods
 */
export const useChat = (chatId: string | null) => {
    const { user } = useAuth(); // Use the User type from AuthContext
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
        // Ensure user object exists before accessing id
        chatInfo?.createdBy === user?.id,
        [chatInfo?.createdBy, user?.id]
    );

    // --- Helper Functions ---

    /**
     * Creates a new message object for local state management
     */
    const createLocalMessage = useCallback((content: string, status: MessageStatus = 'sending'): ChatMessageType => ({
        id: `temp-${uuid()}`,
        content,
        // Ensure user exists before accessing properties
        senderId: user?.id || user?.publicKey || 'unknown-sender',
        senderName: user?.displayName || 'Me',
        timestamp: new Date().toISOString(), // Use ISO string directly
        isEncrypted: true, // Assume it will be encrypted
        status
    }), [user]); // Depend on user object

    /**
     * Handles socket errors based on their type and severity
     */
    const handleSocketError = useCallback((err: SocketError) => {
        console.error('[useChat] Socket error event received:', err);
        setError(err); // Store the full error object

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
     * Safely adds a message to the messages state, preventing duplicates and sorting.
     */
    const addMessage = useCallback((message: ChatMessageType) => {
        setMessages(prev => {
            // Skip if duplicate ID exists
            if (prev.some(m => m.id === message.id)) {
                return prev;
            }
            // Ensure message has a valid status
            const messageWithStatus = { ...message, status: message.status ?? 'received' };
            const newMessages = [...prev, messageWithStatus];
            // Sort by timestamp
            return newMessages.sort((a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
        });
    }, []);

    /**
     * Updates the status of a specific message in the local state.
     */
    const updateMessageStatus = useCallback((messageId: string, status: MessageStatus) => {
        setMessages(prev =>
            prev.map(m => m.id === messageId ? { ...m, status } : m)
        );
    }, []);

    // --- Socket Connection Effect ---
    useEffect(() => {
        // Skip if essential info is missing
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

        // Initialize socket instance if needed (new chat or first load)
        if (!socketRef.current || currentSocketChatId !== chatId) {
            if (socketRef.current) {
                console.log('[useChat] Chat ID changed, disconnecting previous socket.');
                socketRef.current.disconnect();
            }
            console.log('[useChat] Creating new AeroNyxSocket instance.');
            socketRef.current = new AeroNyxSocket();
            // socketRef.current.chatId = chatId; // Store chatId on socket instance if needed by socket logic
            setCurrentSocketChatId(chatId); // Track the chat ID this socket is for
        }

        const socket = socketRef.current;

        // --- Event Handlers ---
        const handleConnect = ({ ip, sessionId }: { ip: string, sessionId: string }) => {
            console.log(`[useChat] Socket connected: IP=${ip}, SessionID=${sessionId}`);
            setError(null);
            // Request initial data in parallel after connection established
            Promise.allSettled([ // Use allSettled to avoid one failure blocking others
                socket?.requestChatInfo().catch(err => console.error("Failed to request chat info:", err)),
                socket?.requestParticipants().catch(err => console.error("Failed to request participants:", err))
            ]);
        };

        const handleDisconnect = (code: number, reason: string) => {
            console.warn(`[useChat] Socket disconnected event received: ${code} - ${reason}`);
            // Status is handled by handleStatusChange
        };

        const handleStatusChange = (status: SocketConnectionStatus) => {
            console.log(`[useChat] Socket connection status changed: ${status}`);
            setConnectionStatus(mapSocketStatus(status));
        };

        // Type assertion needed here because socket.on expects specific payload types
        // based on event name, which might differ from ChatMessageType slightly.
        // Ensure the 'message' event payload from socket.ts matches ChatMessageType structure.
        const handleMessage = (message: any) => {
            // Add validation here if possible before casting
            if (message && typeof message.id === 'string') {
                 console.debug('[useChat] Received message:', message.id);
                 // Ensure message has necessary fields, assign defaults if needed
                 const completeMessage: ChatMessageType = {
                    id: message.id,
                    content: message.content ?? '',
                    senderId: message.senderId ?? 'unknown',
                    senderName: message.senderName ?? 'Anonymous',
                    timestamp: message.timestamp ?? new Date().toISOString(),
                    isEncrypted: message.isEncrypted ?? true,
                    status: message.status ?? 'received' // Assign 'received' status
                 };
                 addMessage(completeMessage);
            } else {
                console.warn("[useChat] Received invalid message structure:", message);
            }
        };

        const handleParticipants = (participantsList: Participant[]) => {
            console.debug('[useChat] Received participants list:', participantsList?.length ?? 0);
            setParticipants(Array.isArray(participantsList) ? participantsList : []);
        };

        const handleChatInfo = (info: ChatInfo) => {
            console.debug('[useChat] Received chat info:', info);
            setChatInfo(info ?? null);
        };

        // --- Register Event Listeners ---
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
                    console.log('[useChat] socket.connect() promise resolved (connection established).');
                    // State transition handled by 'connected' event listener
                })
                .catch(connectError => {
                    console.error('[useChat] socket.connect() promise rejected:', connectError);
                    // Error state is handled by the 'error' listener or 'disconnected' listener
                    // Ensure status reflects failure if not already disconnected
                    if (connectionStatus !== 'disconnected') {
                        setConnectionStatus('disconnected');
                    }
                });
        } else {
            // If socket exists and is not disconnected, sync local state
            setConnectionStatus(mapSocketStatus(socket.getConnectionStatus()));
            // If already connected, refresh data
            if (socket.isConnected()) {
                Promise.allSettled([
                    socket.requestChatInfo().catch(err => console.error("Failed to request chat info:", err)),
                    socket.requestParticipants().catch(err => console.error("Failed to request participants:", err))
                ]);
            }
        }

        // --- Cleanup Function ---
        return () => {
            console.log(`[useChat] Cleanup effect for chatId: ${chatId}`);
            if (!socket) return;
            // Remove listeners specific to this hook instance
            socket.off('connected', handleConnect);
            socket.off('disconnected', handleDisconnect);
            socket.off('connectionStatus', handleStatusChange);
            socket.off('message', handleMessage);
            socket.off('participants', handleParticipants);
            socket.off('chatInfo', handleChatInfo);
            socket.off('error', handleSocketError);

            // Consider if socket should be disconnected here.
            // If the socket instance is shared or managed globally, only remove listeners.
            // If the socket instance is tied ONLY to this hook instance, disconnect it.
            // Assuming for now the socket might be reused if navigating back quickly.
        };
    // Ensure all dependencies used in the effect are listed
    }, [chatId, user?.publicKey, user?.id, toast, handleSocketError, addMessage, currentSocketChatId]);

    // --- Public Actions ---

    /**
     * Sends a message to the chat room
     */
    const sendMessage = useCallback(async (content: string): Promise<boolean> => {
        console.debug('[useChat:SEND] Attempting to send message...');
        if (!user || !socketRef.current || !chatId || content.trim() === '') {
            console.error('[useChat:SEND] Cannot send: Missing user, socket, chatId, or content.');
            toast({ title: "Cannot send message", description: "Connection not ready or content empty.", status: "warning" });
            return false;
        }

        // Create local message for optimistic UI
        const localMessage = createLocalMessage(content, 'sending');
        addMessage(localMessage); // Add to local state immediately
        setIsSendingMessage(true);

        try {
            // Create the payload for the socket, omitting client-side status
            const sendPayload = createSendPayload(localMessage);
            const result = await socketRef.current.send(sendPayload); // Use send, not sendMessage

            // Update message status based on immediate send result
            switch (result) {
                case SendResult.SENT:
                    updateMessageStatus(localMessage.id, 'sent');
                    break;
                case SendResult.QUEUED:
                    updateMessageStatus(localMessage.id, 'sending'); // Keep as sending/queued
                    toast({ title: "Message queued", description: "Will send when connected.", status: "info", duration: 2000 });
                    break;
                case SendResult.FAILED:
                default:
                    updateMessageStatus(localMessage.id, 'failed');
                    toast({ title: "Failed to send message", status: "error" });
                    return false; // Indicate failure
            }
            return result !== SendResult.FAILED; // Return true if sent or queued

        } catch (error) {
            console.error('[useChat:SEND] Error during send operation:', error);
            updateMessageStatus(localMessage.id, 'failed');
            toast({ title: "Error sending message", description: error instanceof Error ? error.message : "Unknown error", status: "error" });
            return false;
        } finally {
            setIsSendingMessage(false);
        }
    }, [user, chatId, toast, createLocalMessage, addMessage, updateMessageStatus]); // Add necessary dependencies

    /**
     * Leaves the current chat room
     */
    const leaveChat = useCallback(async (): Promise<boolean> => {
        console.debug('[useChat:LEAVE] Attempting to leave chat room:', chatId);
        if (!socketRef.current) {
            console.warn("[useChat:LEAVE] Socket ref is null.");
            return false;
        }
        try {
            await socketRef.current.leaveChat();
            toast({ title: "Left chat", status: "success", duration: 3000 });
            // Reset local state after leaving
            setMessages([]);
            setParticipants([]);
            setChatInfo(null);
            setError(null);
            // Optionally navigate away
            // router.push('/dashboard');
            return true;
        } catch (error) {
            console.error('[useChat:LEAVE] Failed to leave chat:', error);
            toast({ title: "Error leaving chat", status: "error" });
            return false;
        }
    }, [chatId, toast]); // Removed router dependency unless used

    /**
     * Deletes the current chat room (if user is creator)
     */
    const deleteChat = useCallback(async (): Promise<boolean> => {
        console.debug('[useChat:DELETE] Attempting to delete chat room:', chatId);
        if (!socketRef.current || !isCreator) {
            console.error('[useChat:DELETE] Not authorized or socket unavailable.');
            toast({ title: "Cannot delete chat", description: "You are not the creator or connection unavailable.", status: "error" });
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
    }, [chatId, isCreator, toast]); // Removed router dependency unless used

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
            const result = await socketRef.current.requestParticipants();
            if (result === SendResult.FAILED) {
                 toast({ title: "Failed to request participants refresh", status: "warning" });
            }
        } catch (error) {
            console.error('[useChat:REFRESH] Failed to request participants refresh:', error);
            toast({ title: "Error refreshing participants", status: "warning" });
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
        socketInstance: socketRef.current // Expose socket instance if needed externally (use with caution)
    };
};
