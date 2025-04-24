// src/pages/chat/[id].tsx
import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  Box, Flex, IconButton, Input, Heading,
  useColorMode, Button, Menu, MenuButton, MenuList,
  MenuItem, VStack, HStack, Tooltip, Divider,
  useToast, Center, Spinner
} from '@chakra-ui/react';
import { 
  FaPaperPlane, FaEllipsisV, FaUserPlus, FaClipboard, 
  FaTrash, FaSignOutAlt, FaShieldAlt
} from 'react-icons/fa';
import { Layout } from '../../components/layout/Layout';
import { Message } from '../../components/chat/Message';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../contexts/AuthContext';
import { ChatEncryptionIndicator } from '../../components/chat/ChatEncryptionIndicator';
import { ChatHeader } from '../../components/chat/ChatHeader';
import { InviteModal } from '../../components/modals/InviteModal';
import { ConnectionIndicator } from '../../components/ui/ConnectionIndicator';
import { EnhancedChatView } from '../../components/chat/EnhancedChatView';

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
  
  // Client-side only states
  const [isClient, setIsClient] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);

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
  const copyToClipboard = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl);
      toast({
        title: "Invitation link copied",
        status: "success",
        duration: 2000,
      });
    }
  };

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
      {/* Use the enhanced chat view component which includes all the necessary UI improvements */}
      <EnhancedChatView chatId={chatId} />
      
      {isClient && (
        <InviteModal 
          isOpen={showInviteModal} 
          onClose={() => setShowInviteModal(false)}
          chatId={chatId}
          inviteLink={currentUrl}
        />
      )}
    </Layout>
  );
};

export default ChatPage;
