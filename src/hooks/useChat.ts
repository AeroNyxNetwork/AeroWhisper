import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { v4 as uuid } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import { MessageType } from '../types/chat';
import { WebRTCManager } from '../lib/webrtc';
import { AeroNyxSocket } from '../lib/socket';
import { useToast } from '@chakra-ui/react';

// Connection status types
export type ConnectionStatus = 
  | 'connecting' 
  | 'connected' 
  | 'p2p-connecting' 
  | 'p2p-connected' 
  | 'disconnected';

// Participant type
export type Participant = {
  id: string;
  publicKey: string;
  displayName: string;
  isActive: boolean;
  lastSeen: Date;
};

// Chat room info
export type ChatInfo = {
  id: string;
  name: string;
  createdAt: string;
  isEphemeral: boolean;
  useP2P: boolean;
  createdBy: string;
};

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
  }, [chatId, user, toast]);
  
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
  
  // Send a message
  const sendMessage = useCallback(async (content:
