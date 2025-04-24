// src/components/chat/EnhancedChatInterface.tsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Box, 
  Flex,
  VStack,
  HStack,
  Text,
  IconButton,
  Input,
  Textarea,
  Avatar,
  Badge,
  Tooltip,
  useColorMode,
  useToast,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Spinner,
  useDisclosure,
  Collapse,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  SkeletonText,
  SkeletonCircle,
  Divider,
  Portal,
  Heading
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaPaperPlane, 
  FaSmile, 
  FaPaperclip, 
  FaEllipsisV, 
  FaUserPlus, 
  FaLock, 
  FaShieldAlt, 
  FaRegClock,
  FaInfoCircle,
  FaAngleDown,
  FaSearch,
  FaChevronLeft,
  FaChevronRight,
  FaTimes,
  FaUsers,
  FaArrowDown,
  FaCamera,
  FaFile,
  FaVideo,
  FaImage,
  FaCheck,
  FaCheckDouble,
  FaExclamationTriangle,
  FaSyncAlt,
  FaMicrophone,
  FaRobot,
  FaKey,
  FaLink,
  FaSort
} from 'react-icons/fa';

import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../contexts/AuthContext';
import { ReadReceipts } from './ReadReceipts';
import { MessageType, ChatInfo, Participant, ConnectionStatus } from '../../types/chat';

// Animation variants for messages
const messageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, x: -10, transition: { duration: 0.1 } }
};

// Animation variants for typing indicator
const typingVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 }
};

// Animation for dots in typing indicator
const typingDotVariants = {
  initial: { y: 0 },
  animate: (i: number) => ({
    y: [0, -5, 0],
    transition: {
      delay: i * 0.1,
      duration: 0.6,
      repeat: Infinity,
      repeatType: 'loop' as const 
    }
  })
};

// Animation for notifications
const notificationVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

// Typing indicator component
const TypingIndicator = () => {
  const { colorMode } = useColorMode();
  
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={typingVariants}
    >
      <Flex
        bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
        py={2}
        px={4}
        borderRadius="lg"
        maxW="100px"
        my={2}
      >
        <HStack spacing={1}>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              custom={i}
              variants={typingDotVariants}
              initial="initial"
              animate="animate"
            >
              <Box
                w="6px"
                h="6px"
                borderRadius="full"
                bg={colorMode === 'dark' ? 'gray.400' : 'gray.500'}
              />
            </motion.div>
          ))}
        </HStack>
      </Flex>
    </motion.div>
  );
};

// Date divider component
interface DateDividerProps {
  date: string;
}

const DateDivider: React.FC<DateDividerProps> = ({ date }) => {
  const { colorMode } = useColorMode();
  
  return (
    <Flex align="center" justify="center" my={4}>
      <Divider flex="1" borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'} />
      <Text
        mx={4}
        fontSize="xs"
        fontWeight="medium"
        color={colorMode === 'dark' ? 'gray.500' : 'gray.500'}
        px={3}
        py={1}
        borderRadius="full"
        bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
      >
        {date}
      </Text>
      <Divider flex="1" borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'} />
    </Flex>
  );
};

// Message component
interface MessageItemProps {
  message: MessageType;
  isOwnMessage: boolean;
  showAvatar: boolean;
  showStatus: boolean;
  previousMessage?: MessageType | null;
  onRetry?: (messageId: string, content: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isOwnMessage,
  showAvatar,
  showStatus,
  previousMessage,
  onRetry
}) => {
  const { colorMode } = useColorMode();
  const [showDetails, setShowDetails] = useState(false);
  
  // Format timestamp
  const formatTime = (timestamp: string | Date): string => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const getMessageBgColor = () => {
    if (isOwnMessage) {
      return colorMode === 'dark' ? 'purple.600' : 'purple.500';
    } else {
      return colorMode === 'dark' ? 'gray.700' : 'gray.200';
    }
  };
  
  const getMessageTextColor = () => {
    if (isOwnMessage) {
      return 'white';
    } else {
      return colorMode === 'dark' ? 'white' : 'gray.800';
    }
  };
  
  return (
    <motion.div
      variants={messageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      layout
    >
      <Flex
        direction="column"
        alignSelf={isOwnMessage ? 'flex-end' : 'flex-start'}
        maxW={{ base: '85%', md: '70%' }}
        mb={2}
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
          {/* Avatar for other's messages */}
          {!isOwnMessage && showAvatar && (
            <Avatar
              size="xs"
              name={message.senderName || 'Unknown'}
              mr={2}
              bg="purple.500"
            />
          )}
          
          <Box
            bg={getMessageBgColor()}
            color={getMessageTextColor()}
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
                ? colorMode === 'dark' ? 'purple.500' : 'purple.400'
                : colorMode === 'dark' ? 'gray.600' : 'gray.300'
            }}
          >
            <Text mb={1}>{message.content}</Text>
            
            {/* Message metadata */}
            <Flex
              justify="flex-end"
              align="center"
              opacity={0.7}
              fontSize="xs"
            >
              <Text mr={1}>{formatTime(message.timestamp)}</Text>
              
              {/* Read receipt status */}
              {isOwnMessage && showStatus && (
                <ReadReceipts
                  status={message.status || 'sent'}
                  timestamp={message.timestamp}
                />
              )}
            </Flex>
            
            {/* Encryption indicator */}
            {message.isEncrypted && (
              <Tooltip label="End-to-end encrypted" placement="top">
                <Box
                  position="absolute"
                  bottom={1}
                  left={isOwnMessage ? -4 : undefined}
                  right={!isOwnMessage ? -4 : undefined}
                  fontSize="10px"
                >
                  <FaLock size={8} />
                </Box>
              </Tooltip>
            )}
          </Box>
          
          {/* Avatar for own messages */}
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
        {message.status === 'failed' && isOwnMessage && onRetry && (
          <Button
            size="xs"
            variant="ghost"
            colorScheme="red"
            mt={1}
            alignSelf="flex-end"
            onClick={() => onRetry(message.id, message.content)}
          >
            Retry
          </Button>
        )}
        
        {/* Message details */}
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
              Sent: {new Date(message.timestamp).toLocaleString()}
            </Text>
            {message.metaData && message.metaData.encryptionType && (
              <Text>
                Encryption: {message.metaData.encryptionType}
              </Text>
            )}
          </Box>
        )}
      </Flex>
    </motion.div>
  );
};

// Connection status indicator
interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus;
}

const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({ status }) => {
  const { colorMode } = useColorMode();
  
  const getStatusDetails = () => {
    switch (status) {
      case 'connected':
        return { color: 'green', text: 'Connected' };
      case 'connecting':
        return { color: 'yellow', text: 'Connecting...' };
      case 'p2p-connected':
        return { color: 'purple', text: 'P2P Connected' };
      case 'p2p-connecting':
        return { color: 'yellow', text: 'P2P Connecting...' };
      case 'disconnected':
      default:
        return { color: 'red', text: 'Disconnected' };
    }
  };
  
  const statusInfo = getStatusDetails();
  
  return (
    <Flex
      position="absolute"
      top={0}
      left={0}
      right={0}
      zIndex={10}
      bg={statusInfo.color === 'green' ? 'transparent' : (
        statusInfo.color === 'yellow' ? 'yellow.500' : 'red.500'
      )}
      px={4}
      py={2}
      align="center"
      justify="center"
      color="white"
      fontWeight="medium"
    >
      {status !== 'connected' && status !== 'p2p-connected' && (
        <>
          {status === 'connecting' || status === 'p2p-connecting' ? (
            <Spinner size="xs" mr={2} />
          ) : (
            <FaExclamationTriangle style={{ marginRight: '8px' }} />
          )}
          {statusInfo.text}
        </>
      )}
    </Flex>
  );
};

// Encryption info indicator
interface EncryptionInfoProps {
  encryptionType: 'standard' | 'high' | 'maximum';
  isP2P: boolean;
  participantCount: number;
}

const EncryptionInfo: React.FC<EncryptionInfoProps> = ({ 
  encryptionType, 
  isP2P, 
  participantCount 
}) => {
  const { colorMode } = useColorMode();
  
  const getEncryptionColor = () => {
    switch (encryptionType) {
      case 'maximum':
        return 'green';
      case 'high':
        return 'teal';
      case 'standard':
      default:
        return 'blue';
    }
  };
  
  return (
    <Box
      py={2}
      px={4}
      borderBottom="1px solid"
      borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
      bg={colorMode === 'dark' ? 'gray.800' : 'gray.50'}
    >
      <Flex justify="space-between" align="center">
        <HStack spacing={3}>
          <Tooltip
            label={`${encryptionType.charAt(0).toUpperCase() + encryptionType.slice(1)} encryption enabled`}
            placement="bottom"
            hasArrow
          >
            <Badge
              colorScheme={getEncryptionColor()}
              display="flex"
              alignItems="center"
              px={2}
              py={1}
              borderRadius="full"
            >
              <FaLock style={{ marginRight: '4px' }} />
              <Text fontSize="xs">
                Encrypted {encryptionType !== 'standard' && `(${encryptionType})`}
              </Text>
            </Badge>
          </Tooltip>
          
          {isP2P && (
            <Tooltip
              label="Peer-to-peer connection active"
              placement="bottom"
              hasArrow
            >
              <Badge
                colorScheme="purple"
                display="flex"
                alignItems="center"
                px={2}
                py={1}
                borderRadius="full"
              >
                <FaLink style={{ marginRight: '4px' }} />
                <Text fontSize="xs">P2P</Text>
              </Badge>
            </Tooltip>
          )}
        </HStack>
        
        <Tooltip
          label={`${participantCount} participant${participantCount !== 1 ? 's' : ''} in this chat`}
          placement="bottom"
          hasArrow
        >
          <Flex align="center">
            <FaUsers style={{ marginRight: '4px', fontSize: '12px' }} />
            <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
              {participantCount}
            </Text>
          </Flex>
        </Tooltip>
      </Flex>
    </Box>
  );
};

// Message composer
interface MessageComposerProps {
  onSendMessage: (text: string) => Promise<void>;
  isDisabled: boolean;
  isEncrypted: boolean;
  isP2P: boolean;
}

const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  isDisabled,
  isEncrypted,
  isP2P
}) => {
  const { colorMode } = useColorMode();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();
  
  // Handle sending message
  const handleSendMessage = async () => {
    if (!message.trim() || isDisabled || isSending) return;
    
    setIsSending(true);
    try {
      await onSendMessage(message);
      setMessage('');
      // Focus back on textarea
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: "Failed to send message",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSending(false);
    }
  };
  
  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Check for Ctrl/Cmd + Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Auto-resize textarea based on content
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };
  
  return (
    <Box
      p={3}
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      borderTop="1px solid"
      borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
    >
      {/* Encryption status */}
      <Flex justify="space-between" align="center" mb={2}>
        <Tooltip
          label={`Messages are ${isP2P ? 'peer-to-peer ' : ''}${isEncrypted ? 'encrypted' : 'not encrypted'}`}
          placement="top"
        >
          <Flex align="center" opacity={0.7}>
            <FaLock style={{ marginRight: '4px', fontSize: '12px' }} color={isEncrypted ? 'green' : 'red'} />
            <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
              {isEncrypted ? (
                isP2P ? 'P2P Encrypted' : 'Encrypted'
              ) : (
                'Not Encrypted'
              )}
            </Text>
          </Flex>
        </Tooltip>
        
        <Tooltip label="Ctrl+Enter to send" placement="top">
          <Flex align="center" opacity={0.7}>
            <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
              Ctrl+Enter to send
            </Text>
          </Flex>
        </Tooltip>
      </Flex>
      
      {/* Composer area */}
      <Flex>
        <Box
          flex="1"
          mr={2}
          borderRadius="md"
          bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
          overflow="hidden"
        >
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={isDisabled ? "Waiting for connection..." : "Type a message..."}
            border="none"
            _focus={{ border: 'none', boxShadow: 'none' }}
            minH="40px"
            maxH="150px"
            resize="none"
            py={2}
            px={3}
            disabled={isDisabled}
          />
          
          {/* Attachment and emoji toolbar */}
          <Flex p={1} borderTop="1px solid" borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}>
            <HStack spacing={1}>
              <Tooltip label="Add emoji" placement="top">
                <IconButton
                  aria-label="Add emoji"
                  icon={<FaSmile />}
                  size="sm"
                  variant="ghost"
                  isDisabled={isDisabled}
                />
              </Tooltip>
              
              <Menu>
                <MenuButton
                  as={IconButton}
                  aria-label="Attach file"
                  icon={<FaPaperclip />}
                  size="sm"
                  variant="ghost"
                  isDisabled={isDisabled}
                />
                <MenuList>
                  <MenuItem icon={<FaImage />}>
                    Image
                  </MenuItem>
                  <MenuItem icon={<FaVideo />}>
                    Video
                  </MenuItem>
                  <MenuItem icon={<FaFile />}>
                    Document
                  </MenuItem>
                  <MenuItem icon={<FaCamera />}>
                    Camera
                  </MenuItem>
                </MenuList>
              </Menu>
              
              <Tooltip label="Record voice message" placement="top">
                <IconButton
                  aria-label="Record voice message"
                  icon={<FaMicrophone />}
                  size="sm"
                  variant="ghost"
                  isDisabled={isDisabled}
                />
              </Tooltip>
            </HStack>
          </Flex>
        </Box>
        
        <Tooltip label="Send message" placement="top">
          <IconButton
            aria-label="Send message"
            icon={<FaPaperPlane />}
            colorScheme="purple"
            borderRadius="md"
            onClick={handleSendMessage}
            isLoading={isSending}
            isDisabled={!message.trim() || isDisabled}
          />
        </Tooltip>
      </Flex>
    </Box>
  );
};

// Participants panel component
interface ParticipantsPanelProps {
  participants: Participant[];
  isOpen: boolean;
  onClose: () => void;
}

const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({ 
  participants, 
  isOpen, 
  onClose 
}) => {
  const { colorMode } = useColorMode();
  
  return (
    <Drawer
      isOpen={isOpen}
      placement="right"
      onClose={onClose}
      size="md"
    >
      <DrawerOverlay />
      <DrawerContent bg={colorMode === 'dark' ? 'gray.800' : 'white'}>
        <DrawerCloseButton />
        <DrawerHeader borderBottomWidth="1px">
          Chat Participants ({participants.length})
        </DrawerHeader>
        
        <DrawerBody>
          <VStack spacing={4} align="stretch" mt={4}>
            {participants.map((participant) => (
              <Flex 
                key={participant.id}
                p={3}
                borderRadius="md"
                bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
                align="center"
              >
                <Avatar 
                  size="sm" 
                  name={participant.displayName} 
                  mr={3}
                  bg="purple.500"
                />
                <Box flex="1">
                  <Text fontWeight="medium">{participant.displayName}</Text>
                  <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    {participant.isActive ? 'Online' : 'Offline'}
                  </Text>
                </Box>
                {participant.isActive && (
                  <Badge colorScheme="green" borderRadius="full">
                    Active
                  </Badge>
                )}
              </Flex>
            ))}
            
            {participants.length === 0 && (
              <Text color="gray.500" textAlign="center" py={10}>
                No participants found
              </Text>
            )}
          </VStack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
};

// New message notification
interface NewMessageNotificationProps {
  onScrollToBottom: () => void;
  count: number;
}

const NewMessageNotification: React.FC<NewMessageNotificationProps> = ({ 
  onScrollToBottom, 
  count 
}) => {
  const { colorMode } = useColorMode();
  
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={notificationVariants}
    >
      <Button
        position="absolute"
        bottom="80px"
        right="20px"
        leftIcon={<FaArrowDown />}
        bg={colorMode === 'dark' ? 'purple.600' : 'purple.500'}
        color="white"
        size="sm"
        shadow="md"
        _hover={{ bg: colorMode === 'dark' ? 'purple.500' : 'purple.400' }}
        onClick={onScrollToBottom}
      >
        {count} new message{count !== 1 ? 's' : ''}
      </Button>
    </motion.div>
  );
};

// Date formatting helper
const formatDateForGroup = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();
  
  if (isToday) {
    return 'Today';
  } else if (isYesterday) {
    return 'Yesterday';
  } else {
    // Format as "Month Day, Year"
    return date.toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }
};

// Main EnhancedChatInterface component
interface EnhancedChatInterfaceProps {
  chatId: string;
}

export const EnhancedChatInterface: React.FC<EnhancedChatInterfaceProps> = ({ chatId }) => {
  const { 
    messages, 
    sendMessage, 
    participants, 
    connectionStatus, 
    chatInfo, 
    refreshParticipants,
    error
  } = useChat(chatId);
  
  const { user } = useAuth();
  const { colorMode } = useColorMode();
  const toast = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const { isOpen: isParticipantsPanelOpen, onOpen: onOpenParticipantsPanel, onClose: onCloseParticipantsPanel } = useDisclosure();
  
  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { [key: string]: MessageType[] } = {};
    
    messages.forEach(message => {
      const messageDate = new Date(message.timestamp);
      const dateKey = messageDate.toDateString();
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      
      groups[dateKey].push(message);
    });
    
    return groups;
  }, [messages]);
  
  // Sort group keys by date
  const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedMessages).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }, [groupedMessages]);
  
  // Scroll to bottom on new messages if already at bottom
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    } else if (messages.length > 0) {
      // Increment new message count if not at bottom
      setNewMessageCount(prev => prev + 1);
    }
  }, [messages.length, isAtBottom]);
  
  // Handle connection error
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
  
  // Scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewMessageCount(0);
  };
  
  // Handle scroll to detect if at bottom
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isCloseToBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    setIsAtBottom(isCloseToBottom);
    
    if (isCloseToBottom) {
      setNewMessageCount(0);
    }
  };
  
  // Send message handler
  const handleSendMessage = async (text: string) => {
    try {
      await sendMessage(text);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: "Error sending message",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  // Retry failed message
  const handleRetryMessage = (messageId: string, content: string) => {
    return sendMessage(content);
  };
  
  // Determine if avatar should be shown for a message
  const shouldShowAvatar = (message: MessageType, index: number, groupMessages: MessageType[]): boolean => {
    if (index === 0) return true;
    
    const prevMessage = groupMessages[index - 1];
    return (
      message.senderId !== prevMessage.senderId ||
      (new Date(message.timestamp).getTime() - new Date(prevMessage.timestamp).getTime() > 5 * 60 * 1000)
    );
  };
  
  // Get appropriate encryption type
  const getEncryptionType = (): 'standard' | 'high' | 'maximum' => {
    return chatInfo?.encryptionType || 'standard';
  };
  
  // Check if P2P is active
  const isP2PActive = (): boolean => {
    return connectionStatus === 'p2p-connected';
  };
  
  return (
    <Flex 
      direction="column"
      h="100vh"
      maxH="calc(100vh - 80px)"
      position="relative"
      overflow="hidden"
      bg={colorMode === 'dark' ? 'gray.900' : 'gray.50'}
    >
      {/* Connection status indicator */}
      <ConnectionStatusIndicator status={connectionStatus} />
      
      {/* Chat header */}
      <Flex 
        px={4} 
        py={3} 
        borderBottom="1px solid" 
        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
        borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
        align="center"
        justify="space-between"
      >
        <Flex align="center">
          <Box>
            <Heading size="md" mb={1}>{chatInfo?.name || 'Chat'}</Heading>
            <HStack spacing={3}>
              <Badge colorScheme={
                connectionStatus === 'connected' ? 'green' :
                connectionStatus === 'p2p-connected' ? 'purple' :
                connectionStatus === 'connecting' || connectionStatus === 'p2p-connecting' ? 'yellow' :
                'red'
              }>
                {connectionStatus === 'connected' ? 'Connected' :
                 connectionStatus === 'p2p-connected' ? 'P2P Connected' :
                 connectionStatus === 'connecting' ? 'Connecting' :
                 connectionStatus === 'p2p-connecting' ? 'P2P Connecting' :
                 'Disconnected'}
              </Badge>
              <Flex align="center">
                <FaUsers size={14} style={{ marginRight: '6px' }} />
                <Text fontSize="sm">{participants.length} {participants.length === 1 ? 'participant' : 'participants'}</Text>
              </Flex>
            </HStack>
          </Box>
        </Flex>
        
        <HStack spacing={2}>
          <Tooltip label="View participants" placement="top">
            <IconButton
              aria-label="View participants"
              icon={<FaUsers />}
              variant="ghost"
              onClick={onOpenParticipantsPanel}
            />
          </Tooltip>
          
          <Menu>
            <MenuButton
              as={IconButton}
              aria-label="More options"
              icon={<FaEllipsisV />}
              variant="ghost"
            />
            <MenuList>
              <MenuItem icon={<FaUserPlus />}>Invite others</MenuItem>
              <MenuItem icon={<FaSearch />}>Search messages</MenuItem>
              <MenuDivider />
              <MenuItem icon={<FaSort />}>Sort by newest</MenuItem>
              <MenuItem icon={<FaKey />}>View encryption info</MenuItem>
            </MenuList>
          </Menu>
        </HStack>
      </Flex>
      
      {/* Encryption info */}
      <EncryptionInfo 
        encryptionType={getEncryptionType()} 
        isP2P={isP2PActive()} 
        participantCount={participants.length} 
      />
      
      {/* Messages Container */}
      <Box
        flex="1"
        overflowY="auto"
        px={4}
        py={2}
        ref={messagesContainerRef}
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
            background: 'purple.500',
            borderRadius: '24px',
          },
        }}
      >
        <AnimatePresence initial={false}>
          {sortedGroupKeys.map(dateKey => {
            const messagesInGroup = groupedMessages[dateKey];
            const formattedDate = formatDateForGroup(new Date(dateKey));
            
            return (
              <React.Fragment key={dateKey}>
                <DateDivider date={formattedDate} />
                
                {messagesInGroup.map((message, index) => (
                  <MessageItem
                    key={message.id}
                    message={message}
                    isOwnMessage={message.senderId === user?.id}
                    showAvatar={shouldShowAvatar(message, index, messagesInGroup)}
                    showStatus={true}
                    previousMessage={index > 0 ? messagesInGroup[index - 1] : null}
                    onRetry={handleRetryMessage}
                  />
                ))}
              </React.Fragment>
            );
          })}
        </AnimatePresence>
        
        {/* Typing indicator */}
        <AnimatePresence>
          {typingUsers.length > 0 && (
            <TypingIndicator />
          )}
        </AnimatePresence>
        
        {/* Reference for scrolling to bottom */}
        <div ref={messagesEndRef} />
      </Box>
      
      {/* Message composer */}
      <MessageComposer
        onSendMessage={handleSendMessage}
        isDisabled={connectionStatus !== 'connected' && connectionStatus !== 'p2p-connected'}
        isEncrypted={true}
        isP2P={isP2PActive()}
      />
      
      {/* New message notification */}
      <AnimatePresence>
        {!isAtBottom && newMessageCount > 0 && (
          <NewMessageNotification
            onScrollToBottom={scrollToBottom}
            count={newMessageCount}
          />
        )}
      </AnimatePresence>
      
      {/* Participants panel */}
      <ParticipantsPanel
        participants={participants}
        isOpen={isParticipantsPanelOpen}
        onClose={onCloseParticipantsPanel}
      />
    </Flex>
  );
};

export default EnhancedChatInterface;
