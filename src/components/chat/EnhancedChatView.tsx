// src/components/chat/EnhancedChatView.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Box, 
  Flex, 
  Text, 
  Heading, 
  Badge, 
  IconButton, 
  Tooltip,
  HStack,
  VStack, 
  Button,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useDisclosure,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Avatar,
  useToast
} from '@chakra-ui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  FaUserPlus,  
  FaEllipsisV, 
  FaLock, 
  FaUsers, 
  FaArrowDown, 
  FaKey,
  FaShieldAlt,
  FaChartLine,
  FaLink,
  FaNetworkWired,
  FaUser,
  FaWallet,
  FaCog
} from 'react-icons/fa';
import { Message } from './Message';
import { MessageComposer } from './MessageComposer';
import { EncryptionIndicator } from './EncryptionIndicator';
import { useChat } from '../../hooks/useChat';
import { ConnectionIndicator } from '../ui/ConnectionIndicator';
import { useAuth } from '../../contexts/AuthContext';
import { InviteModal } from '../modals/InviteModal';
import { useNotifications } from '../../contexts/NotificationContext';

// Message animation variants
const messageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

// Extended connection status type
type ExtendedConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'p2p-connecting' | 'p2p-connected';

// Blockchain-inspired header component
interface BlockchainInspiredHeaderProps {
  chatName: string;
  participants: any[];
  connectionStatus: ExtendedConnectionStatus;
  onInvite: () => void;
  onOpenSettings: () => void;
}

const BlockchainInspiredHeader: React.FC<BlockchainInspiredHeaderProps> = ({ 
  chatName, 
  participants, 
  connectionStatus, 
  onInvite, 
  onOpenSettings 
}) => {
  const [showBlockInfo, setShowBlockInfo] = useState(false);
  
  // Simulated blockchain data
  const blockData = {
    lastBlockHeight: 12438765,
    blockTime: Date.now(),
    messageCount: 256,
    chainId: 'aero-' + Math.random().toString(36).substring(2, 10),
    consensus: 'encrypted-proof-of-message'
  };

  return (
    <Box 
      borderBottom="1px solid"
      borderColor="gray.700"
      p={4}
      position="relative"
      overflow="hidden"
    >
      {/* Blockchain-inspired background animation */}
      <Box 
        position="absolute" 
        top={0} 
        right={0} 
        bottom={0} 
        width="200px"
        opacity={0.05}
        pointerEvents="none"
        bgGradient="linear(to-r, transparent, purple.500)"
        zIndex={0}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <Box 
            key={i}
            position="absolute"
            top={`${i * 12}%`}
            right={`${Math.random() * 50}%`}
            width={`${Math.random() * 50 + 50}px`}
            height="2px"
            bg="purple.500"
            opacity={Math.random() * 0.7 + 0.3}
          />
        ))}
      </Box>
      
      <Flex justify="space-between" align="center" position="relative" zIndex={1}>
        <Flex align="center">
          <Box mr={3}>
            <IconButton
              aria-label="Encryption status"
              icon={<FaLock />}
              variant="ghost"
              colorScheme="purple"
              onClick={() => setShowBlockInfo(!showBlockInfo)}
            />
          </Box>
          
          <Box>
            <Heading size="md" fontWeight="semibold">{chatName}</Heading>
            <HStack spacing={3} mt={1}>
              <Badge 
                colorScheme={
                  connectionStatus === 'connected' ? 'green' :
                  connectionStatus === 'p2p-connected' ? 'purple' :
                  connectionStatus === 'connecting' || connectionStatus === 'p2p-connecting' ? 'yellow' :
                  'red'
                }
                px={2}
                py={0.5}
                borderRadius="full"
                display="flex"
                alignItems="center"
              >
                <Box 
                  w="6px" 
                  h="6px" 
                  borderRadius="full" 
                  bg={
                    connectionStatus === 'connected' || connectionStatus === 'p2p-connected' ? 'green.500' :
                    connectionStatus === 'connecting' || connectionStatus === 'p2p-connecting' ? 'yellow.500' :
                    'red.500'
                  }
                  mr={1}
                  boxShadow={`0 0 6px ${
                    connectionStatus === 'connected' || connectionStatus === 'p2p-connected' ? '#48BB78' :
                    connectionStatus === 'connecting' || connectionStatus === 'p2p-connecting' ? '#ECC94B' :
                    '#E53E3E'
                  }`}
                />
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
        
        <HStack>
          <Tooltip label="Invite to chat" placement="bottom">
            <IconButton
              aria-label="Invite to chat"
              icon={<FaUserPlus />}
              onClick={onInvite}
              colorScheme="purple"
              variant="ghost"
            />
          </Tooltip>
          
          <Menu placement="bottom-end" closeOnSelect>
          <MenuButton
            as={IconButton}
            aria-label="More options"
            icon={<FaEllipsisV />}
            variant="ghost"
            zIndex={2}
          />
          <MenuList zIndex={9999}>
            <MenuItem icon={<FaCog />} onClick={onOpenSettings}>Settings</MenuItem>
            <MenuItem icon={<FaKey />}>Encryption Details</MenuItem>
            <MenuItem icon={<FaUser />}>View Participants</MenuItem>
            <MenuItem icon={<FaWallet />}>Connect Wallet</MenuItem>
          </MenuList>
        </Menu>
        </HStack>
      </Flex>
      
      {/* Blockchain metadata information */}
      {showBlockInfo && (
        <Box 
          mt={2} 
          p={2} 
          borderRadius="md" 
          bg="gray.700"
          fontSize="xs"
          display="flex"
          flexWrap="wrap"
          justifyContent="space-between"
        >
          <HStack mr={4} mb={1}>
            <Box color="purple.500"><FaKey size={10} /></Box>
            <Text>Chain ID: {blockData.chainId}</Text>
          </HStack>
          
          <HStack mr={4} mb={1}>
            <Box color="blue.500"><FaChartLine size={10} /></Box>
            <Text>Block: #{blockData.lastBlockHeight}</Text>
          </HStack>
          
          <HStack mr={4} mb={1}>
            <Box color="green.500"><FaNetworkWired size={10} /></Box>
            <Text>Consensus: {blockData.consensus}</Text>
          </HStack>
          
          <HStack mb={1}>
            <Box color="orange.500"><FaLink size={10} /></Box>
            <Text>Messages: {blockData.messageCount}</Text>
          </HStack>
        </Box>
      )}
    </Box>
  );
};

// Participant type
interface Participant {
  id: string;
  displayName: string;
  isActive: boolean;
  wallet?: string;
}

// Participants list component
interface ParticipantsListProps {
  participants: Participant[];
  isOpen: boolean;
  onClose: () => void;
}

const ParticipantsList: React.FC<ParticipantsListProps> = ({ 
  participants, 
  isOpen, 
  onClose 
}) => {
  return (
    <Drawer
      isOpen={isOpen}
      placement="right"
      onClose={onClose}
      size="md"
    >
      <DrawerOverlay backdropFilter="blur(3px)" />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader borderBottomWidth="1px">
          <Flex align="center">
            <FaUsers style={{ marginRight: '12px' }} />
            Chat Participants ({participants.length})
          </Flex>
        </DrawerHeader>
        
        <DrawerBody p={4}>
          <VStack spacing={3} align="stretch">
            {participants.map((participant) => (
              <Flex 
                key={participant.id}
                p={3}
                borderRadius="md"
                bg="gray.700"
                align="center"
                justify="space-between"
                _hover={{
                  bg: "gray.600",
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s'
                }}
                cursor="pointer"
                transition="all 0.2s"
              >
                <HStack>
                  <Avatar 
                    name={participant.displayName} 
                    bg="purple.500" 
                    color="white" 
                    size="sm"
                  />
                  
                  <Box>
                    <Text fontWeight="medium">{participant.displayName}</Text>
                    <HStack spacing={2}>
                      <Badge
                        colorScheme={participant.isActive ? 'green' : 'gray'}
                        fontSize="xs"
                        variant="subtle"
                      >
                        {participant.isActive ? 'Online' : 'Offline'}
                      </Badge>
                      
                      {participant.wallet && (
                        <Tooltip label={participant.wallet}>
                          <Badge colorScheme="purple" fontSize="xs">
                            <Flex align="center">
                              <FaWallet size={8} style={{ marginRight: '4px' }} />
                              Wallet Connected
                            </Flex>
                          </Badge>
                        </Tooltip>
                      )}
                    </HStack>
                  </Box>
                </HStack>
                
                <Menu>
                  <MenuButton
                    as={IconButton}
                    icon={<FaEllipsisV />}
                    variant="ghost"
                    size="sm"
                  />
                  <MenuList>
                    <MenuItem icon={<FaUser />}>View Profile</MenuItem>
                    <MenuItem icon={<FaKey />}>View Public Key</MenuItem>
                  </MenuList>
                </Menu>
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

// Main chat view component
interface EnhancedChatViewProps {
  chatId: string;
}

export const EnhancedChatView: React.FC<EnhancedChatViewProps> = ({ chatId }) => {
  const { user } = useAuth();
  const toast = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [lastProcessedMessageId, setLastProcessedMessageId] = useState<string | null>(null);
  
  // Add notification context
  const { showNotification } = useNotifications();
  
  // Chat state
  const { 
    messages, 
    sendMessage, 
    participants,
    connectionStatus,
    chatInfo,
    error
  } = useChat(chatId);

  // Control the state of various panels
  const {
    isOpen: isParticipantsOpen,
    onOpen: onOpenParticipants,
    onClose: onCloseParticipants
  } = useDisclosure();
  
  const {
    isOpen: isInviteModalOpen,
    onOpen: onOpenInviteModal,
    onClose: onCloseInviteModal
  } = useDisclosure();
  
  const {
    isOpen: isSettingsOpen,
    onOpen: onOpenSettings,
    onClose: onCloseSettings
  } = useDisclosure();

  // Cast connection status to the extended type
  const extendedStatus = connectionStatus as ExtendedConnectionStatus;

  // Get encryption type
  const encryptionType = chatInfo?.encryptionType || 'standard';

  // Error handling
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
    } else if (messages.length > 0) {
      // If not at bottom, increment new message count
      setNewMessageCount(prev => prev + 1);
    }
  }, [messages.length, isAtBottom]);
  
  // Handle notifications for new messages
  useEffect(() => {
    if (messages.length === 0) return;
    
    // Get the latest message
    const latestMessage = messages[messages.length - 1];
    
    // Skip if we've already processed this message
    if (lastProcessedMessageId === latestMessage.id) return;
    
    // Skip if it's our own message
    if (latestMessage.senderId === user?.id) {
      setLastProcessedMessageId(latestMessage.id);
      return;
    }
    
    // Use optional chaining to safely check message status
    // This avoids the type error by handling undefined status safely
    const messageStatus = latestMessage.status;
    const isValidStatus = messageStatus === 'success' || messageStatus === 'delivered';
    
    // Skip if the message doesn't have a valid status
    if (!isValidStatus) return;
    
    // Check if message mentions the current user
    const hasMention = latestMessage.content?.includes(`@${user?.displayName}`) || false;
    
    // Find sender display name
    const senderName = participants.find(p => p.id === latestMessage.senderId)?.displayName || 
                      latestMessage.senderName || 
                      'Unknown User';
    
    // Create notification object
    const notificationMsg = {
      id: latestMessage.id,
      content: latestMessage.content || 'New message received',
      senderId: latestMessage.senderId,
      senderName: senderName,
      chatId: chatId,
      chatName: chatInfo?.name || 'Secure Chat',
      timestamp: latestMessage.timestamp || new Date().toISOString(),
      isDirectMessage: participants.length === 2,
      hasMention
    };
    
    // Show notification
    showNotification(notificationMsg);
    
    // Update the last processed message id
    setLastProcessedMessageId(latestMessage.id);
    
  }, [messages, user, chatId, chatInfo, participants, showNotification, lastProcessedMessageId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewMessageCount(0);
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    setIsAtBottom(isNearBottom);
    
    if (isNearBottom) {
      setNewMessageCount(0);
    }
  };

  // Get connection status indicator
  const getConnectionStatusIndicator = () => {
    if (extendedStatus === 'connecting' || extendedStatus === 'p2p-connecting') {
      return <ConnectionIndicator status="connecting" message="Connecting to secure channel..." />;
    } else if (extendedStatus === 'disconnected') {
      return <ConnectionIndicator status="error" message="Disconnected from secure channel, trying to reconnect..." />;
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
  
  // Generate invite link
  const getInviteLink = useCallback(() => {
    if (typeof window !== 'undefined') {
      return window.location.href;
    }
    return '';
  }, []);
  
  // Copy invite link
  const copyInviteLink = useCallback(() => {
    const link = getInviteLink();
    if (navigator.clipboard && link) {
      navigator.clipboard.writeText(link);
      toast({
        title: "Invite link copied",
        description: "Share this link to invite others to this secure chat",
        status: "success",
        duration: 2000,
      });
    }
  }, [getInviteLink, toast]);

  return (
    <Flex 
      direction="column" 
      h="calc(100vh - 80px)"
      position="relative"
      bg="gray.900"
    >
      {/* Connection status indicator */}
      {extendedStatus !== 'connected' && extendedStatus !== 'p2p-connected' && (
        <Box position="absolute" top="0" left="0" right="0" zIndex="10">
          {getConnectionStatusIndicator()}
        </Box>
      )}
      
      {/* Chat header */}
      <BlockchainInspiredHeader 
        chatName={chatInfo?.name || 'Secure Chat'}
        participants={participants}
        connectionStatus={extendedStatus}
        onInvite={onOpenInviteModal}
        onOpenSettings={onOpenSettings}
      />
      
      {/* Security status bar */}
      <EncryptionIndicator 
        type={encryptionType}
        isP2P={extendedStatus === 'p2p-connected'}
        participants={participants.length} 
      />
      
      {/* Messages container */}
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
            background: 'rgba(0,0,0,0.2)',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'purple.500',
            borderRadius: '24px',
          },
        }}
      >
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={messageVariants}
              transition={{ duration: 0.2 }}
            >
              <Message 
                message={message}
                previousMessage={index > 0 ? messages[index - 1] : null}
                showAvatar={shouldShowAvatar(message, index > 0 ? messages[index - 1] : null)}
                isOwnMessage={message.senderId === user?.id || message.senderId === user?.publicKey}
                onRetry={handleRetryMessage}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </Box>
      
      {/* Message composer */}
      <MessageComposer 
        onSendMessage={sendMessage}
        isEncrypted={true}
        encryptionType={encryptionType}
        isP2P={extendedStatus === 'p2p-connected'}
        chatId={chatId}
        isDisabled={extendedStatus !== 'connected' && extendedStatus !== 'p2p-connected'}
      />
      
      {/* New message indicator */}
      <AnimatePresence>
        {!isAtBottom && newMessageCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <Button
              position="absolute"
              bottom="80px"
              right="20px"
              colorScheme="purple"
              leftIcon={<FaArrowDown />}
              onClick={scrollToBottom}
              size="sm"
              borderRadius="full"
              px={4}
              boxShadow="md"
            >
              {newMessageCount} new message{newMessageCount !== 1 ? 's' : ''}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Participants panel */}
      <ParticipantsList 
        participants={participants} 
        isOpen={isParticipantsOpen} 
        onClose={onCloseParticipants}
      />
      
      {/* Invite modal */}
      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={onCloseInviteModal}
        chatId={chatId}
        inviteLink={getInviteLink()}
      />
    </Flex>
  );
};

// Helper function: determine if avatar should be shown
function shouldShowAvatar(currentMsg: any, prevMsg: any | null): boolean {
  if (!prevMsg) return true;
  // Check if sender changed or if messages are more than 5 minutes apart
  return currentMsg.senderId !== prevMsg.senderId || 
    (new Date(currentMsg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() > 300000);
}
