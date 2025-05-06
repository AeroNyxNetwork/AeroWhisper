// src/pages/chat/[id].tsx
import React, { useEffect, useState, useCallback } from 'react';
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
  Avatar,
  Badge,
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
import { Layout } from '../../components/layout/Layout';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../contexts/AuthContext';
import { InviteModal } from '../../components/modals/InviteModal';
import { EnhancedChatView } from '../../components/chat/EnhancedChatView';

// Simple wallet button component (preserved from original)
const WalletButton = () => {
  const { isAuthenticated, user } = useAuth();
  return (
    <Button size="sm" leftIcon={<FaWallet />} colorScheme="purple" variant="outline">
      {isAuthenticated ? `${user?.displayName || 'Connected'}` : 'Connect Wallet'}
    </Button>
  );
};

// Chat info header with responsive design
const ChatHeader = ({ 
  chatName, 
  participantCount, 
  encryptionType, 
  isP2P, 
  isMobile, 
  onBackClick, 
  onInviteClick 
}) => {
  const { colorMode } = useColorMode();
  const isEncrypted = encryptionType === 'high' || encryptionType === 'maximum';
  
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
              <Box as="span">
                <FaLock color={colorMode === 'dark' ? '#68D391' : '#38A169'} size={isMobile ? 12 : 16} />
              </Box>
            </Tooltip>
          )}
          {isP2P && (
            <Tooltip label="Peer-to-peer connection" placement="top">
              <Box as="span">
                <FaNetworkWired color={colorMode === 'dark' ? '#63B3ED' : '#3182CE'} size={isMobile ? 12 : 16} />
              </Box>
            </Tooltip>
          )}
        </HStack>
        
        {!isMobile && (
          <HStack spacing={2}>
            <Badge colorScheme="purple" variant="subtle">
              <HStack spacing={1}>
                <FaUsers size={12} />
                <Text fontSize="xs">{participantCount || 0} participants</Text>
              </HStack>
            </Badge>
            {isEncrypted && (
              <Badge colorScheme="green" variant="subtle">
                <HStack spacing={1}>
                  <FaShieldAlt size={12} />
                  <Text fontSize="xs">Encrypted</Text>
                </HStack>
              </Badge>
            )}
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

// Define getStaticProps and getStaticPaths for proper routing (preserved from original)
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

const ChatPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const chatId = typeof id === 'string' ? id : '';
  const { colorMode } = useColorMode();
  const { user, isAuthenticated, isLoading } = useAuth();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  // Client-side only states (preserved from original)
  const [isClient, setIsClient] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  
  // Media queries for responsive design
  const [isMobile] = useMediaQuery("(max-width: 480px)");
  
  // Get chat data - keeping the original implementation intact
  const chatData = useChat(chatId);
  
  // Initialize client-side functionality (preserved from original)
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
  
  // Function to copy to clipboard with browser API (preserved from original)
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
        </Center>
      </Layout>
    );
  }
  
  if (!chatId) {
    return (
      <Layout>
        <Center h="calc(100vh - 80px)">
          <VStack spacing={4}>
            <Box>
              <FaInfoCircle 
                size={isMobile ? 32 : 40} 
                color={colorMode === 'dark' ? '#FC8181' : '#E53E3E'} 
              />
            </Box>
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
  
  // Extract simple chat info values safely
  const chatInfo = chatData.chatInfo || {};
  const chatName = chatInfo.name || "Chat";
  const encryptionType = chatInfo.encryptionType || "none";
  const isP2P = chatInfo.useP2P || false;
  const participantCount = chatData.participants?.length || 0;
  
  return (
    <Layout>
      {/* Optimize layout for mobile using CSS only */}
      <Box 
        css={{
          "@media (max-width: 480px)": {
            height: "calc(100vh - 60px)",
            marginTop: "-10px"
          }
        }}
        h="calc(100vh - 80px)"
        display="flex"
        flexDirection="column"
        overflow="hidden"
      >
        {/* Enhanced chat header */}
        <ChatHeader 
          chatName={chatName}
          participantCount={participantCount}
          encryptionType={encryptionType}
          isP2P={isP2P}
          isMobile={isMobile}
          onBackClick={handleBackClick}
          onInviteClick={onOpen}
        />
        
        {/* Main chat area - EnhancedChatView */}
        <Box flex="1" overflow="hidden">
          <EnhancedChatView chatId={chatId} />
        </Box>
      </Box>
      
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
