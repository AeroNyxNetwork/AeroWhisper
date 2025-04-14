import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  Box, Flex, Text, IconButton, Input, Heading,
  useColorMode, Button, Menu, MenuButton, MenuList,
  MenuItem, VStack, HStack, Tooltip, Badge, Divider,
  useClipboard, useToast
} from '@chakra-ui/react';
import { 
  FaPaperPlane, FaEllipsisV, FaUserPlus, FaClipboard, 
  FaTrash, FaSignOutAlt, FaShieldAlt, FaKey
} from 'react-icons/fa';
import { Layout } from '../../components/layout/Layout';
import { Message } from '../../components/chat/Message';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../contexts/AuthContext';
import { ChatEncryptionIndicator } from '../../components/chat/ChatEncryptionIndicator';
import { ChatHeader } from '../../components/chat/ChatHeader';
import { InviteModal } from '../../components/modals/InviteModal';

const ChatPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const chatId = id as string;
  const { colorMode } = useColorMode();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  
  const { 
    messages, 
    sendMessage, 
    connectionStatus, 
    participants, 
    chatInfo,
    leaveChat,
    deleteChat,
    isSendingMessage
  } = useChat(chatId);
  
  const [newMessage, setNewMessage] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  
  const { hasCopied, onCopy } = useClipboard(window.location.href);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      sendMessage(newMessage);
      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleCopyInvite = () => {
    onCopy();
    toast({
      title: "Invitation link copied",
      status: "success",
      duration: 2000,
    });
  };

  const handleLeaveChat = async () => {
    if (window.confirm("Are you sure you want to leave this chat?")) {
      await leaveChat();
      router.push('/dashboard');
    }
  };

  const handleDeleteChat = async () => {
    if (window.confirm("Are you sure you want to permanently delete this chat? This action cannot be undone.")) {
      await deleteChat();
      router.push('/dashboard');
    }
  };

  if (!chatId) {
    return <Text>Loading...</Text>;
  }

  return (
    <Layout>
      <Flex direction="column" h="calc(100vh - 80px)">
        <ChatHeader 
          chatName={chatInfo?.name || 'Loading...'}
          participants={participants.length}
          connectionStatus={connectionStatus}
          onInvite={() => setShowInviteModal(true)}
        />
        
        <Box 
          flex="1" 
          bg={colorMode === 'dark' ? 'gray.800' : 'gray.50'} 
          overflowY="auto"
          p={4}
        >
          {messages.length > 0 ? (
            <VStack spacing={4} align="stretch">
              {messages.map((message, index) => (
                <Message 
                  key={message.id || index}
                  message={message}
                  isOwnMessage={message.senderId === user?.id}
                  showAvatar={true}
                />
              ))}
              <div ref={messagesEndRef} />
            </VStack>
          ) : (
            <Flex 
              direction="column" 
              align="center" 
              justify="center" 
              h="100%" 
              textAlign="center"
              opacity={0.7}
            >
              <Box mb={4}>
                <FaShieldAlt size={48} />
              </Box>
              <Heading size="md" mb={2}>This conversation is secure</Heading>
              <Text>Messages are end-to-end encrypted and will never leave your device unencrypted</Text>
              <HStack mt={6} spacing={4}>
                <Tooltip label="Share this chat with others" placement="top">
                  <Button 
                    leftIcon={<FaUserPlus />} 
                    variant="outline" 
                    onClick={() => setShowInviteModal(true)}
                  >
                    Invite Others
                  </Button>
                </Tooltip>
                
                <Tooltip label="Copy invitation link" placement="top">
                  <Button 
                    leftIcon={<FaClipboard />} 
                    variant="outline" 
                    onClick={handleCopyInvite}
                  >
                    Copy Link
                  </Button>
                </Tooltip>
              </HStack>
            </Flex>
          )}
        </Box>
        
        <Box 
          p={4} 
          bg={colorMode === 'dark' ? 'gray.700' : 'white'}
          borderTop="1px solid"
          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
        >
          <HStack mb={2} justify="space-between">
            <ChatEncryptionIndicator 
              isP2P={connectionStatus === 'p2p-connected'}
              isEncrypted={true}
            />
            
            <Menu>
              <MenuButton
                as={IconButton}
                icon={<FaEllipsisV />}
                variant="ghost"
                aria-label="More options"
              />
              <MenuList>
                <MenuItem icon={<FaUserPlus />} onClick={() => setShowInviteModal(true)}>
                  Invite Others
                </MenuItem>
                <MenuItem icon={<FaClipboard />} onClick={handleCopyInvite}>
                  Copy Invitation Link
                </MenuItem>
                <Divider />
                <MenuItem icon={<FaSignOutAlt />} onClick={handleLeaveChat}>
                  Leave Chat
                </MenuItem>
                <MenuItem icon={<FaTrash />} onClick={handleDeleteChat} color="red.500">
                  Delete Chat
                </MenuItem>
              </MenuList>
            </Menu>
          </HStack>
          
          <form onSubmit={handleSendMessage}>
            <Flex>
              <Input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                bg={colorMode === 'dark' ? 'gray.800' : 'gray.50'}
                size="lg"
                mr={2}
                isDisabled={connectionStatus === 'disconnected'}
              />
              <IconButton
                colorScheme="purple"
                aria-label="Send message"
                icon={<FaPaperPlane />}
                type="submit"
                isDisabled={!newMessage.trim() || connectionStatus === 'disconnected'}
                isLoading={isSendingMessage}
                size="lg"
              />
            </Flex>
          </form>
        </Box>
      </Flex>
      
      <InviteModal 
        isOpen={showInviteModal} 
        onClose={() => setShowInviteModal(false)}
        chatId={chatId}
        inviteLink={window.location.href}
      />
    </Layout>
  );
};

export default ChatPage;
