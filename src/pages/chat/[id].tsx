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

// Simple wallet button component
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
  
  // Network debugging function - placed inside the component
  const debugNetworkIssues = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    // Capture WebSocket errors
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      console.log(`[Debug] Creating WebSocket connection to: ${url}`);
      const ws = new originalWebSocket(url, protocols);
      
      const originalSend = ws.send;
      ws.send = function(data) {
        console.log(`[Debug] WebSocket sending data:`, data);
        return originalSend.call(ws, data);
      };
      
      ws.addEventListener('open', (event) => {
        console.log('[Debug] WebSocket connection opened');
      });
      
      ws.addEventListener('error', (event) => {
        console.error('[Debug] WebSocket error:', event);
      });
      
      ws.addEventListener('close', (event) => {
        console.log(`[Debug] WebSocket closed: code=${event.code}, reason=${event.reason}, wasClean=${event.wasClean}`);
      });
      
      return ws;
    };
    
    // Capture fetch errors
    const originalFetch = window.fetch;
    window.fetch = function(resource, init) {
      const url = typeof resource === 'string' ? resource : resource.url;
      console.log(`[Debug] Fetch request to: ${url}`);
      return originalFetch.apply(this, arguments)
        .then(response => {
          console.log(`[Debug] Fetch response from ${url}: ${response.status}`);
          return response;
        })
        .catch(err => {
          console.error(`[Debug] Fetch error for ${url}:`, err);
          throw err;
        });
    };
  }, []);
  
  // Initialize client-side functionality
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
      // Debug network issues in development
      if (process.env.NODE_ENV !== 'production') {
        debugNetworkIssues();
      }
    }
    
    // Redirect to login if not authenticated
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/connect-wallet');
    }
  }, [isAuthenticated, isLoading, router, debugNetworkIssues]);
  
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
      
      {/* Only pass the chatId prop to EnhancedChatView */}
      <EnhancedChatView 
        chatId={chatId} 
      />
      
      {isClient && (
        <InviteModal 
          isOpen={isOpen} 
          onClose={onClose}
          chatId={chatId}
          inviteLink={currentUrl}
          // Note: We've removed the onCopy and solanaEnabled props
          // based on the previous error message
        />
      )}
    </Layout>
  );
};

export default ChatPage;
