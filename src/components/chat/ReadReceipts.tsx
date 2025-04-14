// src/components/chat/ReadReceipts.tsx
import React from 'react';
import { Flex, Icon, Tooltip, useColorMode } from '@chakra-ui/react';
import { FaCheck, FaCheckDouble, FaClock, FaBan } from 'react-icons/fa';

// Message status types
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

interface ReadReceiptsProps {
  status: MessageStatus;
  timestamp: Date | string;
  isHidden?: boolean;
}

export const ReadReceipts: React.FC<ReadReceiptsProps> = ({
  status,
  timestamp,
  isHidden = false
}) => {
  const { colorMode } = useColorMode();
  
  // Parse timestamp if it's a string
  const messageTime = typeof timestamp === 'string' 
    ? new Date(timestamp) 
    : timestamp;
  
  // Format timestamp for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  if (isHidden) {
    return null;
  }
  
  // Get icon and tooltip text based on status
  const getStatusDetails = () => {
    switch (status) {
      case 'sending':
        return {
          icon: FaClock,
          color: 'gray.500',
          tooltip: 'Sending...',
        };
      case 'sent':
        return {
          icon: FaCheck,
          color: 'gray.500',
          tooltip: `Sent at ${formatTime(messageTime)}`,
        };
      case 'delivered':
        return {
          icon: FaCheckDouble,
          color: 'gray.500',
          tooltip: `Delivered at ${formatTime(messageTime)}`,
        };
      case 'read':
        return {
          icon: FaCheckDouble,
          color: 'blue.500',
          tooltip: `Read at ${formatTime(messageTime)}`,
        };
      case 'failed':
        return {
          icon: FaBan,
          color: 'red.500',
          tooltip: 'Failed to send',
        };
      default:
        return {
          icon: FaCheck,
          color: 'gray.500',
          tooltip: `Sent at ${formatTime(messageTime)}`,
        };
    }
  };
  
  const { icon, color, tooltip } = getStatusDetails();
  
  return (
    <Tooltip label={tooltip} placement="top" hasArrow>
      <Flex
        align="center"
        opacity={0.8}
        _hover={{ opacity: 1 }}
        transition="opacity 0.2s"
      >
        <Icon 
          as={icon} 
          color={color} 
          boxSize={3} 
          mr={1}
        />
      </Flex>
    </Tooltip>
  );
};
