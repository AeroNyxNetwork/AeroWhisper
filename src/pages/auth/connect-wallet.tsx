import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Button, Text, Flex, Box, useColorMode } from '@chakra-ui/react';
import { ConnectionButton } from '../../components/auth/ConnectionButton';
import { generateKeyPair } from '../../utils/crypto';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';

const ConnectWalletPage = () => {
  const router = useRouter();
  const { colorMode } = useColorMode();
  const { connect, isConnecting } = useAuth();
  const [error, setError] = useState('');

  const handleConnect = async () => {
    try {
      await connect();
      router.push('/dashboard');
    } catch (error) {
      setError('Failed to connect wallet. Please try again.');
      console.error(error);
    }
  };

  const handleGenerateKeyPair = async () => {
    try {
      const keyPair = await generateKeyPair();
      localStorage.setItem('aero-keypair', JSON.stringify(keyPair));
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
            isLoading={isConnecting}
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
