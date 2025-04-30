// src/pages/auth/connect-wallet.tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  Button, Text, Flex, Box, useColorMode, Heading,
  VStack, HStack, Divider, useToast, Alert, AlertIcon,
  AlertDescription, Fade, ScaleFade, Image
} from '@chakra-ui/react';
import { FaWallet, FaKey, FaLock, FaShieldAlt } from 'react-icons/fa';
import { ConnectionButton } from '../../auth/ConnectionButton';
import { generateKeyPair } from '../../utils/cryptoUtils';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';

const ConnectWalletPage = () => {
  const router = useRouter();
  const { colorMode } = useColorMode();
  const { login, isLoading } = useAuth();
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasAppeared, setHasAppeared] = useState(false);
  const toast = useToast();

  // Entrance animation effect
  useEffect(() => {
    setHasAppeared(true);
  }, []);

  const handleConnect = async () => {
    try {
      setError('');
      await login();
      
      toast({
        title: "Login successful",
        description: "Redirecting you to dashboard...",
        status: "success",
        duration: 2000,
      });
      
      // Small delay for better UX
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);
      
    } catch (error) {
      console.error("Login error:", error);
      setError('Failed to connect wallet. Please try again.');
      
      toast({
        title: "Connection Failed",
        description: "Unable to connect to wallet. Please try again.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleGenerateKeyPair = async () => {
    try {
      setError('');
      setIsGenerating(true);
      
      // Simulate slight delay for better user feedback
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const keyPair = await generateKeyPair();
      
      // Convert Uint8Arrays to regular arrays for proper serialization
      const serializableKeyPair = {
        publicKey: Array.from(keyPair.publicKey),
        secretKey: Array.from(keyPair.secretKey),
        publicKeyBase58: keyPair.publicKeyBase58
      };
      
      localStorage.setItem('aero-keypair', JSON.stringify(serializableKeyPair));
      
      toast({
        title: "Keypair Generated Successfully",
        description: "Your secure identity has been created",
        status: "success",
        duration: 3000,
      });
      
      // Small delay for better UX
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);
      
    } catch (error) {
      console.error("Keypair generation error:", error);
      setError('Failed to generate keypair. Please try again.');
      
      toast({
        title: "Generation Failed",
        description: "Unable to generate secure keypair. Please try again.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const bgColor = colorMode === 'dark' ? 'gray.800' : 'gray.50';
  const cardBg = colorMode === 'dark' ? 'gray.700' : 'white';
  const primaryBorderColor = colorMode === 'dark' ? 'purple.400' : 'purple.200';
  const secondaryBorderColor = colorMode === 'dark' ? 'blue.400' : 'blue.200';
  const textColor = colorMode === 'dark' ? 'gray.300' : 'gray.600';
  const headingColor = colorMode === 'dark' ? 'white' : 'gray.800';

  return (
    <Layout>
      <Flex 
        direction="column" 
        align="center" 
        justify="center" 
        minH="85vh"
        p={{ base: 4, md: 8 }}
        bg={bgColor}
        transition="all 0.3s ease"
      >
        <ScaleFade in={hasAppeared} initialScale={0.9}>
          <Box 
            p={{ base: 6, md: 8 }}
            bg={cardBg}
            borderRadius="xl"
            boxShadow="lg"
            w="100%"
            maxW="550px"
            textAlign="center"
            transition="all 0.3s ease"
            borderWidth="1px"
            borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
          >
            <Flex justify="center" mb={6}>
              <Image 
                src="/images/logo.png" 
                alt="AeroNyx Logo"
                height="60px"
                fallback={<Box height="60px" width="60px" bg="purple.500" borderRadius="md" />}
              />
            </Flex>
            
            <Heading 
              fontSize={{ base: "xl", md: "2xl" }} 
              fontWeight="bold" 
              mb={3}
              color={headingColor}
            >
              Connect to AeroNyx
            </Heading>
            
            <Text 
              mb={8} 
              color={textColor}
              fontSize={{ base: "sm", md: "md" }}
            >
              Choose how you want to use AeroNyx Private Messaging
            </Text>
            
            {error && (
              <Fade in={true}>
                <Alert status="error" mb={6} borderRadius="md">
                  <AlertIcon />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </Fade>
            )}
            
            <VStack spacing={6} align="stretch">
              <Box 
                p={5} 
                borderWidth="1px" 
                borderRadius="lg" 
                borderColor={primaryBorderColor}
                bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                _hover={{
                  boxShadow: "md",
                  borderColor: colorMode === 'dark' ? 'purple.300' : 'purple.300',
                  transform: "translateY(-2px)"
                }}
                transition="all 0.3s ease"
              >
                <Flex 
                  align="center" 
                  mb={4}
                  color="purple.500"
                >
                  <Box 
                    bg={colorMode === 'dark' ? 'purple.900' : 'purple.50'} 
                    p={2} 
                    borderRadius="md" 
                    mr={3}
                  >
                    <FaWallet size="18px" />
                  </Box>
                  <Heading size="md" fontWeight="600">Connect with Solana Wallet</Heading>
                </Flex>
                
                <Text fontSize="sm" color={textColor} mb={4}>
                  Use your existing Solana wallet to authenticate securely
                  without creating a new account.
                </Text>
                
                <ConnectionButton
                  onClick={handleConnect}
                  isLoading={isLoading}
                  loadingText="Connecting..."
                  mb={2}
                  size="lg"
                  height="50px"
                  w="100%"
                  colorScheme="purple"
                  leftIcon={<FaLock />}
                >
                  Connect Securely
                </ConnectionButton>
              </Box>
              
              <HStack>
                <Divider />
                <Text fontSize="sm" color={textColor} px={3} whiteSpace="nowrap">
                  OR
                </Text>
                <Divider />
              </HStack>
              
              <Box 
                p={5} 
                borderWidth="1px" 
                borderRadius="lg"
                borderColor={secondaryBorderColor}
                bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                _hover={{
                  boxShadow: "md",
                  borderColor: colorMode === 'dark' ? 'blue.300' : 'blue.300',
                  transform: "translateY(-2px)"
                }}
                transition="all 0.3s ease"
              >
                <Flex 
                  align="center" 
                  mb={4}
                  color="blue.500"
                >
                  <Box 
                    bg={colorMode === 'dark' ? 'blue.900' : 'blue.50'} 
                    p={2} 
                    borderRadius="md" 
                    mr={3}
                  >
                    <FaKey size="18px" />
                  </Box>
                  <Heading size="md" fontWeight="600">Generate New Keypair</Heading>
                </Flex>
                
                <Text fontSize="sm" color={textColor} mb={4}>
                  Create a new Ed25519 keypair for secure end-to-end encrypted messaging.
                  No blockchain wallet required.
                </Text>
                
                <Button 
                  onClick={handleGenerateKeyPair}
                  isLoading={isGenerating}
                  loadingText="Generating Secure Keys..."
                  size="lg"
                  height="50px"
                  w="100%"
                  colorScheme="blue"
                  variant="outline"
                  leftIcon={<FaShieldAlt />}
                >
                  Generate New Keypair
                </Button>
              </Box>
            </VStack>
            
            <Flex 
              align="center" 
              justify="center" 
              mt={8} 
              p={3} 
              borderRadius="md"
              bg={colorMode === 'dark' ? 'gray.800' : 'gray.50'}
            >
              <Text fontSize="xs" color={textColor} textAlign="center">
                Your keys are stored locally and never sent to our servers.
                All messages are end-to-end encrypted for maximum privacy.
              </Text>
            </Flex>
          </Box>
        </ScaleFade>
      </Flex>
    </Layout>
  );
};

export default ConnectWalletPage;
