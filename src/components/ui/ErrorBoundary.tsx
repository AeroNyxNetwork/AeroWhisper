// src/components/ui/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Heading, Text, Button, VStack, useColorMode } from '@chakra-ui/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('UI Rendering Error:', error, errorInfo);
  }
  
  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <ErrorFallback 
          error={this.state.error} 
          resetError={() => this.setState({ hasError: false, error: null })} 
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  resetError: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError }) => {
  const { colorMode } = useColorMode();
  
  return (
    <Box 
      p={8} 
      bg={colorMode === 'dark' ? 'gray.800' : 'white'} 
      borderRadius="md"
      boxShadow="md"
      m={4}
    >
      <VStack spacing={4} align="flex-start">
        <Heading size="md" color="red.500">Something went wrong</Heading>
        <Text>Sorry, an error occurred while rendering the interface.</Text>
        {error && (
          <Box 
            p={4} 
            bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'} 
            w="100%" 
            borderRadius="md"
            fontFamily="monospace"
            fontSize="sm"
            overflowX="auto"
          >
            {error.message}
          </Box>
        )}
        <Button colorScheme="purple" onClick={resetError}>
          Try to recover
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Refresh page
        </Button>
      </VStack>
    </Box>
  );
};
