import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { Center, Spinner, Text, VStack } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';

const IndexPage = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      // If authenticated, redirect to dashboard
      if (isAuthenticated) {
        router.push('/dashboard');
      } else {
        // If not authenticated, redirect to onboarding or auth page
        router.push('/auth/connect-wallet');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <Center height="100vh" bg="gray.50">
      <VStack spacing={4}>
        <Spinner size="xl" color="purple.500" thickness="4px" />
        <Text fontSize="lg">Loading AeroNyx Secure Chat...</Text>
      </VStack>
    </Center>
  );
};

export default IndexPage;
