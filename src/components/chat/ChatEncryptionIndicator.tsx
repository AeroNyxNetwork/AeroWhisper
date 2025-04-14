// src/components/chat/ChatEncryptionIndicator.tsx
import React from 'react';
import { HStack, Text, Badge, Tooltip, Icon, useColorMode } from '@chakra-ui/react';
import { FaLock, FaShieldAlt } from 'react-icons/fa';

interface ChatEncryptionIndicatorProps {
  isEncrypted: boolean;
  isP2P: boolean;
}

export const ChatEncryptionIndicator: React.FC<ChatEncryptionIndicatorProps> = ({
  isEncrypted,
  isP2P,
}) => {
  const { colorMode } = useColorMode();
  
  return (
    <HStack spacing={2}>
      {isEncrypted && (
        <Tooltip 
          label="End-to-end encrypted" 
          placement="top"
        >
          <Badge 
            colorScheme="green" 
            display="flex" 
            alignItems="center"
            px={2}
            py={1}
            borderRadius="full"
          >
            <Icon as={FaLock} mr={1} />
            <Text fontSize="xs">Encrypted</Text>
          </Badge>
        </Tooltip>
      )}
      
      {isP2P && (
        <Tooltip 
          label="Direct peer-to-peer connection" 
          placement="top"
        >
          <Badge 
            colorScheme="purple" 
            display="flex" 
            alignItems="center"
            px={2}
            py={1}
            borderRadius="full"
          >
            <Icon as={FaShieldAlt} mr={1} />
            <Text fontSize="xs">P2P</Text>
          </Badge>
        </Tooltip>
      )}
    </HStack>
  );
};
