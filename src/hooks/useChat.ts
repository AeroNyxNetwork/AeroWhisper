// src/hooks/useChat.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { v4 as uuid } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import { 
  MessageType, 
  Participant,
  ConnectionStatus,
  ChatInfo
} from '../types/chat';
import { WebRTCManager } from '../lib/webrtc';
import { AeroNyxSocket } from '../lib/socket';
import { useToast } from '@chakra-ui/react';

export const useChat = (chatId: string) => {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  
  // State
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  // Refs
  const socketRef = useRef<AeroNyxSocket | null>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const sessionKeyRef = useRef<Uint8Array | null>(null);
  
  // Initialize WebRTC for P2P communication
  const initializeWebRTC = useCallback((socket: AeroNyxSocket) => {
    const webrtc = new WebRTCManager();
    webrtcRef.current = webrtc;
    
    // Initialize WebRTC with socket and session key
    if (sessionKeyRef.current) {
      webrtc.initialize(socket, sessionKeyRef.current);
    }
    
    // Handle WebRTC connection state changes
    webrtc.on('connectionStateChanged', (state: string) => {
      if (state === 'connected') {
        setConnectionStatus('p2p-connected');
        toast({
          title: "P2P Connected",
          description: "Direct peer-to-peer connection established",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } else if (state === 'connecting') {
        setConnectionStatus('p2p-connecting');
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        if (connectionStatus === 'p2p-connected') {
          setConnectionStatus('connected');
          toast({
            title: "P2P Disconnected",
            description: "Falling back to server connection",
            status: "warning",
            duration: 3000,
            isClosable: true,
          });
        }
      }
    });
    
    // Handle WebRTC messages
    webrtc.on('message', (messageData: any) => {
      const message: MessageType = {
        id: uuid(),
        content: messageData.content,
        senderId: messageData.senderId,
        senderName: messageData.senderName,
        timestamp: messageData.timestamp || new Date().toISOString(),
        isEncrypted: true,
        metaData: {
          encryptionType: 'P2P',
          isP2P: true,
        },
        status: 'received',
      };
      
      setMessages(prev => [...prev, message]);
    });
  }, [connectionStatus, toast]);
  
  // Connect to chat room
  useEffect(() => {
    if (!chatId || !user) return;
    
    const connectToChat = async () => {
      try {
        // Initialize socket connection
        const socket = new AeroNyxSocket();
        socketRef.current = socket;
        
        // Connect to AeroNyx server
        await socket.connect(chatId, user.publicKey);
        
        // Set up message handler
        socket.on('message', (message: MessageType) => {
          setMessages(prev => [
            ...prev, 
            { ...message, id: message.id || uuid() }
          ]);
        });
        
        // Set up participant handler
        socket.on('participants', (participants: Participant[]) => {
          setParticipants(participants);
        });
        
        // Set up chat info handler
        socket.on('chatInfo', (info: ChatInfo) => {
          setChatInfo(info);
          
          // Initialize WebRTC if P2P is enabled
          if (info.useP2P) {
            initializeWebRTC(socket);
          }
        });
        
        // Set up connection status handler
        socket.on('connectionStatus', (status: ConnectionStatus) => {
          setConnectionStatus(status);
        });
        
        // Get initial chat data
        await socket.requestChatInfo();
        await socket.requestParticipants();
        
        // Mark as connected
        setConnectionStatus('connected');
        
      } catch (error) {
        console.error('Failed to connect to chat:', error);
        toast({
          title: "Connection failed",
          description: "Could not connect to the chat room",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        setConnectionStatus('disconnected');
      }
    };
    
    connectToChat();
    
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      
      if (webrtcRef.current) {
        webrtcRef.current.disconnect();
      }
    };
  }, [chatId, user, toast, initializeWebRTC]);
  
  // Send a message
  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    // ENHANCED LOGGING: Log message sending request from UI
    console.debug('[Chat:SEND] Message send request from UI:', {
      chatId,
      contentLength: content.length,
      contentPreview: content.length > 100 ? content.substring(0, 100) + '...' : content,
      hasUser: !!user,
      hasSocket: !!socketRef.current,
      connectionStatus
    });
    
    if (!user || !socketRef.current || !chatId || content.trim() === '') {
      console.error('[Chat:SEND] Cannot send message: missing required data');
      return false;
    }
    
    let messageId = '';
    
    try {
      setIsSendingMessage(true);
      
      // Generate a unique message ID
      messageId = uuid();
      console.debug('[Chat:SEND] Generated message ID:', messageId);
      
      // Create message object
      const message: MessageType = {
        id: messageId,
        content,
        senderId: user.id,
        senderName: user.displayName || 'Unknown',
        timestamp: new Date().toISOString(),
        isEncrypted: true,
        status: 'sending',
      };
      
      // ENHANCED LOGGING: Log the message object being created
      console.debug('[Chat:SEND] Created message object:', {
        id: message.id,
        senderId: message.senderId,
        senderName: message.senderName,
        contentLength: message.content.length,
        contentPreview: message.content.length > 100 ? message.content.substring(0, 100) + '...' : message.content,
        timestamp: message.timestamp
      });
      
      // Add message to local state immediately (optimistic UI)
      setMessages(prev => [...prev, message]);
      
      // Try to send via WebRTC if connected
      let sentViaP2P = false;
      if (webrtcRef.current && webrtcRef.current.isDirectlyConnected()) {
        console.debug('[Chat:SEND] Attempting to send via WebRTC (P2P)');
        
        const p2pMessage = {
          id: messageId,
          content,
          senderId: user.id,
          senderName: user.displayName || 'Unknown',
          timestamp: new Date().toISOString(),
        };
        
        try {
          sentViaP2P = await webrtcRef.current.sendMessage(p2pMessage);
          console.debug('[Chat:SEND] WebRTC send result:', sentViaP2P ? 'Success' : 'Failed');
        } catch (p2pError) {
          console.error('[Chat:SEND] WebRTC send error:', p2pError);
          sentViaP2P = false;
        }
      } else {
        console.debug('[Chat:SEND] WebRTC not connected, skipping P2P attempt');
      }
      
      // If not sent via P2P, send via server
      if (!sentViaP2P) {
        console.debug('[Chat:SEND] Sending via Socket (server)');
        try {
          await socketRef.current.sendMessage(message);
          console.debug('[Chat:SEND] Socket send completed');
        } catch (socketError) {
          console.error('[Chat:SEND] Socket send error:', socketError);
          throw socketError; // Rethrow to handle in the catch block below
        }
      }
      
      // Update message status to sent
      console.debug('[Chat:SEND] Updating message status to "sent"');
      setMessages(prev => 
        prev.map(m => 
          m.id === messageId 
            ? { ...m, status: 'sent' } 
            : m
        )
      );
      
      console.debug('[Chat:SEND] Message sending process completed successfully');
      return true;
    } catch (error) {
      console.error('[Chat:SEND] Failed to send message:', error);
      
      // ENHANCED LOGGING: Log detailed error information
      if (error instanceof Error) {
        console.error('[Chat:SEND] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
          messageId
        });
      }
      
      // Update message status to failed
      setMessages(prev => 
        prev.map(m => 
          m.id === messageId 
            ? { ...m, status: 'failed' } 
            : m
        )
      );
      
      toast({
        title: "Failed to send message",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      
      return false;
    } finally {
      setIsSendingMessage(false);
    }
  }, [user, chatId, toast, connectionStatus]);
  
  // Leave the chat room - Fix: Define the leaveChat function that was missing
  const leaveChat = useCallback(async (): Promise<boolean> => {
    console.debug('[Chat:LEAVE] Attempting to leave chat room:', chatId);
    
    try {
      if (socketRef.current) {
        console.debug('[Chat:LEAVE] Calling socket.leaveChat()');
        await socketRef.current.leaveChat();
        console.debug('[Chat:LEAVE] Successfully left chat room');
      } else {
        console.warn('[Chat:LEAVE] No socket available to leave chat');
      }
      
      if (webrtcRef.current) {
        console.debug('[Chat:LEAVE] Disconnecting WebRTC');
        webrtcRef.current.disconnect();
      }
      
      return true;
    } catch (error) {
      console.error('[Chat:LEAVE] Failed to leave chat:', error);
      
      // Enhanced error logging
      if (error instanceof Error) {
        console.error('[Chat:LEAVE] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      
      return false;
    }
  }, [chatId]);
  
  // Delete the chat room (if creator)
  const deleteChat = useCallback(async (): Promise<void> => {
    console.debug('[Chat:DELETE] Attempting to delete chat room:', chatId);
    
    try {
      if (!socketRef.current || !chatInfo || chatInfo.createdBy !== user?.id) {
        console.error('[Chat:DELETE] Not authorized to delete this chat room', {
          hasSocket: !!socketRef.current,
          hasChatInfo: !!chatInfo,
          isCreator: chatInfo?.createdBy === user?.id
        });
        throw new Error('Not authorized to delete this chat room');
      }
      
      console.debug('[Chat:DELETE] Calling socket.deleteChat()');
      await socketRef.current.deleteChat();
      console.debug('[Chat:DELETE] Successfully deleted chat room');
      
      if (webrtcRef.current) {
        console.debug('[Chat:DELETE] Disconnecting WebRTC');
        webrtcRef.current.disconnect();
      }
    } catch (error) {
      console.error('[Chat:DELETE] Failed to delete chat:', error);
      
      // Enhanced error logging
      if (error instanceof Error) {
        console.error('[Chat:DELETE] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      
      throw error;
    }
  }, [chatInfo, user?.id, chatId]);
  
  // Connect to a peer directly via WebRTC
  const connectToPeer = useCallback(async (peerId: string): Promise<boolean> => {
    console.debug('[Chat:P2P] Attempting to connect to peer:', peerId);
    
    if (!webrtcRef.current) {
      console.warn('[Chat:P2P] P2P not available for this chat');
      
      toast({
        title: "P2P not available",
        description: "Peer-to-peer connection is not available for this chat",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return false;
    }
    
    try {
      console.debug('[Chat:P2P] Initiating WebRTC connection to peer');
      await webrtcRef.current.connectToPeer(peerId);
      setConnectionStatus('p2p-connecting');
      console.debug('[Chat:P2P] P2P connection initiated successfully');
      return true;
    } catch (error) {
      console.error('[Chat:P2P] Failed to connect to peer:', error);
      
      // Enhanced error logging
      if (error instanceof Error) {
        console.error('[Chat:P2P] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      
      toast({
        title: "P2P connection failed",
        description: "Could not establish direct connection",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return false;
    }
  }, [toast]);
  
  // Refresh participants list
  const refreshParticipants = useCallback(async (): Promise<void> => {
    console.debug('[Chat:PARTICIPANTS] Refreshing participants list');
    
    if (!socketRef.current) {
      console.warn('[Chat:PARTICIPANTS] No socket available to refresh participants');
      return;
    }
    
    try {
      console.debug('[Chat:PARTICIPANTS] Calling socket.requestParticipants()');
      await socketRef.current.requestParticipants();
      console.debug('[Chat:PARTICIPANTS] Participants refresh request sent');
    } catch (error) {
      console.error('[Chat:PARTICIPANTS] Failed to refresh participants:', error);
      
      // Enhanced error logging
      if (error instanceof Error) {
        console.error('[Chat:PARTICIPANTS] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
    }
  }, []);
  
  return {
    messages,
    sendMessage,
    participants,
    connectionStatus,
    chatInfo,
    leaveChat,
    deleteChat,
    connectToPeer,
    refreshParticipants,
    isSendingMessage,
  };
};
