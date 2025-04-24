// src/components/ui/ConnectionIndicator.tsx
import React from 'react';
import { Flex, Text, Spinner, Icon, Box } from '@chakra-ui/react';
import { FaExclamationTriangle } from 'react-icons/fa';

interface ConnectionIndicatorProps {
  status: 'connecting' | 'error' | 'warning';
  message: string;
}

export const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({ status, message }) => {
  return (
    <Box
      w="100%"
      p={2}
      bg={status === 'connecting' ? 'yellow.400' : status === 'error' ? 'red.500' : 'orange.400'}
      color="white"
    >
      <Flex align="center" justify="center">
        {status === 'connecting' ? (
          <Spinner size="sm" mr={2} />
        ) : (
          <Icon as={FaExclamationTriangle} mr={2} />
        )}
        <Text fontWeight="medium">{message}</Text>
      </Flex>
    </Box>
  );
};
