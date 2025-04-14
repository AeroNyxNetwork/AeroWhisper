import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { 
  Box, Grid, Heading, Button, Text, useColorMode,
  useDisclosure, SimpleGrid, Icon, Flex
} from '@chakra-ui/react';
import { FaPlus, FaKey, FaShieldAlt, FaUsers, FaRegComments } from 'react-icons/fa';
import { Layout } from '../components/layout/Layout';
import { ChatRoomCard } from '../components/chat/ChatRoomCard';
import { CreateChatModal } from '../components/modals/CreateChatModal';
import { useAuth } from '../contexts/AuthContext';
import { useChatRooms } from '../hooks/useChatRooms';

const Dashboard = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { colorMode } = useColorMode();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { chatRooms, loading } = useChatRooms();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/connect-wallet');
    }
  }, [isAuthenticated, router]);

  const handleCreateChat = () => {
    onOpen();
  };

  const handleJoinChat = (id: string) => {
    router.push(`/chat/${id}`);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Layout>
      <Box p={8}>
        <Flex 
          justifyContent="space-between" 
          alignItems="center" 
          mb={8}
        >
          <Box>
            <Heading size="lg" mb={2}>Welcome to AeroNyx</Heading>
            <Text color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
              Your secure peer-to-peer encrypted messaging platform
            </Text>
          </Box>
          <Button 
            leftIcon={<FaPlus />} 
            colorScheme="purple" 
            onClick={handleCreateChat}
            size="lg"
          >
            Create New Chat
          </Button>
        </Flex>

        {/* Feature Highlight Section */}
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={10} mb={12}>
          <Box 
            p={5} 
            shadow="md" 
            borderWidth="1px" 
            borderRadius="lg"
            bg={colorMode === 'dark' ? 'gray.700' : 'white'}
          >
            <Flex direction="column" align="center" textAlign="center">
              <Icon as={FaKey} w={10} h={10} color="purple.500" mb={4} />
              <Heading fontSize="xl" mb={4}>End-to-End Encryption</Heading>
              <Text color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                All messages are encrypted with military-grade protocols
              </Text>
            </Flex>
          </Box>

          <Box 
            p={5} 
            shadow="md" 
            borderWidth="1px" 
            borderRadius="lg"
            bg={colorMode === 'dark' ? 'gray.700' : 'white'}
          >
            <Flex direction="column" align="center" textAlign="center">
              <Icon as={FaShieldAlt} w={10} h={10} color="purple.500" mb={4} />
              <Heading fontSize="xl" mb={4}>Decentralized Security</Heading>
              <Text color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                No central server stores your conversations
              </Text>
            </Flex>
          </Box>

          <Box 
            p={5} 
            shadow="md" 
            borderWidth="1px" 
            borderRadius="lg"
            bg={colorMode === 'dark' ? 'gray.700' : 'white'}
          >
            <Flex direction="column" align="center" textAlign="center">
              <Icon as={FaRegComments} w={10} h={10} color="purple.500" mb={4} />
              <Heading fontSize="xl" mb={4}>Ephemeral Chats</Heading>
              <Text color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                Create disposable chat rooms with unique encryption keys
              </Text>
            </Flex>
          </Box>
        </SimpleGrid>

        <Heading size="md" mb={4}>Your Secure Chats</Heading>
        
        {loading ? (
          <Text>Loading your chat rooms...</Text>
        ) : chatRooms.length > 0 ? (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
            {chatRooms.map((room) => (
              <ChatRoomCard 
                key={room.id}
                room={room}
                onClick={() => handleJoinChat(room.id)}
              />
            ))}
          </SimpleGrid>
        ) : (
          <Box 
            p={10} 
            textAlign="center" 
            borderRadius="lg"
            bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
          >
            <Text mb={4}>You don't have any active chats yet</Text>
            <Button 
              colorScheme="purple" 
              variant="outline" 
              onClick={handleCreateChat}
            >
              Create Your First Chat
            </Button>
          </Box>
        )}
      </Box>

      <CreateChatModal isOpen={isOpen} onClose={onClose} />
    </Layout>
  );
};

export default Dashboard;
