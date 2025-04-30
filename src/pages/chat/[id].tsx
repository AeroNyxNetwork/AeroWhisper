// src/pages/chat/[id].tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  Box, Flex, Heading, useColorMode, Button,
  useToast, Center, Spinner, useDisclosure
} from '@chakra-ui/react';
import { FaWallet } from 'react-icons/fa';
import { Layout } from '../../components/layout/Layout';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../contexts/AuthContext';
import { InviteModal } from '../../components/modals/InviteModal';
import { EnhancedChatView } from '../../components/chat/EnhancedChatView';

// Remove Solana wallet imports and use the custom ConnectionButton
// Or create a simplified wallet button component
const WalletButton = () => {
  const { isAuthenticated, user } = useAuth();
  return (
    <Button size="sm" leftIcon={<FaWallet />} colorScheme="purple" variant="outline">
      {isAuthenticated ? `${user?.displayName || 'Connected'}` : 'Connect Wallet'}
    </Button>
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

const ChatPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const chatId = typeof id === 'string' ? id : '';
  const { colorMode } = useColorMode();
  const { user, isAuthenticated, isLoading } = useAuth();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  // Client-side only states
  const [isClient, setIsClient] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [isStorageEnabled, setIsStorageEnabled] = useState(false);
  
  // Initialize client-side functionality
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
      // Check if decentralized storage is enabled
      setIsStorageEnabled(localStorage.getItem('enable-decentralized-storage') === 'true');
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
      });
    }
  }, [currentUrl, toast]);
  
  // Function to toggle decentralized storage
  const toggleStorage = useCallback(() => {
    const newValue = !isStorageEnabled;
    setIsStorageEnabled(newValue);
    localStorage.setItem('enable-decentralized-storage', String(newValue));
    toast({
      title: newValue ? "Decentralized Storage Enabled" : "Decentralized Storage Disabled",
      description: newValue ? 
        "Your messages will be encrypted and stored on IPFS" : 
        "Your messages will only be stored locally",
      status: newValue ? "success" : "info",
      duration: 3000,
    });
  }, [isStorageEnabled, toast]);
  
  // Loading state when router is not ready or in SSR
  if (!isClient || isLoading || !isAuthenticated) {
    return (
      <Layout>
        <Center h="calc(100vh - 80px)">
          <Flex direction="column" align="center">
            <Spinner size="xl" color="purple.500" thickness="4px" speed="0.65s" />
            <Heading mt={4} fontSize="lg">Loading chat...</Heading>
          </Flex>
        </Center>
      </Layout>
    );
  }
  
  if (!chatId) {
    return (
      <Layout>
        <Center h="calc(100vh - 80px)">
          <Flex direction="column" align="center">
            <Heading fontSize="lg">Invalid chat ID</Heading>
            <Button 
              mt={4} 
              colorScheme="purple" 
              onClick={() => router.push('/dashboard')}
            >
              Return to Dashboard
            </Button>
          </Flex>
        </Center>
      </Layout>
    );
  }
  
  return (
    <Layout>
      {/* Web3 wallet connection status */}
      <Box position="absolute" top={2} right={4} zIndex={10}>
        <WalletButton />
      </Box>
      
      {/* Enhanced chat view with web3 integrations */}
      <EnhancedChatView 
        chatId={chatId} 
        isStorageEnabled={isStorageEnabled}
        onToggleStorage={toggleStorage}
        onShare={onOpen}
      />
      
      {isClient && (
        <InviteModal 
          isOpen={isOpen} 
          onClose={onClose}
          chatId={chatId}
          inviteLink={currentUrl}
          onCopy={copyToClipboard}
          solanaEnabled={!!user?.publicKey}
        />
      )}
    </Layout>
  );
};

export default ChatPage;
