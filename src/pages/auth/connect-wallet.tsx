// src/pages/auth/connect-wallet.tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  Box, 
  Center, 
  Flex, 
  Text, 
  Heading, 
  Button, 
  VStack, 
  HStack, 
  Icon, 
  Divider, 
  Badge,
  useColorMode, 
  useToast, 
  Alert, 
  AlertIcon, 
  AlertDescription,
  Progress,
  SimpleGrid,
  Link
} from '@chakra-ui/react';
import { 
  FaWallet, 
  FaKey, 
  FaUser, 
  FaExternalLinkAlt, 
  FaExclamationTriangle 
} from 'react-icons/fa';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';

// SVG Icon Components
const PhantomIcon = () => (
  <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <path d="M113.6 14.4v69.4c0 16.9-13.7 30.6-30.6 30.6H14.4V45c0-16.9 13.7-30.6 30.6-30.6h68.6z" fill="#ab9ff2" />
    <path d="M96.6 42c2.6 0 4.7 2.1 4.7 4.7 0 2.6-2.1 4.7-4.7 4.7-2.6 0-4.7-2.1-4.7-4.7 0-2.6 2.1-4.7 4.7-4.7zm-21.6 0h7.5c1.5 0 2.6 1.2 2.6 2.6 0 1.5-1.2 2.6-2.6 2.6H75c-1.5 0-2.6-1.2-2.6-2.6 0-1.5 1.1-2.6 2.6-2.6zm-21.5 0h7.5c1.5 0 2.6 1.2 2.6 2.6 0 1.5-1.2 2.6-2.6 2.6h-7.5c-1.5 0-2.6-1.2-2.6-2.6 0-1.5 1.2-2.6 2.6-2.6zM32 42h7.5c1.5 0 2.6 1.2 2.6 2.6 0 1.5-1.2 2.6-2.6 2.6H32c-1.5 0-2.6-1.2-2.6-2.6 0-1.5 1.2-2.6 2.6-2.6zm53.2 15.8c6.1 0 11.1 5 11.1 11.1 0 6.1-5 11.1-11.1 11.1H72.9v-5.8c8 0 14.5-6.5 14.5-14.5s-6.5-14.5-14.5-14.5H37.3c-4.9 0-8.9 4-8.9 8.9s4 8.9 8.9 8.9h35.6c3.2 0 5.8-2.6 5.8-5.8s-2.6-5.8-5.8-5.8h-25v5.8h23.1c1.5 0 2.6 1.2 2.6 2.6 0 1.5-1.2 2.6-2.6 2.6H36c-7.5 0-13.6-6.1-13.6-13.6S28.5 36.1 36 36.1h38.4c9.6 0 17.4 7.8 17.4 17.4 0 1.7-0.2 3.4-0.7 5h-5.9z" fill="#4e44ce" />
  </svg>
);

const SolflareIcon = () => (
  <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <circle cx="64" cy="64" r="64" fill="#FC9A24" />
    <path d="M108.4 60.1L84.8 27.5c-1.8-2.7-4.9-4.3-8.1-4.3H38.1c-6.9 0-10.8 7.8-6.6 13.2l16.7 20.4c2.6 3.2 0.7 8-3.3 8H26.7c-3.7 0-6 4.1-4 7.3l28.8 45.2c4 6.3 13.6 1.8 11.1-5.2l-9.4-26.8c-1.4-4 1.5-8.1 5.8-8.1h13.8c2.9 0 5.6 1.4 7.2 3.8l25.1 36.9c4.3 6.3 14.5 3.3 14.5-4.3V67.3c0-2.7-1-5.4-2.8-7.4l-8.4-9.8z" fill="white" />
  </svg>
);

const OKXIcon = () => (
  <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="24" fill="#121212" />
    <path d="M64 86.4c-12.3 0-22.4-10-22.4-22.4s10-22.4 22.4-22.4 22.4 10 22.4 22.4-10 22.4-22.4 22.4zm0-36c-7.5 0-13.6 6.1-13.6 13.6S56.5 77.6 64 77.6 77.6 71.5 77.6 64 71.5 50.4 64 50.4z" fill="#FFFFFF" />
  </svg>
);

const BackpackIcon = () => (
  <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <circle cx="64" cy="64" r="64" fill="#121212" />
    <path d="M90.5 67.8h-53c-1.7 0-3.1-1.4-3.1-3.1v-28c0-1.7 1.4-3.1 3.1-3.1h53c1.7 0 3.1 1.4 3.1 3.1v28c0 1.7-1.4 3.1-3.1 3.1z" fill="#E4E4E4" />
    <path d="M37.5 67.8v25.8c0 1.7 1.4 3.1 3.1 3.1h46.8c1.7 0 3.1-1.4 3.1-3.1V67.8H37.5z" fill="#25D1F8" />
    <path d="M45.8 54.6h36.4v-4h-36.4v4zm0-9h36.4v-4h-36.4v4z" fill="#FFFFFF" />
  </svg>
);

// Wallet option display component
interface WalletOptionProps {
  name: string;
  icon: React.ReactNode;
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
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
        >
          {icon ? (
            icon
          ) : (
            <Icon as={FaWallet} boxSize="20px" color="gray.400" />
          )}
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
            rightIcon={<Icon as={FaExternalLinkAlt} boxSize="12px" />}
            width="full"
          >
            Install
          </Button>
        )}
      </VStack>
    </Box>
  );
};

const ConnectWalletPage = () => {
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
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);
  
  // Define Solana wallets with SVG icons
  const solanaWallets = [
    {
      name: 'Phantom',
      icon: <PhantomIcon />,
      isDetected: solanaWallet?.hasWallet && solanaWallet?.walletType === 'phantom',
      installUrl: 'https://phantom.app/download'
    },
    {
      name: 'Solflare',
      icon: <SolflareIcon />,
      isDetected: solanaWallet?.hasWallet && solanaWallet?.walletType === 'solflare',
      installUrl: 'https://solflare.com/download'
    },
    {
      name: 'OKX Wallet',
      icon: <OKXIcon />,
      isDetected: solanaWallet?.hasWallet && solanaWallet?.walletType === 'okx',
      installUrl: 'https://www.okx.com/web3/wallet'
    },
    {
      name: 'Backpack',
      icon: <BackpackIcon />,
      isDetected: solanaWallet?.hasWallet && solanaWallet?.walletType === 'backpack',
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
          description: `Successfully connected to ${solanaWallet?.walletName}`,
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
  if (solanaWallet?.isDetecting) {
    return (
      <Layout>
        <Center h="calc(100vh - 80px)">
          <VStack spacing={6} w="100%" p={8} textAlign="center">
            <Heading size="lg">Detecting Solana Wallets...</Heading>
            <Progress isIndeterminate colorScheme="purple" w="80%" maxW="400px" />
            <Text>We're detecting Solana wallets to provide the best experience.</Text>
          </VStack>
        </Center>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <Box minH="calc(100vh - 80px)" bg={colorMode === 'dark' ? 'gray.900' : 'gray.50'}>
        <Center py={12}>
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
                    leftIcon={<Icon as={FaUser} />}
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
        </Center>
      </Box>
    </Layout>
  );
};

export default ConnectWalletPage;
