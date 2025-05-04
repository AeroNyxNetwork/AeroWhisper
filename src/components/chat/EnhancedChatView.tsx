// src/components/chat/EnhancedChatView.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Box, 
  Flex, 
  useColorMode, 
  useTheme, 
  useToast, 
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
  AvatarGroup,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverFooter,
  PopoverArrow,
  Divider,
  Skeleton,
  Image,
} from '@chakra-ui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  FaBell, 
  FaBellSlash, 
  FaUserPlus, 
  FaCog, 
  FaEllipsisV, 
  FaEthereum, 
  FaLock, 
  FaWallet, 
  FaRocket, 
  FaUsers, 
  FaUser, 
  FaPaperPlane, 
  FaArrowDown, 
  FaExclamationTriangle,
  FaChevronDown,
  FaChevronUp,
  FaChevronRight,
  FaKey,
  FaShieldAlt,
  FaChartLine,
  FaLink,
  FaNetworkWired,
  FaCopy,
  FaSun,
  FaMoon,
} from 'react-icons/fa';
import { Message } from './Message';
import { MessageComposer } from './MessageComposer';
import { EncryptionIndicator } from './EncryptionIndicator';
import { useChat } from '../../hooks/useChat';
import { ConnectionIndicator } from '../ui/ConnectionIndicator';
import { useAuth } from '../../contexts/AuthContext';
import { InviteModal } from '../modals/InviteModal';

// Define message animation variants
const messageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

// Type for the extended connection status
type ExtendedConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'p2p-connecting' | 'p2p-connected';



interface BlockchainInspiredHeaderProps {
  chatName: string;
  participants: any[]; // Replace with the actual type of participants if known
  connectionStatus: ExtendedConnectionStatus; // Use the same type that you defined for ChatHeader
  onInvite: () => void;
  onOpenSettings: () => void;
}



// New component: BlockchainInspiredHeader
const BlockchainInspiredHeader: React.FC<BlockchainInspiredHeaderProps> = ({ 
  chatName, 
  participants, 
  connectionStatus, 
  onInvite, 
  onOpenSettings 
}) => {
  const { colorMode } = useColorMode();
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
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      borderBottom="1px solid"
      borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
      p={4}
      position="relative"
      overflow="hidden"
    >
      {/* Animated "blockchain" background element */}
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
          
          <Menu>
            <MenuButton
              as={IconButton}
              aria-label="More options"
              icon={<FaEllipsisV />}
              variant="ghost"
            />
            <MenuList>
              <MenuItem icon={<FaCog />} onClick={onOpenSettings}>Settings</MenuItem>
              <MenuItem icon={<FaKey />}>Encryption Details</MenuItem>
              <MenuItem icon={<FaUser />}>View Participants</MenuItem>
              <MenuItem icon={<FaWallet />}>Connect Wallet</MenuItem>
            </MenuList>
          </Menu>
        </HStack>
      </Flex>
      
      {/* Blockchain-inspired metadata */}
      {showBlockInfo && (
        <Box 
          mt={2} 
          p={2} 
          borderRadius="md" 
          bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
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

// New component: ParticipantsList
const ParticipantsList = ({ participants, isOpen, onClose }) => {
  const { colorMode } = useColorMode();
  
  return (
    <Drawer
      isOpen={isOpen}
      placement="right"
      onClose={onClose}
      size="md"
    >
      <DrawerOverlay backdropFilter="blur(3px)" />
      <DrawerContent bg={colorMode === 'dark' ? 'gray.800' : 'white'}>
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
                bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
                align="center"
                justify="space-between"
                _hover={{
                  bg: colorMode === 'dark' ? 'gray.600' : 'gray.200',
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
                    <MenuItem icon={<FaRocket />}>Send Direct Message</MenuItem>
                  </MenuList>
                </Menu>
              </Flex>
            ))}
          </VStack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
};


interface EnhancedChatViewProps {
  chatId: string;
}

export const EnhancedChatView: React.FC<EnhancedChatViewProps> = ({ chatId }) => {
  const { colorMode, toggleColorMode } = useColorMode();
  const { user } = useAuth();
  const theme = useTheme();
  const toast = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  
  // Simulated blockchain-inspired features
  const [txPending, setTxPending] = useState(false);
  const [gasSettings, setGasSettings] = useState({ priority: 'medium' });
  const [encryptionStrength, setEncryptionStrength] = useState('high');
  
  // Chat state
  const { 
    messages, 
    sendMessage, 
    participants,
    connectionStatus,
    chatInfo,
    error
  } = useChat(chatId);

  // Modals and drawers
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

  // Cast connectionStatus to extended type
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
    } else if (messages.length > 0) {
      // Increment new message count if not at bottom
      setNewMessageCount(prev => prev + 1);
    }
  }, [messages.length, isAtBottom]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewMessageCount(0);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    setIsAtBottom(isNearBottom);
    
    if (isNearBottom) {
      setNewMessageCount(0);
    }
  };

  // Add connection status indicator
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
      // Simulate blockchain transaction
      setTxPending(true);
      setTimeout(() => {
        // Resend the message
        sendMessage(content);
        setTxPending(false);
      }, 1500);
    }
  };
  
  // Function to produce a shareable invite link
  const getInviteLink = useCallback(() => {
    if (typeof window !== 'undefined') {
      return window.location.href;
    }
    return '';
  }, []);
  
  // Generate a unique room key
  const generateRoomKey = useCallback(() => {
    return `arx-${chatId.substring(0, 8)}-${Math.random().toString(36).substring(2, 7)}`;
  }, [chatId]);
  
  // Function to copy invite link to clipboard
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
      bg={colorMode === 'dark' ? 'gray.900' : 'gray.50'}
    >
      {/* Connection status indicator */}
      {extendedStatus !== 'connected' && extendedStatus !== 'p2p-connected' && (
        <Box position="absolute" top="0" left="0" right="0" zIndex="10">
          {getConnectionStatusIndicator()}
        </Box>
      )}
      
      {/* Theme toggle button (floating) */}
      <Tooltip label={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`} placement="left">
        <IconButton
          aria-label={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`}
          icon={colorMode === 'dark' ? <FaSun /> : <FaMoon />}
          position="absolute"
          top="70px"
          right="20px"
          zIndex="10"
          colorScheme="purple"
          variant="ghost"
          onClick={toggleColorMode}
          border="1px solid"
          borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
          borderRadius="full"
          size="sm"
        />
      </Tooltip>
      
      {/* Chat Header with Blockchain Aesthetics */}
      <BlockchainInspiredHeader 
        chatName={chatInfo?.name || 'Secure Chat'}
        participants={participants}
        connectionStatus={extendedStatus}
        onInvite={onOpenInviteModal}
        onOpenSettings={onOpenSettings}
      />
      
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
            background: theme.colors.purple[500],
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
      
      {/* Transaction Pending Indicator */}
      {txPending && (
        <Box 
          py={2} 
          px={4} 
          bg={colorMode === 'dark' ? 'yellow.800' : 'yellow.100'} 
          color={colorMode === 'dark' ? 'yellow.200' : 'yellow.800'}
          borderTop="1px solid"
          borderColor={colorMode === 'dark' ? 'yellow.700' : 'yellow.300'}
        >
          <Flex align="center" justify="center">
            <FaEthereum style={{ marginRight: '8px' }} />
            <Text fontWeight="medium">Encrypting and signing message...</Text>
          </Flex>
        </Box>
      )}
      
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
      
      {/* Participants Panel */}
      <ParticipantsList 
        participants={participants} 
        isOpen={isParticipantsOpen} 
        onClose={onCloseParticipants}
      />
      
      {/* Invite Modal */}
      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={onCloseInviteModal}
        chatId={chatId}
        inviteLink={getInviteLink()}
      />
      
      {/* Settings Panel/Drawer - would be implemented separately */}
    </Flex>
  );
};

// Helper function to determine if avatar should be shown
function shouldShowAvatar(currentMsg: any, prevMsg: any | null): boolean {
  if (!prevMsg) return true;
  // Check if sender changed or if messages are more than 5 minutes apart
  return currentMsg.senderId !== prevMsg.senderId || 
    (new Date(currentMsg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() > 300000);
}
