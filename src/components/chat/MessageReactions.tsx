// src/components/chat/MessageReactions.tsx
import React, { useState } from 'react';
import {
  Box,
  Flex,
  HStack,
  IconButton,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  useColorMode,
  Text,
  Tooltip,
} from '@chakra-ui/react';
import { FaSmile, FaThumbsUp, FaHeart, FaLaugh, FaSadTear, FaAngry } from 'react-icons/fa';
import { motion } from 'framer-motion';

// Define the reaction types
const REACTIONS = [
  { emoji: '👍', icon: FaThumbsUp, label: 'Like' },
  { emoji: '❤️', icon: FaHeart, label: 'Love' },
  { emoji: '😂', icon: FaLaugh, label: 'Laugh' },
  { emoji: '😢', icon: FaSadTear, label: 'Sad' },
  { emoji: '😡', icon: FaAngry, label: 'Angry' },
];

interface Reaction {
  type: string;
  userId: string;
  userName?: string;
}

interface MessageReactionsProps {
  messageId: string;
  existingReactions?: Reaction[];
  onAddReaction: (messageId: string, reactionType: string) => void;
  isOwnMessage: boolean;
}

const MotionBox = motion(Box);

export const MessageReactions: React.FC<MessageReactionsProps> = ({
  messageId,
  existingReactions = [],
  onAddReaction,
  isOwnMessage,
}) => {
  const { colorMode } = useColorMode();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Group reactions by type to count them
  const reactionCounts = existingReactions.reduce((acc, reaction) => {
    if (!acc[reaction.type]) {
      acc[reaction.type] = [];
    }
    acc[reaction.type].push(reaction);
    return acc;
  }, {} as Record<string, Reaction[]>);

  const handleReactionClick = (reactionType: string) => {
    onAddReaction(messageId, reactionType);
    setIsPopoverOpen(false);
  };

  // Format user list for tooltip
  const formatReactedUsers = (reactions: Reaction[]) => {
    if (!reactions || reactions.length === 0) return "";
    
    const users = reactions.map(r => r.userName || 'Unknown user');
    if (users.length === 1) return users[0];
    if (users.length === 2) return `${users[0]} and ${users[1]}`;
    return `${users[0]}, ${users[1]} and ${users.length - 2} more`;
  };

  return (
    <Box mt={1}>
      <Flex direction="row" justifyContent={isOwnMessage ? 'flex-end' : 'flex-start'} alignItems="center">
        {/* Display existing reactions */}
        <HStack spacing={1} mr={2}>
          {Object.entries(reactionCounts).map(([type, reactions]) => (
            <Tooltip 
              key={type} 
              label={formatReactedUsers(reactions)}
              placement="top"
              hasArrow
            >
              <MotionBox
                display="flex"
                alignItems="center"
                px={2}
                py={1}
                borderRadius="full"
                bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
                cursor="pointer"
                onClick={() => handleReactionClick(type)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Text fontSize="xs" mr={1}>{type}</Text>
                <Text fontSize="xs">{reactions.length}</Text>
              </MotionBox>
            </Tooltip>
          ))}
        </HStack>
        
        {/* Add reaction button and popover */}
        <Popover
          isOpen={isPopoverOpen}
          onOpen={() => setIsPopoverOpen(true)}
          onClose={() => setIsPopoverOpen(false)}
          placement={isOwnMessage ? "left-start" : "right-start"}
        >
          <PopoverTrigger>
            <IconButton
              aria-label="Add reaction"
              icon={<FaSmile />}
              size="xs"
              variant="ghost"
              colorScheme="gray"
              opacity={0.7}
              _hover={{ opacity: 1 }}
            />
          </PopoverTrigger>
          <PopoverContent width="auto">
            <PopoverBody p={2}>
              <Flex>
                {REACTIONS.map((reaction) => (
                  <MotionBox
                    key={reaction.emoji}
                    p={2}
                    cursor="pointer"
                    borderRadius="md"
                    onClick={() => handleReactionClick(reaction.emoji)}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Text fontSize="lg">{reaction.emoji}</Text>
                  </MotionBox>
                ))}
              </Flex>
            </PopoverBody>
          </PopoverContent>
        </Popover>
      </Flex>
    </Box>
  );
};
