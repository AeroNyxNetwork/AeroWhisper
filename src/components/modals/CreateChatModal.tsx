import React, { useState } from 'react';
import { useRouter } from 'next/router';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Switch,
  VStack,
  Text,
  useColorMode,
  useToast,
  Box,
  Flex,
  Divider,
} from '@chakra-ui/react';
import { createChatRoom } from '../../lib/chatService';
import { generateSessionId } from '../../utils/crypto';

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateChatModal: React.FC<CreateChatModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const { colorMode } = useColorMode();
  const toast = useToast();
  const [chatName, setChatName] = useState('');
  const [isEphemeral, setIsEphemeral] = useState(true);
  const [useP2P, setUseP2P] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleCreateChat = async () => {
    if (!chatName.trim()) {
      toast({
        title: 'Chat name required',
        description: 'Please enter a name for your chat room',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setLoading(true);
    try {
      const sessionId = generateSessionId();
      const room = await createChatRoom({
        name: chatName,
        isEphemeral,
        useP2P,
        createdAt: new Date().toISOString(),
      });

      toast({
        title: 'Chat room created',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onClose();
      router.push(`/chat/${room.id}`);
    } catch (error) {
      console.error('Failed to create chat room:', error);
      toast({
        title: 'Failed to create chat room',
        description: 'Please try again',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay backdropFilter="blur(5px)" />
      <ModalContent 
        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
        borderRadius="xl"
        boxShadow="xl"
      >
        <ModalHeader>Create New Secure Chat</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={6} align="start">
            <FormControl id="chat-name" isRequired>
              <FormLabel>Chat Name</FormLabel>
              <Input 
                value={chatName}
                onChange={(e) => setChatName(e.target.value)}
                placeholder="Enter a name for your chat"
                size="lg"
              />
            </FormControl>

            <Divider />

            <Text fontWeight="semibold" mb={2}>Security Options</Text>
            
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="ephemeral-chat" mb="0">
                Ephemeral Chat
              </FormLabel>
              <Switch 
                id="ephemeral-chat" 
                isChecked={isEphemeral} 
                onChange={() => setIsEphemeral(!isEphemeral)}
                colorScheme="purple"
                size="lg"
              />
            </FormControl>
            
            <Box pl={6}>
              <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                Ephemeral chats automatically disappear after a period of inactivity
              </Text>
            </Box>

            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="p2p-connection" mb="0">
                Use Direct P2P Connection
              </FormLabel>
              <Switch 
                id="p2p-connection" 
                isChecked={useP2P} 
                onChange={() => setUseP2P(!useP2P)}
                colorScheme="purple"
                size="lg"
              />
            </FormControl>
            
            <Box pl={6}>
              <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                Enable direct peer-to-peer connection for maximum privacy
              </Text>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="outline" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button 
            colorScheme="purple" 
            onClick={handleCreateChat}
            isLoading={loading}
            loadingText="Creating Chat"
          >
            Create Chat
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
