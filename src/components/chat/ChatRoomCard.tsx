// src/components/chat/ChatRoomCard.tsx
import React from 'react';
import { 
  Box, Flex, Text, Badge, useColorMode, 
  Icon, Heading, VStack, HStack
} from '@chakra-ui/react';
import { FaShieldAlt, FaUsers, FaClock } from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';
import { ChatRoom } from '../../types/chat';

interface ChatRoomCardProps {
  room: ChatRoom;
  onClick: () => void;
}

export const ChatRoomCard: React.FC<ChatRoomCardProps> = ({ room, onClick }) => {
  const { colorMode } = useColorMode();
  
  // Calculate time since last activity
  const getTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return 'Unknown time';
    }
  };
  
  const lastActivity = room.lastActivity 
    ? getTimeAgo(room.lastActivity) 
    : getTimeAgo(room.createdAt);
  
  return (
    <Box
      p={4}
      borderRadius="lg"
      boxShadow="md"
      bg={colorMode === 'dark' ? 'gray.700' : 'white'}
      cursor="pointer"
      onClick={onClick}
      transition="all 0.2s"
      _hover={{
        transform: 'translateY(-4px)',
        boxShadow: 'lg',
        bg: colorMode === 'dark' ? 'gray.600' : 'gray.50',
      }}
    >
      <VStack align="stretch" spacing={4}>
        <Flex justify="space-between" align="start">
          <Heading size="md" mb={1} isTruncated>
            {room.name}
          </Heading>
          {room.unreadCount ? (
            <Badge colorScheme="purple" borderRadius="full" px={2}>
              {room.unreadCount}
            </Badge>
          ) : null}
        </Flex>
        
        <Text 
          noOfLines={2} 
          fontSize="sm" 
          color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}
        >
          {room.preview || 'Start a new conversation'}
        </Text>
        
        <HStack spacing={4} mt={2}>
          <Flex align="center">
            <Icon as={FaUsers} mr={1} />
            <Text fontSize="xs">{room.participants}</Text>
          </Flex>
          
          {room.isEphemeral && (
            <Flex align="center">
              <Icon as={FaClock} mr={1} />
              <Text fontSize="xs">Ephemeral</Text>
            </Flex>
          )}
          
          {room.useP2P && (
            <Flex align="center">
              <Icon as={FaShieldAlt} mr={1} />
              <Text fontSize="xs">P2P</Text>
            </Flex>
          )}
        </HStack>
        
        <Text 
          fontSize="xs" 
          color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}
        >
          {lastActivity}
        </Text>
      </VStack>
    </Box>
  );
};
