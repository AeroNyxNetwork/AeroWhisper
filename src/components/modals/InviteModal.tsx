// src/components/modals/InviteModal.tsx
import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Input,
  Text,
  InputGroup,
  InputRightElement,
  VStack,
  HStack,
  useToast,
  useClipboard,
  useColorMode,
  Box,
  Divider,
  Icon,
} from '@chakra-ui/react';
import { FaQrcode, FaLink, FaCheck, FaCopy, FaShareAlt } from 'react-icons/fa';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  inviteLink: string;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  chatId,
  inviteLink,
}) => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const { hasCopied, onCopy } = useClipboard(inviteLink);
  
  const handleCopyLink = () => {
    onCopy();
    toast({
      title: 'Link copied',
      description: 'Invitation link copied to clipboard',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };
  
  const shareViaApi = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my AeroNyx secure chat',
          text: 'Join my end-to-end encrypted chat on AeroNyx',
          url: inviteLink,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      toast({
        title: 'Sharing not supported',
        description: 'Web Share API is not supported on this browser',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay backdropFilter="blur(5px)" />
      <ModalContent 
        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
        borderRadius="xl"
      >
        <ModalHeader>Invite to Secure Chat</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={6} align="start">
            <Text>Share this secure link with people you want to invite to this chat:</Text>
            
            <InputGroup size="lg">
              <Input
                value={inviteLink}
                isReadOnly
                pr="4.5rem"
                fontFamily="mono"
                fontSize="sm"
              />
              <InputRightElement width="4.5rem">
                <Button 
                  h="1.75rem" 
                  size="sm" 
                  onClick={handleCopyLink}
                  colorScheme={hasCopied ? 'green' : 'gray'}
                >
                  {hasCopied ? <FaCheck /> : <FaCopy />}
                </Button>
              </InputRightElement>
            </InputGroup>
            
            <Divider />
            
            <Text fontWeight="semibold">Share options:</Text>
            
            <HStack spacing={4} width="100%" justify="center">
              <Button 
                leftIcon={<FaCopy />} 
                onClick={handleCopyLink}
                flex={1}
                variant="outline"
              >
                Copy Link
              </Button>
              
              <Button 
                leftIcon={<FaShareAlt />} 
                onClick={shareViaApi}
                flex={1}
                colorScheme="purple"
              >
                Share
              </Button>
            </HStack>
            
            <Box
              bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
              p={4}
              borderRadius="md"
              width="100%"
            >
              <VStack align="start">
                <Text fontWeight="semibold">Security Note:</Text>
                <Text fontSize="sm">
                  Anyone with this link can join this chat. All messages are end-to-end encrypted.
                </Text>
              </VStack>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
