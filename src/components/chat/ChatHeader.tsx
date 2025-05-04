import React from 'react';
import { 
  Box, Flex, Heading, Text, Badge, 
  IconButton, useColorMode, Tooltip,
  HStack, Spacer
} from '@chakra-ui/react';
import { FaUserPlus, FaUsers } from 'react-icons/fa';
import { ConnectionStatus } from '../../types/chat';

// Define an extended connection status type
type ExtendedConnectionStatus = ConnectionStatus | 'p2p-connected' | 'p2p-connecting';

interface ChatHeaderProps {
  chatName: string;
  participants: number;
  connectionStatus: ExtendedConnectionStatus; // Changed from ConnectionStatus
  onInvite: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  chatName,
  participants,
  connectionStatus,
  onInvite,
}) => {
  const { colorMode } = useColorMode();
  
  // Get connection status badge info
  const getConnectionBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return { color: 'green', text: 'Connected' };
      case 'connecting':
        return { color: 'yellow', text: 'Connecting' };
      case 'p2p-connected':
        return { color: 'purple', text: 'P2P Connected' };
      case 'p2p-connecting':
        return { color: 'yellow', text: 'P2P Connecting' };
      case 'disconnected':
        return { color: 'red', text: 'Disconnected' };
      default:
        return { color: 'gray', text: 'Unknown' };
    }
  };
  
  const badge = getConnectionBadge();
  
  return (
    <Box
      p={4}
      borderBottom="1px solid"
      borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
    >
      <Flex align="center">
        <Box>
          <Heading size="md" mb={1}>{chatName}</Heading>
          <HStack spacing={3}>
            <Badge colorScheme={badge.color}>{badge.text}</Badge>
            <Flex align="center">
              <FaUsers size={14} style={{ marginRight: '6px' }} />
              <Text fontSize="sm">{participants} {participants === 1 ? 'participant' : 'participants'}</Text>
            </Flex>
          </HStack>
        </Box>
        
        <Spacer />
        
        <Tooltip label="Invite others" placement="top">
          <IconButton
            aria-label="Invite others"
            icon={<FaUserPlus />}
            variant="ghost"
            onClick={onInvite}
          />
        </Tooltip>
      </Flex>
    </Box>
  );
};
