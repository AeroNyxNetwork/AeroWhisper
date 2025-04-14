import React from 'react';
import { Button, ButtonProps, Flex, Text, Icon } from '@chakra-ui/react';
import { FaWallet } from 'react-icons/fa';

interface ConnectionButtonProps extends ButtonProps {
  onClick: () => void;
  isLoading?: boolean;
}

export const ConnectionButton: React.FC<ConnectionButtonProps> = ({
  onClick,
  isLoading,
  children,
  ...props
}) => {
  return (
    <Button
      size="lg"
      colorScheme="purple"
      onClick={onClick}
      isLoading={isLoading}
      leftIcon={<Icon as={FaWallet} />}
      _hover={{ transform: 'translateY(-2px)', transition: 'all 0.2s' }}
      {...props}
    >
      {children}
    </Button>
  );
};
