// src/components/chat/EnhancedChatView.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Box, Flex, useColorMode, useTheme, useToast } from '@chakra-ui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { Message } from './Message';
import { MessageComposer } from './MessageComposer';
import { EncryptionIndicator } from './EncryptionIndicator';
import { useChat } from '../../hooks/useChat';
import { MessageType } from '../../types/chat';
import { ConnectionIndicator } from '../ui/ConnectionIndicator';
import { useAuth } from '../../contexts/AuthContext';

interface EnhancedChatViewProps {
  chatId: string;
}

// Define a custom type that includes the p2p connection states
type ExtendedConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'p2p-connecting' | 'p2p-connected';

export const EnhancedChatView: React.FC<EnhancedChatViewProps> = ({ chatId }) => {
  const { colorMode } = useColorMode();
  const { user } = useAuth();
  const theme = useTheme();
  const toast = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  
  const { 
    messages, 
    sendMessage, 
    participants,
    connectionStatus,
    chatInfo,
    error
  } = useChat(chatId);

  // Cast connectionStatus to extended type for use throughout the component
  const extendedStatus = connectionStatus as ExtendedConnectionStatus;

  // Get encryption type from chatInfo or use default
  const encryptionType = chatInfo?.encryptionType || 'standard';

  // Handle errors
  useEffect(() => {
    if (error) {
      toast({
        title: "Connection Error",
        description: error.message || "Unable to connect to chat server",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  }, [error, toast]);

  // Scroll handling logic
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, isAtBottom]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const bottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop === e.currentTarget.clientHeight;
    setIsAtBottom(bottom);
  };

  // Add connection status indicator
  const getConnectionStatusIndicator = () => {
    if (extendedStatus === 'connecting' || extendedStatus === 'p2p-connecting') {
      return <ConnectionIndicator status="connecting" message="Connecting..." />;
    } else if (extendedStatus === 'disconnected') {
      return <ConnectionIndicator status="error" message="Disconnected, trying to reconnect..." />;
    }
    return null;
  };

  // Message retry handler
  const handleRetryMessage = (messageId: string, content: string) => {
    // Find the failed message
    const failedMessage = messages.find(m => m.id === messageId);
    if (failedMessage && failedMessage.status === 'failed') {
      // Resend the message
      sendMessage(content);
    }
  };

  return (
    <Flex 
      direction="column" 
      h="calc(100vh - 80px)"
      position="relative"
      bg={colorMode === 'dark' ? 'gray.900' : 'gray.50'}
    >
      {/* Connection status indicator */}
      {extendedStatus !== 'connected' && extendedStatus !== 'p2p-connected' && (
        <Box position="absolute" top="0" left="0" right="0" zIndex="10">
          {getConnectionStatusIndicator()}
        </Box>
      )}
      
      {/* Security Status Bar */}
      <EncryptionIndicator 
        type={encryptionType}
        isP2P={extendedStatus === 'p2p-connected'}
        participants={participants.length}
      />
      
      {/* Messages Container */}
      <Box 
        flex="1" 
        overflowY="auto"
        px={4}
        py={2}
        onScroll={handleScroll}
        css={{
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            width: '6px',
            background: colorMode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)',
          },
          '&::-webkit-scrollbar-thumb': {
            background: theme.colors.purple[500],
            borderRadius: '24px',
          },
        }}
      >
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Message 
                message={message}
                previousMessage={index > 0 ? messages[index - 1] : null}
                showAvatar={shouldShowAvatar(message, index > 0 ? messages[index - 1] : null)}
                isOwnMessage={message.senderId === chatInfo?.createdBy}
                onRetry={handleRetryMessage}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </Box>
      
      {/* Message Composer */}
      <MessageComposer 
        onSendMessage={sendMessage}
        isEncrypted={true}
        encryptionType={encryptionType}
        isP2P={extendedStatus === 'p2p-connected'}
        chatId={chatId}
        isDisabled={extendedStatus !== 'connected' && extendedStatus !== 'p2p-connected'}
      />
      
      {/* New Message Indicator */}
      {!isAtBottom && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
        >
          <Box
            position="absolute"
            bottom="80px"
            right="20px"
            bg={colorMode === 'dark' ? 'purple.600' : 'purple.500'}
            color="white"
            py={2}
            px={4}
            borderRadius="full"
            boxShadow="md"
            cursor="pointer"
            onClick={scrollToBottom}
          >
            New messages ↓
          </Box>
        </motion.div>
      )}
    </Flex>
  );
};

// Helper function to determine if avatar should be shown
function shouldShowAvatar(currentMsg: MessageType, prevMsg: MessageType | null): boolean {
  if (!prevMsg) return true;
  // Check if sender changed or if messages are more than 5 minutes apart
  return currentMsg.senderId !== prevMsg.senderId || 
    (new Date(currentMsg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() > 300000);
}
