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
  Link,
  Tooltip,
  useMediaQuery
} from '@chakra-ui/react';
import { 
  FaWallet, 
  FaKey, 
  FaUser, 
  FaExternalLinkAlt, 
  FaExclamationTriangle,
  FaInfoCircle,
  FaShieldAlt
} from 'react-icons/fa';
import { motion } from 'framer-motion';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';

// SVG Icon Components with enhanced design
const PhantomIcon = () => (
  <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="phantomGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ab9ff2" />
        <stop offset="100%" stopColor="#4e44ce" />
      </linearGradient>
    </defs>
    <path d="M113.6 14.4v69.4c0 16.9-13.7 30.6-30.6 30.6H14.4V45c0-16.9 13.7-30.6 30.6-30.6h68.6z" fill="url(#phantomGradient)" />
    <path d="M96.6 42c2.6 0 4.7 2.1 4.7 4.7 0 2.6-2.1 4.7-4.7 4.7-2.6 0-4.7-2.1-4.7-4.7 0-2.6 2.1-4.7 4.7-4.7zm-21.6 0h7.5c1.5 0 2.6 1.2 2.6 2.6 0 1.5-1.2 2.6-2.6 2.6H75c-1.5 0-2.6-1.2-2.6-2.6 0-1.5 1.1-2.6 2.6-2.6zm-21.5 0h7.5c1.5 0 2.6 1.2 2.6 2.6 0 1.5-1.2 2.6-2.6 2.6h-7.5c-1.5 0-2.6-1.2-2.6-2.6 0-1.5 1.2-2.6 2.6-2.6zM32 42h7.5c1.5 0 2.6 1.2 2.6 2.6 0 1.5-1.2 2.6-2.6 2.6H32c-1.5 0-2.6-1.2-2.6-2.6 0-1.5 1.2-2.6 2.6-2.6zm53.2 15.8c6.1 0 11.1 5 11.1 11.1 0 6.1-5 11.1-11.1 11.1H72.9v-5.8c8 0 14.5-6.5 14.5-14.5s-6.5-14.5-14.5-14.5H37.3c-4.9 0-8.9 4-8.9 8.9s4 8.9 8.9 8.9h35.6c3.2 0 5.8-2.6 5.8-5.8s-2.6-5.8-5.8-5.8h-25v5.8h23.1c1.5 0 2.6 1.2 2.6 2.6 0 1.5-1.2 2.6-2.6 2.6H36c-7.5 0-13.6-6.1-13.6-13.6S28.5 36.1 36 36.1h38.4c9.6 0 17.4 7.8 17.4 17.4 0 1.7-0.2 3.4-0.7 5h-5.9z" fill="white" />
  </svg>
);

const SolflareIcon = () => (
  <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="solflareGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FC9A24" />
        <stop offset="100%" stopColor="#FF7A00" />
      </linearGradient>
    </defs>
    <circle cx="64" cy="64" r="64" fill="url(#solflareGradient)" />
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
    <defs>
      <linearGradient id="backpackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#121212" />
        <stop offset="100%" stopColor="#2D2D2D" />
      </linearGradient>
    </defs>
    <circle cx="64" cy="64" r="64" fill="url(#backpackGradient)" />
    <path d="M90.5 67.8h-53c-1.7 0-3.1-1.4-3.1-3.1v-28c0-1.7 1.4-3.1 3.1-3.1h53c1.7 0 3.1 1.4 3.1 3.1v28c0 1.7-1.4 3.1-3.1 3.1z" fill="#E4E4E4" />
    <path d="M37.5 67.8v25.8c0 1.7 1.4 3.1 3.1 3.1h46.8c1.7 0 3.1-1.4 3.1-3.1V67.8H37.5z" fill="#25D1F8" />
    <path d="M45.8 54.6h36.4v-4h-36.4v4zm0-9h36.4v-4h-36.4v4z" fill="#FFFFFF" />
  </svg>
);

const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

// Wallet option display component with micro-interactions
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
    <MotionBox
      p={4}
      borderWidth="2px"
      borderRadius="xl"
      borderColor={isDetected ? 'purple.400' : 'gray.300'}
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      _hover={!isDisabled ? { 
        borderColor: isDetected ? 'purple.500' : 'gray.400',
        shadow: isDetected ? 'lg' : 'md',
      } : {}}
      transition="all 0.3s ease"
      opacity={isDisabled ? 0.6 : 1}
      whileHover={!isDisabled ? { y: -8, scale: 1.03 } : {}}
      whileTap={!isDisabled && isDetected ? { scale: 0.98 } : {}}
    >
      <VStack spacing={4}>
        <MotionBox 
          w="48px" 
          h="48px" 
          borderRadius="xl" 
          overflow="hidden"
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
          whileHover={{ rotate: 5 }}
          transition={{ duration: 0.2 }}
        >
          {icon ? (
            icon
          ) : (
            <Icon as={FaWallet} boxSize="24px" color="gray.400" />
          )}
        </MotionBox>
        
        <Text fontWeight="bold" fontSize="md">{name}</Text>
        
        {isDetected ? (
          <Badge colorScheme="green" borderRadius="full" px={3} py={1}>
            Detected
          </Badge>
        ) : (
          <Badge colorScheme="gray" borderRadius="full" px={3} py={1}>
            Not Installed
          </Badge>
        )}
        
        {isDetected ? (
          <Button
            size="md"
            colorScheme="purple"
            onClick={onClick}
            isLoading={isLoading}
            isDisabled={isDisabled}
            width="full"
            borderRadius="xl"
            fontWeight="bold"
            _hover={{ transform: 'translateY(-2px)', shadow: 'md' }}
            leftIcon={<Icon as={FaWallet} boxSize="16px" />}
          >
            Connect
          </Button>
        ) : (
          <Button
            as="a"
            href={installUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="md"
            colorScheme="blue"
            variant="outline"
            rightIcon={<Icon as={FaExternalLinkAlt} boxSize="14px" />}
            width="full"
            borderRadius="xl"
            fontWeight="bold"
            _hover={{ transform: 'translateY(-2px)', shadow: 'md' }}
          >
            Install
          </Button>
        )}
      </VStack>
    </MotionBox>
  );
};

// Security bar at the top
const SecurityBar = () => {
  const { colorMode } = useColorMode();
  
  return (
    <Flex
      bg={colorMode === 'dark' ? 'green.800' : 'green.50'}
      color={colorMode === 'dark' ? 'white' : 'green.700'}
      py={2}
      px={4}
      alignItems="center"
      justifyContent="center"
      borderBottomWidth="1px"
      borderBottomColor={colorMode === 'dark' ? 'green.700' : 'green.100'}
    >
      <Icon as={FaShieldAlt} mr={2} />
      <Text fontSize="sm" fontWeight="medium">End-to-end encrypted & secure connection</Text>
    </Flex>
  );
};

// Enhanced tooltip component for education
const InfoTooltip = ({ label }: { label: string }) => (
  <Tooltip label={label} placement="top" hasArrow>
    <Box as="span" ml={1} display="inline-flex">
      <Icon as={FaInfoCircle} color="gray.400" boxSize="14px" />
    </Box>
  </Tooltip>
);

const ConnectWalletPage = () => {
  const router = useRouter();
  const { colorMode } = useColorMode();
  const toast = useToast();
  const [isLargerThan768] = useMediaQuery("(min-width: 768px)");
  
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
          isClosable: true,
          position: "top-right",
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
        position: "top-right",
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
          isClosable: true,
          position: "top-right",
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
        position: "top-right",
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Loading state during wallet detection
  if (solanaWallet?.isDetecting) {
    return (
      <Layout>
        <SecurityBar />
        <Center h="calc(100vh - 80px)" bg={colorMode === 'dark' ? 'gray.900' : 'gray.50'}>
          <MotionBox 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            p={8}
            maxW="500px"
            w="100%"
            textAlign="center"
            borderRadius="2xl"
            bg={colorMode === 'dark' ? 'gray.800' : 'white'}
            shadow="xl"
          >
            <VStack spacing={6} w="100%">
              <MotionBox
                animate={{ rotate: [0, 360] }}
                transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
              >
                <Icon as={FaWallet} boxSize={16} color="purple.400" />
              </MotionBox>
              <Heading size="lg">Detecting Wallets...</Heading>
              <Progress isIndeterminate colorScheme="purple" w="100%" h="4px" borderRadius="full" />
              <Text color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
                Scanning for Solana wallets to provide a secure connection experience.
              </Text>
            </VStack>
          </MotionBox>
        </Center>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <SecurityBar />
      <Box 
        minH="calc(100vh - 80px)" 
        bg={colorMode === 'dark' ? 'gray.900' : 'gray.50'}
        backgroundImage={colorMode === 'dark' ? 
          'linear-gradient(to bottom right, rgba(66, 39, 90, 0.1), rgba(28, 28, 40, 0.4))' : 
          'linear-gradient(to bottom right, rgba(247, 250, 252, 0.8), rgba(237, 242, 247, 0.8))'
        }
      >
        <Center py={12}>
          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            w="100%" 
            maxW="900px" 
            mx="auto"
          >
            <VStack spacing={8} p={6} textAlign="center">
              <Heading 
                size="xl" 
                bgGradient="linear(to-r, purple.500, blue.500)" 
                bgClip="text"
                letterSpacing="tight"
              >
                Welcome to AeroNyx
              </Heading>
              
              <Text fontSize="lg" maxW="600px" color={colorMode === 'dark' ? 'gray.300' : 'gray.600'}>
                Seamless, secure messaging with Solana-based encryption that keeps your conversations private.
              </Text>
              
              {error && (
                <Alert status="error" borderRadius="xl" variant="left-accent">
                  <AlertIcon />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <MotionFlex
                w="100%"
                direction={isLargerThan768 ? "row" : "column"}
                spacing={isLargerThan768 ? "40px" : "24px"}
                align="stretch"
                p={6}
                borderRadius="2xl"
                bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                shadow="xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <Box flex={isLargerThan768 ? "1.2" : "1"} textAlign="left" mb={isLargerThan768 ? 0 : 8}>
                  <Heading size="md" mb={4} display="flex" alignItems="center">
                    Connect with Solana Wallet
                    <InfoTooltip label="Use your existing Solana wallet for maximum security and ownership of your keys" />
                  </Heading>
                  
                  <SimpleGrid columns={{ base: 2, md: 2 }} spacing={6} mb={8}>
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
                
                {isLargerThan768 && <Divider orientation="vertical" />}
                {!isLargerThan768 && <Divider />}
                
                <Box flex="1" textAlign="left">
                  <Heading size="md" mb={4} display="flex" alignItems="center">
                    Create a New Account
                    <InfoTooltip label="Quick start without a wallet - your keys are generated and stored securely on your device" />
                  </Heading>
                  
                  <MotionBox 
                    p={6}
                    borderWidth="2px"
                    borderRadius="xl"
                    borderColor="blue.400"
                    bg={colorMode === 'dark' ? 'blue.900' : 'blue.50'}
                    transition="all 0.3s ease"
                    whileHover={!isProcessing ? { y: -8, scale: 1.02 } : {}}
                    whileTap={!isProcessing ? { scale: 0.98 } : {}}
                  >
                    <VStack spacing={5} align="center">
                      <MotionBox
                        whileHover={{ rotate: 10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Icon as={FaKey} boxSize={12} color="blue.500" />
                      </MotionBox>
                      
                      <Heading size="md">
                        Secure Keypair Account
                      </Heading>
                      
                      <Text textAlign="center">
                        Get started instantly with a secure encrypted account. Perfect for beginners and quick access.
                      </Text>
                      
                      <HStack spacing={2} flexWrap="wrap" justifyContent="center">
                        <Badge colorScheme="blue" borderRadius="full" px={3} py={1}>Recommended for New Users</Badge>
                        <Badge colorScheme="green" borderRadius="full" px={3} py={1}>No Wallet Required</Badge>
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
                        borderRadius="xl"
                        fontWeight="bold"
                        _hover={{ transform: 'translateY(-2px)', shadow: 'md' }}
                      >
                        Create Account
                      </Button>
                      
                      <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                        Creates a secure keypair stored only on your device
                      </Text>
                    </VStack>
                  </MotionBox>
                </Box>
              </MotionFlex>
              
              <Alert 
                status="info" 
                variant="subtle" 
                flexDirection="column" 
                alignItems="center"
                borderRadius="xl"
                p={4}
                bg={colorMode === 'dark' ? 'blue.900' : 'blue.50'}
                borderWidth="1px"
                borderColor={colorMode === 'dark' ? 'blue.800' : 'blue.100'}
                maxW="800px"
              >
                <AlertIcon boxSize={6} mr={0} />
                <AlertDescription maxWidth="sm" mt={3} textAlign="center" fontSize="sm">
                  AeroNyx uses Solana-based encryption for maximum security.
                  All messages are end-to-end encrypted and your keys never leave your device.
                </AlertDescription>
              </Alert>
            </VStack>
          </MotionBox>
        </Center>
      </Box>
    </Layout>
  );
};

export default ConnectWalletPage;
