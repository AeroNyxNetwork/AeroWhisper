// src/components/chat/EncryptionIndicator.tsx
import React from 'react';
import {
  Box,
  Flex,
  Text,
  Icon,
  Badge,
  Tooltip,
  useColorMode,
  HStack,
} from '@chakra-ui/react';
import {
  FaLock,
  FaShieldAlt,
  FaUsers,
  FaLink,
  FaInfoCircle,
} from 'react-icons/fa';

type EncryptionType = 'standard' | 'high' | 'maximum';

interface EncryptionIndicatorProps {
  type: EncryptionType;
  isP2P: boolean;
  participants: number;
}

export const EncryptionIndicator: React.FC<EncryptionIndicatorProps> = ({
  type,
  isP2P,
  participants,
}) => {
  const { colorMode } = useColorMode();
  
  // Get color based on encryption type
  const getEncryptionColor = () => {
    switch (type) {
      case 'maximum':
        return 'green';
      case 'high':
        return 'teal';
      case 'standard':
      default:
        return 'blue';
    }
  };
  
  // Get encryption description
  const getEncryptionDescription = () => {
    switch (type) {
      case 'maximum':
        return 'Maximum (Dual Encryption + Forward Secrecy)';
      case 'high':
        return 'High (ChaCha20-Poly1305)';
      case 'standard':
      default:
        return 'Standard (AES-256)';
    }
  };
  
  return (
    <Box
      py={1}
      px={3}
      bg={colorMode === 'dark' ? 'gray.800' : 'gray.50'}
      borderBottom="1px solid"
      borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
    >
      <Flex justify="space-between" align="center">
        {/* Left: Encryption indicators */}
        <HStack spacing={4}>
          <Tooltip
            label={`${getEncryptionDescription()} encryption enabled`}
            placement="bottom"
            hasArrow
          >
            <Badge
              colorScheme={getEncryptionColor()}
              display="flex"
              alignItems="center"
              px={2}
              py={1}
              borderRadius="full"
            >
              <Icon as={FaLock} mr={1} />
              <Text fontSize="xs">
                Encrypted
                {type !== 'standard' && ` (${type})`}
              </Text>
            </Badge>
          </Tooltip>
          
          {isP2P && (
            <Tooltip
              label="Direct peer-to-peer connection enabled"
              placement="bottom"
              hasArrow
            >
              <Badge
                colorScheme="purple"
                display="flex"
                alignItems="center"
                px={2}
                py={1}
                borderRadius="full"
              >
                <Icon as={FaLink} mr={1} />
                <Text fontSize="xs">P2P</Text>
              </Badge>
            </Tooltip>
          )}
        </HStack>
        
        {/* Right: Participants counter */}
        <Tooltip
          label={`${participants} participant${participants !== 1 ? 's' : ''} in this chat`}
          placement="bottom"
          hasArrow
        >
          <Flex align="center">
            <Icon as={FaUsers} mr={1} fontSize="xs" />
            <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
              {participants}
            </Text>
          </Flex>
        </Tooltip>
      </Flex>
      
      {/* Security explainer */}
      {type === 'maximum' && isP2P && (
        <Flex
          align="center"
          mt={1}
          fontSize="xs"
          color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}
        >
          <Icon as={FaInfoCircle} mr={1} />
          <Text>
            Maximum security: direct P2P connection with forward secrecy.
          </Text>
        </Flex>
      )}
    </Box>
  );
};
