import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { 
  Box, VStack, Text, Heading, Button, Flex, Icon, 
  Divider, useColorMode, useToast, Alert, AlertIcon, 
  AlertDescription, Progress, HStack, Link, Badge,
  SimpleGrid
} from '@chakra-ui/react';
import { 
  FaWallet, FaKey, FaUser, FaExternalLinkAlt, 
  FaPlus, FaCheck, FaExclamationTriangle
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';

// Wallet option display component
interface WalletOptionProps {
  name: string;
  icon: string;
  isDetected: boolean;
  installUrl: string;
  onClick: () => void;
  isLoading?: boolean;
  isDisabled?: boolean;
}

const WalletOption: React.FC<WalletOptionProps> = ({
  name,
  icon,
  isDetected,
  installUrl,
  onClick,
  isLoading = false,
  isDisabled = false
}) => {
  const { colorMode } = useColorMode();
  
  return (
    <Box
      p={4}
      borderWidth="1px"
      borderRadius="lg"
      borderColor={isDetected ? 'purple.400' : 'gray.300'}
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      _hover={!isDisabled ? { 
        transform: isDetected ? 'translateY(-4px)' : 'none', 
        shadow: isDetected ? 'lg' : 'none',
        borderColor: isDetected ? 'purple.500' : 'gray.300'
      } : {}}
      transition="all 0.3s ease"
      opacity={isDisabled ? 0.6 : 1}
    >
      <VStack spacing={3}>
        <Box 
          w="40px" 
          h="40px" 
          borderRadius="full" 
          overflow="hidden"
        >
          {/* Using img instead of Image for broader compatibility */}
          <img src={icon} alt={name} width="40" height="40" />
        </Box>
        
        <Text fontWeight="medium">{name}</Text>
        
        {isDetected ? (
          <Badge colorScheme="green">Detected</Badge>
        ) : (
          <Badge colorScheme="gray">Not Installed</Badge>
        )}
        
        {isDetected ? (
          <Button
            size="sm"
            colorScheme="purple"
            onClick={onClick}
            isLoading={isLoading}
            isDisabled={isDisabled}
            width="full"
          >
            Connect
          </Button>
        ) : (
          <Button
            as="a"
            href={installUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            colorScheme="blue"
            variant="outline"
            rightIcon={<FaExternalLinkAlt size="12px" />}
            width="full"
          >
            Install
          </Button>
        )}
      </VStack>
    </Box>
  );
};

export const SolanaSmartOnboarding: React.FC = () => {
  const router = useRouter();
  const { colorMode } = useColorMode();
  const toast = useToast();
  
  const { 
    isAuthenticated,
    isLoading,
    solanaWallet,
    connectWallet,
    generateNewKeypair,
    login
  } = useAuth();
  
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Define Solana wallets
  const solanaWallets = [
    {
      name: 'Phantom',
      icon: '/wallet-icons/phantom.png',
      isDetected: solanaWallet.hasWallet && solanaWallet.walletType === 'phantom',
      installUrl: 'https://phantom.app/download'
    },
    {
      name: 'Solflare',
      icon: '/wallet-icons/solflare.png',
      isDetected: solanaWallet.hasWallet && solanaWallet.walletType === 'solflare',
      installUrl: 'https://solflare.com/download'
    },
    {
      name: 'OKX Wallet',
      icon: '/wallet-icons/okx.png',
      isDetected: solanaWallet.hasWallet && solanaWallet.walletType === 'okx',
      installUrl: 'https://www.okx.com/web3/wallet'
    },
    {
      name: 'Backpack',
      icon: '/wallet-icons/backpack.png',
      isDetected: solanaWallet.hasWallet && solanaWallet.walletType === 'backpack',
      installUrl: 'https://www.backpack.app/download'
    }
  ];
  
  // Handle wallet connection
  const handleConnectWallet = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const user = await connectWallet();
      
      if (user) {
        toast({
          title: "Wallet connected",
          description: `Successfully connected to ${solanaWallet.walletName}`,
          status: "success",
          duration: 3000,
        });
        
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect wallet');
      
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : 'Failed to connect wallet',
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle keypair generation
  const handleCreateAccount = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const user = await generateNewKeypair();
      
      if (user) {
        toast({
          title: "Account created",
          description: "Your secure account has been created",
          status: "success",
          duration: 3000,
        });
        
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Failed to create account:', error);
      setError(error instanceof Error ? error.message : 'Failed to create account');
      
      toast({
        title: "Account creation failed",
        description: error instanceof Error ? error.message : 'Failed to create account',
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Loading state during wallet detection
  if (solanaWallet.isDetecting) {
    return (
      <VStack spacing={6} w="100%" p={8} textAlign="center">
        <Heading size="lg">Detecting Solana Wallets...</Heading>
        <Progress isIndeterminate colorScheme="purple" w="80%" maxW="400px" />
        <Text>We're detecting Solana wallets to provide the best experience.</Text>
      </VStack>
    );
  }
  
  return (
    <VStack spacing={8} w="100%" p={6} textAlign="center" maxW="800px" mx="auto">
      <Heading 
        size="xl" 
        bgGradient="linear(to-r, purple.500, blue.500)" 
        bgClip="text"
      >
        Welcome to AeroNyx
      </Heading>
      
      <Text fontSize="lg">
        Secure, end-to-end encrypted messaging with Solana-based encryption
      </Text>
      
      {error && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Box w="100%" textAlign="left">
        <Heading size="md" mb={4}>Connect with Solana Wallet</Heading>
        
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={8}>
          {solanaWallets.map((wallet) => (
            <WalletOption
              key={wallet.name}
              name={wallet.name}
              icon={wallet.icon}
              isDetected={wallet.isDetected}
              installUrl={wallet.installUrl}
              onClick={handleConnectWallet}
              isLoading={isProcessing && wallet.isDetected}
              isDisabled={isProcessing}
            />
          ))}
        </SimpleGrid>
      </Box>
      
      <Divider />
      
      <Box w="100%">
        <Heading size="md" mb={4}>Or Create a New Account</Heading>
        
        <Box 
          p={6}
          borderWidth="1px"
          borderRadius="xl"
          borderColor="blue.400"
          bg={colorMode === 'dark' ? 'gray.800' : 'white'}
          _hover={!isProcessing ? { 
            transform: 'translateY(-4px)', 
            shadow: 'lg',
            borderColor: 'blue.500' 
          } : {}}
          transition="all 0.3s ease"
        >
          <VStack spacing={4} align="center">
            <Icon as={FaKey} boxSize={12} color="blue.500" />
            
            <Heading size="md">
              Create Secure Account
            </Heading>
            
            <Text>
              Create an encrypted account instantly without a wallet. Perfect for getting started quickly.
            </Text>
            
            <HStack spacing={2}>
              <Badge colorScheme="blue">Recommended for New Users</Badge>
              <Badge colorScheme="green">No Wallet Required</Badge>
            </HStack>
            
            <Button
              colorScheme="blue"
              leftIcon={<FaUser />}
              onClick={handleCreateAccount}
              isLoading={isProcessing}
              isDisabled={isProcessing}
              size="lg"
              w="full"
              maxW="300px"
            >
              Create Account
            </Button>
            
            <Text fontSize="sm" color="gray.500">
              Creates a secure keypair stored only on your device
            </Text>
          </VStack>
        </Box>
      </Box>
      
      <Alert 
        status="info" 
        variant="subtle" 
        flexDirection="column" 
        alignItems="center"
        borderRadius="md"
        p={4}
      >
        <AlertIcon boxSize={6} mr={0} />
        <AlertDescription maxWidth="sm" mt={3} textAlign="center">
          AeroNyx uses Solana-based encryption for maximum security.
          All messages are end-to-end encrypted and your keys never leave your device.
        </AlertDescription>
      </Alert>
    </VStack>
  );
};
