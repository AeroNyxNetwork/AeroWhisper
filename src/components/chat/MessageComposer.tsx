// src/components/chat/MessageComposer.tsx
import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Flex,
  Textarea,
  IconButton,
  useColorMode,
  Tooltip,
  HStack,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Text,
  Icon,
  useDisclosure,
} from '@chakra-ui/react';
import {
  FaPaperPlane,
  FaSmile,
  FaPaperclip,
  FaCamera,
  FaImage,
  FaVideo,
  FaFile,
  FaLock,
  FaKeyboard,
  FaEllipsisH,
  FaMicrophone,
} from 'react-icons/fa';
import { FileTransfer } from './FileTransfer';

type EncryptionType = 'standard' | 'high' | 'maximum';

interface MessageComposerProps {
  onSendMessage: (text: string) => Promise<boolean>;
  isEncrypted?: boolean;
  encryptionType?: EncryptionType;
  isP2P?: boolean;
  isDisabled?: boolean;
  placeholder?: string;
  chatId?: string;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  isEncrypted = true,
  encryptionType = 'standard',
  isP2P = false,
  isDisabled = false,
  placeholder = 'Type a message...',
  chatId,
}) => {
  const { colorMode } = useColorMode();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // File transfer modal
  const { isOpen: isFileTransferOpen, onOpen: onFileTransferOpen, onClose: onFileTransferClose } = useDisclosure();
  
  // Handle sending message
  const sendMessage = useCallback(async () => {
    if (!message.trim() || isDisabled || isLoading) return;
    
    setIsLoading(true);
    
    try {
      const success = await onSendMessage(message);
      
      if (success) {
        setMessage('');
        
        // Focus back on textarea
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 0);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  }, [message, isDisabled, isLoading, onSendMessage]);
  
  // Handle keyboard shortcuts (Ctrl/Cmd + Enter to send)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Check for Ctrl/Cmd + Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);
  
  // Handle file upload
  const handleFileSelect = useCallback(async (file: File, encryptFile: boolean) => {
    // In a real implementation, this would upload and send the file
    console.log('File selected:', file, 'Encrypt:', encryptFile);
    
    // For now, just mention the file in a message
    const fileMessage = `[File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`;
    setMessage(prev => prev ? `${prev} ${fileMessage}` : fileMessage);
    
    onFileTransferClose();
  }, [onFileTransferClose]);
  
  // Auto-resize textarea based on content
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };
  
  return (
    <>
      <Box 
        p={3} 
        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
        borderTop="1px solid"
        borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
      >
        {/* Encryption status */}
        <Flex justify="space-between" align="center" mb={2}>
          <Tooltip 
            label={`Messages are ${isP2P ? 'peer-to-peer' : ''} ${isEncrypted ? `encrypted (${encryptionType})` : 'not encrypted'}`} 
            placement="top"
          >
            <Flex align="center" opacity={0.7}>
              <Icon as={FaLock} size="xs" mr={1} color={isEncrypted ? 'green.500' : 'red.500'} />
              <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
                {isEncrypted ? (
                  isP2P ? 'P2P Encrypted' : 'Encrypted'
                ) : (
                  'Not Encrypted'
                )}
              </Text>
            </Flex>
          </Tooltip>
          
          <Tooltip label="Keyboard shortcuts (Ctrl+Enter to send)" placement="top">
            <Flex align="center" opacity={0.7}>
              <Icon as={FaKeyboard} size="xs" mr={1} />
              <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
                Ctrl+Enter to send
              </Text>
            </Flex>
          </Tooltip>
        </Flex>
        
        {/* Composer area */}
        <Flex>
          <Box 
            flex="1" 
            mr={2} 
            borderRadius="md" 
            bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
            overflow="hidden"
          >
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={isDisabled ? "Waiting for connection..." : placeholder}
              border="none"
              _focus={{ border: 'none', boxShadow: 'none' }}
              minH="40px"
              maxH="150px"
              resize="none"
              py={2}
              px={3}
              disabled={isDisabled}
            />
            
            {/* Attachment and emoji toolbar */}
            <Flex p={1} borderTop="1px solid" borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}>
              <HStack spacing={1}>
                <Tooltip label="Add emoji" placement="top">
                  <IconButton
                    aria-label="Add emoji"
                    icon={<FaSmile />}
                    size="sm"
                    variant="ghost"
                    isDisabled={isDisabled}
                  />
                </Tooltip>
                
                <Menu isLazy>
                  <MenuButton
                    as={IconButton}
                    aria-label="Attach file"
                    icon={<FaPaperclip />}
                    size="sm"
                    variant="ghost"
                    isDisabled={isDisabled}
                  />
                  <MenuList>
                    <MenuItem icon={<FaImage />} onClick={onFileTransferOpen}>
                      Image
                    </MenuItem>
                    <MenuItem icon={<FaVideo />} onClick={onFileTransferOpen}>
                      Video
                    </MenuItem>
                    <MenuItem icon={<FaFile />} onClick={onFileTransferOpen}>
                      Document
                    </MenuItem>
                    <MenuItem icon={<FaCamera />}>
                      Camera
                    </MenuItem>
                  </MenuList>
                </Menu>
                
                <Tooltip label="Record voice message" placement="top">
                  <IconButton
                    aria-label="Record voice message"
                    icon={<FaMicrophone />}
                    size="sm"
                    variant="ghost"
                    isDisabled={isDisabled}
                  />
                </Tooltip>
                
                <Tooltip label="More options" placement="top">
                  <IconButton
                    aria-label="More options"
                    icon={<FaEllipsisH />}
                    size="sm"
                    variant="ghost"
                    isDisabled={isDisabled}
                  />
                </Tooltip>
              </HStack>
            </Flex>
          </Box>
          
          <Tooltip label="Send message" placement="top">
            <IconButton
              aria-label="Send message"
              icon={<FaPaperPlane />}
              colorScheme="purple"
              borderRadius="md"
              onClick={sendMessage}
              isLoading={isLoading}
              isDisabled={!message.trim() || isDisabled}
            />
          </Tooltip>
        </Flex>
      </Box>
      
      {/* File transfer modal */}
      {chatId && (
        <FileTransfer
          isOpen={isFileTransferOpen}
          onClose={onFileTransferClose}
          onFileSelect={handleFileSelect}
          chatId={chatId}
        />
      )}
    </>
  );
};
