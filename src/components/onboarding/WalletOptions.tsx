// src/components/onboarding/WalletOptions.tsx
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Button,
  Divider,
  Flex,
  Grid,
  Heading,
  Icon,
  Text,
  VStack,
  useColorMode,
  useToast,
} from '@chakra-ui/react';
import { 
  FaWallet, 
  FaKey, 
  FaLock, 
  FaExclamationTriangle, 
  FaCheckCircle,
  FaSpinner
} from 'react-icons/fa';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';

interface WalletOptionsProps {
  onComplete: () => void;
}

const MotionBox = motion(Box);

export const WalletOptions: React.FC<WalletOptionsProps> = ({ onComplete }) => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const router = useRouter();
  const { connect, generateNewKeypair, isConnecting } = useAuth();
  const [activeOption, setActiveOption] = useState<'wallet' | 'generate' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleConnectWallet = async () => {
    setActiveOption('wallet');
    setIsLoading(true);
    
    try {
      await connect();
      setIsLoading(false);
      setIsSuccess(true);
      
      toast({
        title: "Wallet connected successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      setTimeout(() => {
        onComplete();
        router.push('/dashboard');
      }, 1500);
    } catch (error) {
      setIsLoading(false);
      toast({
        title: "Failed to connect wallet",
        description: "Please try again or choose a different option",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleGenerateKeypair = async () => {
    setActiveOption('generate');
    setIsLoading(true);
    
    try {
      await generateNewKeypair();
      setIsLoading(false);
      setIsSuccess(true);
      
      toast({
        title: "Keypair generated successfully",
        description: "Your secure identity has been created",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      setTimeout(() => {
        onComplete();
        router.push('/dashboard');
      }, 1500);
    } catch (error) {
      setIsLoading(false);
      toast({
        title: "Failed to generate keypair",
        description: "Please try again",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <VStack spacing={8} width="100%" maxW="800px" mx="auto" p={6}>
      <Heading
        size="xl"
        mb={4}
        textAlign="center"
        bgGradient="linear(to-r, purple.500, blue.500)"
        bgClip="text"
      >
        Choose Your Authentication Method
      </Heading>
      
      <Text textAlign="center" fontSize="lg" mb={8}>
        AeroNyx uses cryptographic keys to secure your messages. Select how you want to authenticate.
      </Text>
      
      <Grid 
        templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} 
        gap={8}
        width="100%"
      >
        {/* Wallet Connection Option */}
        <MotionBox
          p={6}
          borderRadius="xl"
          bg={colorMode === 'dark' ? 'gray.800' : 'white'}
          borderWidth="2px"
          borderColor={activeOption === 'wallet' 
            ? 'purple.500' 
            : colorMode === 'dark' ? 'gray.700' : 'gray.200'}
          boxShadow={activeOption === 'wallet' ? 'lg' : 'md'}
          cursor="pointer"
          onClick={() => !isLoading && !isSuccess && setActiveOption('wallet')}
          whileHover={{ scale: activeOption ? 1 : 1.03 }}
          transition={{ duration: 0.2 }}
        >
          <VStack spacing={6} align="center">
            <Flex
              w="80px"
              h="80px"
              borderRadius="full"
              bg={colorMode === 'dark' ? 'gray.700' : 'purple.100'}
              color="purple.500"
              justify="center"
              align="center"
            >
              {isLoading && activeOption === 'wallet' ? (
                <Icon as={FaSpinner} boxSize="40px" className="fa-spin" />
              ) : isSuccess && activeOption === 'wallet' ? (
                <Icon as={FaCheckCircle} boxSize="40px" />
              ) : (
                <Icon as={FaWallet} boxSize="40px" />
              )}
            </Flex>
            
            <Heading size="md">Connect Solana Wallet</Heading>
            
            <Text textAlign="center">
              Use your existing Solana wallet for military-grade security. Your private key never leaves your device.
            </Text>
            
            <Divider />
            
            <VStack spacing={2} w="100%">
              <Flex align="center" w="100%">
                <Icon as={FaLock} color="green.500" mr={2} />
                <Text>Highest security level</Text>
              </Flex>
              <Flex align="center" w="100%">
                <Icon as={FaKey} color="green.500" mr={2} />
                <Text>Use your existing wallet</Text>
              </Flex>
            </VStack>
            
            <Button
              colorScheme="purple"
              size="lg"
              width="100%"
              onClick={handleConnectWallet}
              isLoading={isLoading && activeOption === 'wallet'}
              isDisabled={isLoading || isSuccess}
              loadingText="Connecting Wallet"
            >
              {isSuccess && activeOption === 'wallet' ? "Connected" : "Connect Wallet"}
            </Button>
          </VStack>
        </MotionBox>
        
        {/* Generate Keypair Option */}
        <MotionBox
          p={6}
          borderRadius="xl"
          bg={colorMode === 'dark' ? 'gray.800' : 'white'}
          borderWidth="2px"
          borderColor={activeOption === 'generate' 
            ? 'blue.500' 
            : colorMode === 'dark' ? 'gray.700' : 'gray.200'}
          boxShadow={activeOption === 'generate' ? 'lg' : 'md'}
          cursor="pointer"
          onClick={() => !isLoading && !isSuccess && setActiveOption('generate')}
          whileHover={{ scale: activeOption ? 1 : 1.03 }}
          transition={{ duration: 0.2 }}
        >
          <VStack spacing={6} align="center">
            <Flex
              w="80px"
              h="80px"
              borderRadius="full"
              bg={colorMode === 'dark' ? 'gray.700' : 'blue.100'}
              color="blue.500"
              justify="center"
              align="center"
            >
              {isLoading && activeOption === 'generate' ? (
                <Icon as={FaSpinner} boxSize="40px" className="fa-spin" />
              ) : isSuccess && activeOption === 'generate' ? (
                <Icon as={FaCheckCircle} boxSize="40px" />
              ) : (
                <Icon as={FaKey} boxSize="40px" />
              )}
            </Flex>
            
            <Heading size="md">Generate New Keypair</Heading>
            
            <Text textAlign="center">
              Create a new keypair just for AeroNyx. Quick setup with no wallet required.
            </Text>
            
            <Divider />
            
            <VStack spacing={2} w="100%">
              <Flex align="center" w="100%">
                <Icon as={FaLock} color="green.500" mr={2} />
                <Text>Strong security</Text>
              </Flex>
              <Flex align="center" w="100%">
                <Icon as={FaExclamationTriangle} color="orange.500" mr={2} />
                <Text>Key stored on this device only</Text>
              </Flex>
            </VStack>
            
            <Button
              colorScheme="blue"
              size="lg"
              width="100%"
              onClick={handleGenerateKeypair}
              isLoading={isLoading && activeOption === 'generate'}
              isDisabled={isLoading || isSuccess}
              loadingText="Generating Keypair"
            >
              {isSuccess && activeOption === 'generate' ? "Generated" : "Generate Keypair"}
            </Button>
          </VStack>
        </MotionBox>
      </Grid>
      
      <Text mt={4} fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'} textAlign="center">
        Both methods provide end-to-end encryption for your messages.
        <br />The difference is where your keys are stored and managed.
      </Text>
    </VStack>
  );
};
