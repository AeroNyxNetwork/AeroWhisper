import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  Box, Flex, VStack, Text, Input, Button, IconButton, Heading, useToast,
  useColorModeValue, Avatar, Divider, Badge, Tooltip, Drawer, DrawerOverlay,
  DrawerContent, DrawerHeader, DrawerBody, DrawerCloseButton, useDisclosure,
  SimpleGrid, HStack, Menu, MenuButton, MenuList, MenuItem, MenuDivider
} from '@chakra-ui/react';
import { FaPaperPlane, FaUsers, FaSignOutAlt, FaTrash, FaBell, FaInfoCircle, FaBars } from 'react-icons/fa';
import { Layout } from '../../components/layout/Layout';
import { useChat } from '../../hooks/useChat';
import { Message } from '../../components/chat/Message';
import { ParticipantsList } from '../../components/chat/ParticipantsList';
import { EncryptionBadge } from '../../components/chat/EncryptionBadge';
import { ChatInfoSection } from '../../components/chat/ChatInfoSection';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { LeaveConfirmModal } from '../../components/modals/LeaveConfirmModal';
import { DeleteConfirmModal } from '../../components/modals/DeleteConfirmModal';

const ChatRoom = () => {
  const router = useRouter();
  const { id: chatId } = router.query;
  const toast = useToast();
  const { user, isAuthenticated } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { isOpen: isParticipantsOpen, onOpen: onParticipantsOpen, onClose: onParticipantsClose } = useDisclosure();
  const { isOpen: isInfoOpen, onOpen: onInfoOpen, onClose: onInfoClose } = useDisclosure();
  const { isOpen: isLeaveModalOpen, onOpen: onLeaveModalOpen, onClose: onLeaveModalClose } = useDisclosure();
  const { isOpen: isDeleteModalOpen, onOpen: onDeleteModalOpen, onClose: onDeleteModalClose } = useDisclosure();
  const { markChatAsRead } = useNotifications();
  
  const {
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
    isCreator
  } = useChat(typeof chatId === 'string' ? chatId : null);
  
  // Auto-scroll when new messages come in
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Mark chat as read when viewing
  useEffect(() => {
    if (chatId && connectionStatus === 'connected') {
      markChatAsRead(chatId as string);
    }
  }, [chatId, connectionStatus, markChatAsRead]);
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated && router.isReady) {
      router.push('/auth/connect-wallet');
    }
  }, [isAuthenticated, router]);
  
  // Debug WebSocket connections
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Capture WebSocket errors with proper type casting
      const originalWebSocket = window.WebSocket;
      
      // Create a constructor function that maintains the WebSocket interface
      const customWebSocketConstructor = function(
        this: WebSocket | any, // Use 'any' to avoid 'this' context issues
        url: string | URL, 
        protocols?: string | string[]
      ) {
        console.log(`[Debug] Creating WebSocket connection to: ${url}`);
        // We need to handle 'this' differently since we're using it as a constructor
        if (!(this instanceof customWebSocketConstructor)) {
          return new (customWebSocketConstructor as any)(url, protocols);
        }
        
        const ws = new originalWebSocket(url, protocols);
        
        // Copy all properties from the real WebSocket instance to this
        Object.assign(this, ws);
        
        // Add custom error handling
        const originalOnError = ws.onerror;
        ws.onerror = function(event) {
          console.error('[WebSocket Error]', event);
          if (originalOnError) originalOnError.call(ws, event);
        };
        
        return ws;
      };
      
      // Copy static properties
      customWebSocketConstructor.CONNECTING = originalWebSocket.CONNECTING;
      customWebSocketConstructor.OPEN = originalWebSocket.OPEN;
      customWebSocketConstructor.CLOSING = originalWebSocket.CLOSING;
      customWebSocketConstructor.CLOSED = originalWebSocket.CLOSED;
      
      // Use type assertion to replace the WebSocket constructor
      window.WebSocket = customWebSocketConstructor as unknown as typeof WebSocket;
      
      // Clean up on component unmount
      return () => {
        window.WebSocket = originalWebSocket;
      };
    }
  }, []);
  
  // Handle chat actions
  const handleLeaveChatConfirm = async () => {
    try {
      const success = await leaveChat();
      if (success) {
        router.push('/dashboard');
      }
    } catch (error) {
      toast({
        title: "Error leaving chat",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        status: "error",
        duration: 5000,
      });
    } finally {
      onLeaveModalClose();
    }
  };
  
  const handleDeleteChatConfirm = async () => {
    try {
      const success = await deleteChat();
      if (success) {
        router.push('/dashboard');
      }
    } catch (error) {
      toast({
        title: "Error deleting chat",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        status: "error",
        duration: 5000,
      });
    } finally {
      onDeleteModalClose();
    }
  };
  
  const handleSendMessage = async () => {
    if (newMessage.trim() === '') return;
    
    try {
      await sendMessage(newMessage);
      setNewMessage('');
      setIsTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    } catch (error) {
      toast({
        title: "Error sending message",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        status: "error",
        duration: 5000,
      });
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      // Code to notify others that user is typing would go here
    }
    
    // Reset typing indicator after 3 seconds of inactivity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      // Code to notify others that user stopped typing would go here
    }, 3000);
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isSendingMessage) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // UI Colors
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const cardBg = useColorModeValue('white', 'gray.800');
  const headerBg = useColorModeValue('white', 'gray.800');
  const inputBg = useColorModeValue('white', 'gray.700');
  
  // Loading & Error States
  if (!chatId) {
    return (
      <Layout>
        <Flex justify="center" align="center" h="80vh">
          <Text>Loading chat...</Text>
        </Flex>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <Flex 
        direction="column" 
        h="calc(100vh - 80px)" 
        maxH="calc(100vh - 80px)" 
        bg={bgColor}
        position="relative"
      >
        {/* Header */}
        <Flex 
          py={2} 
          px={4} 
          bg={headerBg} 
          borderBottomWidth="1px" 
          borderColor={borderColor}
          justify="space-between"
          align="center"
          boxShadow="sm"
        >
          <HStack spacing={4}>
            <Heading size="md" noOfLines={1}>
              {chatInfo?.name || `Chat #${chatId.toString().substring(0, 8)}`}
            </Heading>
            <EncryptionBadge isEncrypted={true} />
            {connectionStatus !== 'connected' && (
              <Badge colorScheme={connectionStatus === 'connecting' ? 'yellow' : 'red'}>
                {connectionStatus}
              </Badge>
            )}
          </HStack>
          
          <HStack spacing={2}>
            <Tooltip label="Chat Info">
              <IconButton
                aria-label="Chat Info"
                icon={<FaInfoCircle />}
                onClick={onInfoOpen}
                variant="ghost"
                size="md"
              />
            </Tooltip>
            
            <Tooltip label="Participants">
              <IconButton
                aria-label="Participants"
                icon={<FaUsers />}
                onClick={onParticipantsOpen}
                variant="ghost"
                size="md"
              />
            </Tooltip>
            
            <Menu>
              <MenuButton
                as={IconButton}
                aria-label="Chat Options"
                icon={<FaBars />}
                variant="ghost"
                size="md"
              />
              <MenuList>
                <MenuItem icon={<FaUsers />} onClick={onParticipantsOpen}>
                  Participants ({participants.length})
                </MenuItem>
                <MenuItem icon={<FaInfoCircle />} onClick={onInfoOpen}>
                  Chat Info
                </MenuItem>
                <MenuDivider />
                <MenuItem icon={<FaSignOutAlt />} onClick={onLeaveModalOpen}>
                  Leave Chat
                </MenuItem>
                {isCreator && (
                  <MenuItem icon={<FaTrash />} onClick={onDeleteModalOpen} color="red.500">
                    Delete Chat
                  </MenuItem>
                )}
              </MenuList>
            </Menu>
          </HStack>
        </Flex>
        
        {/* Messages Area */}
        <Flex 
          direction="column" 
          flex="1" 
          p={4} 
          overflowY="auto" 
          bg={bgColor}
        >
          {messages.length === 0 ? (
            <Flex justify="center" align="center" h="100%">
              <Box textAlign="center" p={6} borderRadius="md" bg={cardBg} boxShadow="sm">
                <Text>No messages yet. Start the conversation!</Text>
                <Text fontSize="sm" mt={2} color="gray.500">
                  Messages are end-to-end encrypted and not stored on any server.
                </Text>
              </Box>
            </Flex>
          ) : (
            <VStack spacing={4} align="stretch">
              {messages.map((message, index) => (
                <Message 
                  key={message.id || index}
                  message={message}
                  isOwnMessage={message.senderId === user?.id || message.senderId === user?.publicKey}
                  status={message.status}
                />
              ))}
              <div ref={messagesEndRef} />
            </VStack>
          )}
        </Flex>
        
        {/* Message Input Area */}
        <Box 
          p={4} 
          borderTopWidth="1px" 
          borderColor={borderColor}
          bg={headerBg}
        >
          <Flex>
            <Input
              placeholder="Type your message..."
              value={newMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              bg={inputBg}
              mr={2}
              isDisabled={connectionStatus !== 'connected'}
            />
            <Button
              colorScheme="purple"
              onClick={handleSendMessage}
              isDisabled={!newMessage.trim() || connectionStatus !== 'connected' || isSendingMessage}
              isLoading={isSendingMessage}
              leftIcon={<FaPaperPlane />}
            >
              Send
            </Button>
          </Flex>
          {isTyping && (
            <Text fontSize="xs" color="gray.500" mt={1}>
              You are typing...
            </Text>
          )}
          {connectionStatus !== 'connected' && (
            <Text fontSize="xs" color="red.500" mt={1}>
              {connectionStatus === 'connecting' ? 'Connecting to chat...' : 'Not connected'}
            </Text>
          )}
        </Box>
      </Flex>
      
      {/* Participants Drawer */}
      <Drawer
        isOpen={isParticipantsOpen}
        placement="right"
        onClose={onParticipantsClose}
        size="md"
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px">
            Participants ({participants.length})
          </DrawerHeader>
          <DrawerBody>
            <ParticipantsList 
              participants={participants} 
              currentUserId={user?.id || ''} 
              onRefresh={refreshParticipants}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      
      {/* Chat Info Drawer */}
      <Drawer
        isOpen={isInfoOpen}
        placement="right"
        onClose={onInfoClose}
        size="md"
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px">
            Chat Information
          </DrawerHeader>
          <DrawerBody>
            <ChatInfoSection 
              chatInfo={chatInfo} 
              participants={participants}
              connectionStatus={connectionStatus}
              isCreator={isCreator}
              onLeaveClick={onLeaveModalOpen}
              onDeleteClick={isCreator ? onDeleteModalOpen : undefined}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      
      {/* Leave Chat Confirmation Modal */}
      <LeaveConfirmModal
        isOpen={isLeaveModalOpen}
        onClose={onLeaveModalClose}
        onConfirm={handleLeaveChatConfirm}
      />
      
      {/* Delete Chat Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={onDeleteModalClose}
        onConfirm={handleDeleteChatConfirm}
      />
    </Layout>
  );
};

export default ChatRoom;
