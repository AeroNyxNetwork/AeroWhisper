// src/components/chat/EnhancedChatView.tsx

import React, { useState, useRef, useEffect } from 'react';
import { Box, Flex, useColorMode, useTheme } from '@chakra-ui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { Message } from './Message';
import { MessageComposer } from './MessageComposer';
import { EncryptionIndicator } from './EncryptionIndicator';
import { useChat } from '../../hooks/useChat';
import { MessageType } from '../../types/chat';

interface EnhancedChatViewProps {
  chatId: string;
}

export const EnhancedChatView: React.FC<EnhancedChatViewProps> = ({ chatId }) => {
  const { colorMode } = useColorMode();
  const theme = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  
  const { 
    messages, 
    sendMessage, 
    participants,
    connectionStatus,
    chatInfo
  } = useChat(chatId);

  // Get encryption type from chatInfo or use default
  const encryptionType = chatInfo?.encryptionType || 'standard';

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

  return (
    <Flex 
      direction="column" 
      h="calc(100vh - 80px)"
      position="relative"
      bg={colorMode === 'dark' ? 'gray.900' : 'gray.50'}
    >
      {/* Security Status Bar */}
      <EncryptionIndicator 
        type={encryptionType}
        isP2P={connectionStatus === 'p2p-connected'}
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
        isP2P={connectionStatus === 'p2p-connected'}
        chatId={chatId}
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
