//src/pages/auth/connect-wallet.tsx

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Button, Text, Flex, Box, useColorMode } from '@chakra-ui/react';
import { ConnectionButton } from '../../auth/ConnectionButton';
import { generateKeyPair } from '../../utils/cryptoUtils';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';

const ConnectWalletPage = () => {
  const router = useRouter();
  const { colorMode } = useColorMode();
  const { login, isLoading } = useAuth();
  const [error, setError] = useState('');

  const handleConnect = async () => {
    try {
      await login();
      console.log('Login successful, redirecting to dashboard');
      router.push('/dashboard');
      console.log('Redirect initiated');
      
    } catch (error) {
      setError('Failed to connect wallet. Please try again.');
      console.error(error);
    }
  };

  const handleGenerateKeyPair = async () => {
    try {
      const keyPair = await generateKeyPair();
      
      // Convert Uint8Arrays to regular arrays for proper serialization
      const serializableKeyPair = {
        publicKey: Array.from(keyPair.publicKey),
        secretKey: Array.from(keyPair.secretKey),
        publicKeyBase58: keyPair.publicKeyBase58
      };
      
      localStorage.setItem('aero-keypair', JSON.stringify(serializableKeyPair));
      router.push('/dashboard');
    } catch (error) {
      setError('Failed to generate keypair. Please try again.');
      console.error(error);
    }
  };

  return (
    <Layout>
      <Flex 
        direction="column" 
        align="center" 
        justify="center" 
        minH="80vh"
        p={8}
        bg={colorMode === 'dark' ? 'gray.800' : 'gray.50'}
        borderRadius="xl"
        boxShadow="xl"
      >
        <Box 
          mb={8}
          p={6}
          bg={colorMode === 'dark' ? 'gray.700' : 'white'}
          borderRadius="lg"
          boxShadow="md"
          w="100%"
          maxW="500px"
          textAlign="center"
        >
          <Text fontSize="2xl" fontWeight="bold" mb={6}>
            Connect to AeroNyx
          </Text>
          
          <Text mb={8} color={colorMode === 'dark' ? 'gray.300' : 'gray.600'}>
            Choose how you want to use AeroNyx Private Messaging
          </Text>
          
          <ConnectionButton
            onClick={handleConnect}
            isLoading={isLoading}  // Changed from isConnecting to isLoading
            mb={4}
            w="100%"
          >
            Connect with Solana Wallet
          </ConnectionButton>
          
          <Button 
            onClick={handleGenerateKeyPair}
            variant="outline"
            size="lg"
            w="100%"
            colorScheme="purple"
          >
            Generate New Keypair
          </Button>
          
          {error && (
            <Text color="red.500" mt={4}>
              {error}
            </Text>
          )}
        </Box>
      </Flex>
    </Layout>
  );
};

export default ConnectWalletPage;
