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
  
  // Function to copy to clipboard with browser API - we'll keep this for internal use
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
  
  // Handle manual copy action when user clicks the copy button inside the modal
  const handleCopyAction = () => {
    copyToClipboard();
    // If InviteModal has onClosed, we would call it here
  };
  
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
          // Remove onCopy prop - it's not defined in InviteModalProps
          // Remove solanaEnabled prop - it's likely also not defined or needs to be adapted
        />
      )}
      
      {/* Add a global event listener to handle copy actions */}
      <Box id="copy-event-handler" hidden>
        <script dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('click', function(e) {
              if (e.target && e.target.id === 'copy-link-button') {
                document.dispatchEvent(new CustomEvent('copy-invite-link'));
              }
            });
          `
        }} />
      </Box>
    </Layout>
  );
};

export default ChatPage;
