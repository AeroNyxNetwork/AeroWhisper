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
    if (!user || !socketRef.current || !chatId || content.trim() === '') {
      return false;
    }
    
    let messageId = '';
    
    try {
      setIsSendingMessage(true);
      
      // Generate a unique message ID
      messageId = uuid();
      
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
      
      // Add message to local state immediately (optimistic UI)
      setMessages(prev => [...prev, message]);
      
      // Try to send via WebRTC if connected
      let sentViaP2P = false;
      if (webrtcRef.current && webrtcRef.current.isDirectlyConnected()) {
        const p2pMessage = {
          id: messageId,
          content,
          senderId: user.id,
          senderName: user.displayName || 'Unknown',
          timestamp: new Date().toISOString(),
        };
        
        sentViaP2P = await webrtcRef.current.sendMessage(p2pMessage);
      }
      
      // If not sent via P2P, send via server
      if (!sentViaP2P) {
        await socketRef.current.sendMessage(message);
      }
      
      // Update message status to sent
      setMessages(prev => 
        prev.map(m => 
          m.id === messageId 
            ? { ...m, status: 'sent' } 
            : m
        )
      );
      
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      
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
  }, [user, chatId, toast]);
  
  // Leave the chat room
  const leaveChat = useCallback(async () => {
    try {
      if (socketRef.current) {
        await socketRef.current.leaveChat();
      }
      
      if (webrtcRef.current) {
        webrtcRef.current.disconnect();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to leave chat:', error);
      return false;
    }
  }, []);
  
  // Delete the chat room (if creator)
  const deleteChat = useCallback(async () => {
    try {
      if (!socketRef.current || !chatInfo || chatInfo.createdBy !== user?.id) {
        throw new Error('Not authorized to delete this chat room');
      }
      
      await socketRef.current.deleteChat();
      
      if (webrtcRef.current) {
        webrtcRef.current.disconnect();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to delete chat:', error);
      throw error;
    }
  }, [chatInfo, user?.id]);
  
  // Connect to a peer directly via WebRTC
  const connectToPeer = useCallback(async (peerId: string) => {
    if (!webrtcRef.current) {
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
      await webrtcRef.current.connectToPeer(peerId);
      setConnectionStatus('p2p-connecting');
      return true;
    } catch (error) {
      console.error('Failed to connect to peer:', error);
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
  const refreshParticipants = useCallback(async () => {
    if (!socketRef.current) return;
    
    try {
      await socketRef.current.requestParticipants();
    } catch (error) {
      console.error('Failed to refresh participants:', error);
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
