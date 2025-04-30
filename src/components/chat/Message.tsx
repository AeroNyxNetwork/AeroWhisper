// src/components/chat/Message.tsx
import React, { useState } from 'react';
import { Box, Text, Flex, Avatar, useColorMode, Tooltip, Icon, Button } from '@chakra-ui/react';
import { FaCheck, FaCheckDouble, FaClock, FaTimes, FaLock } from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';
import { MessageType } from '../../types/chat';

interface MessageProps {
  message: MessageType;
  previousMessage?: MessageType | null;
  isOwnMessage?: boolean;
  showAvatar?: boolean;
  onRetry?: (messageId: string, content: string) => void;
}

export const Message: React.FC<MessageProps> = ({ 
  message, 
  previousMessage = null, 
  isOwnMessage = false, 
  showAvatar = true,
  onRetry
}) => {
  const { colorMode } = useColorMode();
  const [showDetails, setShowDetails] = useState(false);

  if (process.env.NODE_ENV === 'development') {
    console.debug('[UI:Message] Rendering message:', {
      id: message.id,
      isOwnMessage,
      contentLength: message.content?.length || 0,
      contentPreview: message.content?.length > 30 ? message.content.substring(0, 30) + '...' : message.content,
      sender: message.senderId,
      senderName: message.senderName,
      status: message.status,
      isEncrypted: message.isEncrypted,
      timestamp: typeof message.timestamp === 'string' ? message.timestamp : message.timestamp?.toISOString()
    });
  }
  
  // Convert timestamp to Date if it's a string or number
  const messageDate = typeof message.timestamp === 'string' || typeof message.timestamp === 'number' 
    ? new Date(message.timestamp) 
    : message.timestamp;
  
  const timeAgo = formatDistanceToNow(messageDate, { addSuffix: true });
  
  // Improved status indicator
  const getStatusIndicator = () => {
    if (isOwnMessage) {
      if (message.status === 'sending') {
        return <Icon as={FaClock} fontSize="xs" color="gray.400" />; // Changed boxSize to fontSize
      } else if (message.status === 'sent') {
        return <Icon as={FaCheck} fontSize="xs" color="gray.500" />; // Changed boxSize to fontSize
      } else if (message.status === 'delivered') {
        return <Icon as={FaCheckDouble} fontSize="xs" color="gray.500" />; // Changed boxSize to fontSize
      } else if (message.status === 'read') {
        return <Icon as={FaCheckDouble} fontSize="xs" color="blue.500" />; // Changed boxSize to fontSize
      } else if (message.status === 'failed') {
        return <Icon as={FaTimes} fontSize="xs" color="red.500" />; // Changed boxSize to fontSize
      }
    }
    return null;
  };
  
  // Add retry functionality
  const handleRetry = () => {
    if (onRetry && message.status === 'failed') {
      onRetry(message.id, message.content);
    }
  };
  
  return (
    <Flex
      direction="column"
      alignSelf={isOwnMessage ? 'flex-end' : 'flex-start'}
      maxW={{ base: '80%', md: '70%' }}
    >
      {showAvatar && !isOwnMessage && message.senderName && (
        <Text 
          fontSize="xs" 
          ml={2} 
          mb={1}
          color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}
        >
          {message.senderName}
        </Text>
      )}
      
      <Flex align="flex-end">
        {!isOwnMessage && showAvatar && (
          <Avatar 
            size="xs" 
            name={message.senderName || 'Unknown'} 
            mr={2} 
            bg="purple.500"
          />
        )}
        
        <Box
          bg={isOwnMessage 
            ? (colorMode === 'dark' ? 'purple.600' : 'purple.500') 
            : (colorMode === 'dark' ? 'gray.700' : 'gray.200')
          }
          color={isOwnMessage 
            ? 'white' 
            : (colorMode === 'dark' ? 'white' : 'gray.800')
          }
          px={4}
          py={2}
          borderRadius="lg"
          borderBottomLeftRadius={!isOwnMessage ? 0 : undefined}
          borderBottomRightRadius={isOwnMessage ? 0 : undefined}
          onClick={() => setShowDetails(!showDetails)}
          cursor="pointer"
          position="relative"
          _hover={{
            bg: isOwnMessage 
              ? (colorMode === 'dark' ? 'purple.500' : 'purple.400') 
              : (colorMode === 'dark' ? 'gray.600' : 'gray.300')
          }}
        >
          <Text mb={1}>{message.content}</Text>
          
          {/* Show encryption status and delivery status */}
          <Flex 
            justify="flex-end" 
            align="center"
            opacity={0.7}
            fontSize="xs"
          >
            <Text mr={1}>{timeAgo}</Text>
            {getStatusIndicator()}
            
            {/* Show encryption icon */}
            {message.isEncrypted && (
              <Tooltip label="End-to-end encrypted" placement="top">
                <Icon as={FaLock} fontSize="10px" ml={1} color="green.500" />
              </Tooltip>
            )}
          </Flex>
          
          {message.isEncrypted && (
            <Tooltip label="End-to-end encrypted" placement="top">
              <Box
                position="absolute"
                bottom={1}
                left={isOwnMessage ? -4 : undefined}
                right={!isOwnMessage ? -4 : undefined}
                fontSize="10px"
              >
                🔒
              </Box>
            </Tooltip>
          )}
        </Box>
        
        {isOwnMessage && showAvatar && (
          <Avatar 
            size="xs" 
            name="Me" 
            ml={2}
            bg="purple.600"
          />
        )}
      </Flex>
      
      {/* Message retry button when failed */}
      {message.status === 'failed' && isOwnMessage && (
        <Button 
          size="xs" 
          variant="ghost" 
          colorScheme="red" 
          mt={1} 
          alignSelf="flex-end"
          onClick={handleRetry}
        >
          Retry
        </Button>
      )}
      
      {showDetails && (
        <Box 
          mt={1} 
          fontSize="xs" 
          alignSelf={isOwnMessage ? 'flex-end' : 'flex-start'}
          mx={2}
          px={2}
          py={1}
          bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
          borderRadius="md"
        >
          <Text>
            Sent: {messageDate.toLocaleString()}
          </Text>
          {message.metaData && message.metaData.encryptionType && (
            <Text>
              Encryption: {message.metaData.encryptionType}
            </Text>
          )}
        </Box>
      )}
    </Flex>
  );
};
