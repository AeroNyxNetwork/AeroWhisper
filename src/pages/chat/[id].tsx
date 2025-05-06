// src/pages/chat/[id].tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  Box, 
  Flex, 
  Heading, 
  useColorMode, 
  Button,
  useToast, 
  Center, 
  Spinner, 
  useDisclosure,
  IconButton,
  Tooltip,
  Text,
  useMediaQuery,
  VStack,
  HStack,
  Collapse,
  Avatar,
  Badge,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Divider
} from '@chakra-ui/react';
import { 
  FaWallet, 
  FaArrowLeft, 
  FaUsers, 
  FaShare, 
  FaEllipsisV,
  FaLock,
  FaShieldAlt,
  FaNetworkWired,
  FaInfoCircle,
  FaUserPlus,
  FaCog,
  FaSignOutAlt,
  FaBell
} from 'react-icons/fa';
import { motion } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../contexts/AuthContext';
import { InviteModal } from '../../components/modals/InviteModal';
import { EnhancedChatView } from '../../components/chat/EnhancedChatView';

const MotionBox = motion(Box);

// Define prop types for the ChatInfoHeader component
interface ChatInfoHeaderProps {
  chatName: string;
  participantCount: number;
  isEncrypted: boolean;
  isP2P: boolean;
  isMobile: boolean;
  onBackClick: () => void;
  onInviteClick: () => void;
}

// Chat info header with responsive design
const ChatInfoHeader: React.FC<ChatInfoHeaderProps> = ({ 
  chatName, 
  participantCount, 
  isEncrypted, 
  isP2P, 
  isMobile, 
  onBackClick, 
  onInviteClick 
}) => {
  const { colorMode } = useColorMode();
  
  return (
    <Flex 
      align="center" 
      py={2} 
      px={3}
      borderBottomWidth="1px"
      borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      position="sticky"
      top={0}
      zIndex={10}
      h={{ base: "60px", md: "70px" }}
    >
      {isMobile && (
        <IconButton
          icon={<FaArrowLeft />}
          aria-label="Go back"
          variant="ghost"
          size="sm"
          mr={2}
          onClick={onBackClick}
        />
      )}
      
      <Avatar 
        bg="purple.500" 
        color="white" 
        name={chatName || "Chat"} 
        size={isMobile ? "sm" : "md"}
        mr={3}
      />
      
      <VStack spacing={0} align="flex-start" flex={1}>
        <HStack>
          <Text fontWeight="bold" fontSize={isMobile ? "md" : "lg"} noOfLines={1}>
            {chatName || "Chat"}
          </Text>
          {isEncrypted && (
            <Tooltip label="End-to-end encrypted" placement="top">
              <Box>
                <Icon as={FaLock} color="green.400" boxSize={isMobile ? 3 : 4} />
              </Box>
            </Tooltip>
          )}
          {isP2P && (
            <Tooltip label="Peer-to-peer connection" placement="top">
              <Box>
                <Icon as={FaNetworkWired} color="blue.400" boxSize={isMobile ? 3 : 4} />
              </Box>
            </Tooltip>
          )}
        </HStack>
        
        {!isMobile && (
          <HStack spacing={2}>
            <Badge colorScheme="purple" variant="subtle">
              <HStack spacing={1}>
                <Icon as={FaUsers} boxSize={3} />
                <Text fontSize="xs">{participantCount || 0} participants</Text>
              </HStack>
            </Badge>
            <Badge colorScheme="green" variant="subtle">
              <HStack spacing={1}>
                <Icon as={FaShieldAlt} boxSize={3} />
                <Text fontSize="xs">Encrypted</Text>
              </HStack>
            </Badge>
          </HStack>
        )}
      </VStack>
      
      <HStack spacing={isMobile ? 1 : 2}>
        {!isMobile && (
          <Button
            leftIcon={<FaUserPlus />}
            size="sm"
            colorScheme="purple"
            variant="outline"
            onClick={onInviteClick}
          >
            Invite
          </Button>
        )}
        
        <Menu>
          <MenuButton
            as={IconButton}
            icon={<FaEllipsisV />}
            variant="ghost"
            aria-label="Options"
            size={isMobile ? "sm" : "md"}
          />
          <MenuList>
            <MenuItem icon={<FaUserPlus />} onClick={onInviteClick}>
              Invite People
            </MenuItem>
            <MenuItem icon={<FaShare />}>
              Share Chat
            </MenuItem>
            <MenuItem icon={<FaInfoCircle />}>
              Chat Info
            </MenuItem>
            <Divider />
            <MenuItem icon={<FaBell />}>
              Mute Notifications
            </MenuItem>
            <MenuItem icon={<FaCog />}>
              Chat Settings
            </MenuItem>
            <MenuItem icon={<FaSignOutAlt />} color="red.400">
              Leave Chat
            </MenuItem>
          </MenuList>
        </Menu>
      </HStack>
    </Flex>
  );
};

// Define getStaticProps and getStaticPaths for proper routing
export async function getStaticProps() {
  return {
    props: {}
  };
}

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking'
  };
}

// Helper components
interface IconProps {
  as: React.ElementType;
  [key: string]: any;
}

const Icon: React.FC<IconProps> = ({ as, ...props }) => {
  return React.createElement(as, props);
};

const ChatPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const chatId = typeof id === 'string' ? id : '';
  const { colorMode } = useColorMode();
  const { user, isAuthenticated, isLoading } = useAuth();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  // Get chat data using the useChat hook
  const { chatRoom, loading: chatLoading, error: chatError } = useChat(chatId);
  
  // Media queries for responsive design
  const [isMobile] = useMediaQuery("(max-width: 480px)");
  const [isTablet] = useMediaQuery("(max-width: 768px)");
  
  // Mobile drawer for participants - this would be implemented in a real app
  const { 
    isOpen: isParticipantsOpen, 
    onOpen: onParticipantsOpen, 
    onClose: onParticipantsClose 
  } = useDisclosure();
  
  // Client-side only states
  const [isClient, setIsClient] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  
  // Initialize client-side functionality
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
    }
    
    // Redirect to login if not authenticated
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/connect-wallet');
    }
  }, [isAuthenticated, isLoading, router]);
  
  // Function to copy to clipboard with browser API
  const copyToClipboard = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl);
      toast({
        title: "Invitation link copied",
        status: "success",
        duration: 2000,
        isClosable: true,
        position: isMobile ? "bottom" : "top-right"
      });
    }
  }, [currentUrl, toast, isMobile]);
  
  // Handle back button for mobile view
  const handleBackClick = useCallback(() => {
    router.push('/dashboard');
  }, [router]);
  
  // Loading state when router is not ready or in SSR
  if (!isClient || isLoading || !isAuthenticated) {
    return (
      <Layout>
        <Center h="calc(100vh - 80px)">
          <MotionBox
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <VStack spacing={4}>
              <Spinner 
                size={isMobile ? "lg" : "xl"} 
                color="purple.500" 
                thickness="4px" 
                speed="0.65s" 
              />
              <Heading mt={2} fontSize={isMobile ? "md" : "lg"}>
                Loading chat...
              </Heading>
              <Text color={colorMode === 'dark' ? 'gray.400' : 'gray.600'} fontSize={isMobile ? "xs" : "sm"}>
                Establishing secure connection
              </Text>
            </VStack>
          </MotionBox>
        </Center>
      </Layout>
    );
  }
  
  if (!chatId) {
    return (
      <Layout>
        <Center h="calc(100vh - 80px)">
          <VStack spacing={4}>
            <Icon 
              as={FaInfoCircle} 
              boxSize={isMobile ? 8 : 10} 
              color={colorMode === 'dark' ? 'red.300' : 'red.500'} 
            />
            <Heading fontSize={isMobile ? "md" : "lg"}>Invalid chat ID</Heading>
            <Text color={colorMode === 'dark' ? 'gray.400' : 'gray.600'} fontSize={isMobile ? "xs" : "sm"} textAlign="center">
              The chat you're looking for does not exist or you don't have access to it.
            </Text>
            <Button 
              mt={2} 
              colorScheme="purple" 
              size={isMobile ? "sm" : "md"}
              onClick={() => router.push('/dashboard')}
              leftIcon={<FaArrowLeft />}
            >
              Return to Dashboard
            </Button>
          </VStack>
        </Center>
      </Layout>
    );
  }
  
  // Handle manual copy action when user clicks the copy button inside the modal
  const handleCopyAction = () => {
    copyToClipboard();
  };
  
  return (
    <Layout hideHeader={isMobile}>
      {/* Responsive chat layout */}
      <Flex 
        direction="column" 
        h={isMobile ? "100vh" : "calc(100vh - 80px)"}
        maxH={isMobile ? "100vh" : "calc(100vh - 80px)"}
        overflow="hidden"
      >
        {/* Chat header with info */}
        <ChatInfoHeader 
          chatName={chatRoom?.name || "Chat"}
          participantCount={chatRoom?.participants?.length || 0}
          isEncrypted={chatRoom?.encryptionType === 'high' || chatRoom?.encryptionType === 'maximum'}
          isP2P={chatRoom?.useP2P || false}
          isMobile={isMobile}
          onBackClick={handleBackClick}
          onInviteClick={onOpen}
        />
        
        {/* Main chat area - EnhancedChatView */}
        <Box flex="1" overflow="hidden">
          <EnhancedChatView chatId={chatId} />
        </Box>
      </Flex>
      
      {/* Invite Modal */}
      {isClient && (
        <InviteModal 
          isOpen={isOpen} 
          onClose={onClose}
          chatId={chatId}
          inviteLink={currentUrl}
        />
      )}
    </Layout>
  );
};

export default ChatPage;
