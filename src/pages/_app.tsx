// src/pages/_app.tsx
import React, { useState, useEffect } from 'react';
import { AppProps } from 'next/app';
import { 
  ChakraProvider, 
  ColorModeScript, 
  Center, 
  VStack, 
  Box, 
  Text, 
  Heading, 
  Progress, 
  useColorMode, 
  Flex, 
  HStack, 
  Icon, 
  Badge 
} from '@chakra-ui/react';
import { Inter } from 'next/font/google';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaLock, 
  FaShieldAlt, 
  FaFingerprint, 
  FaKey, 
  FaConnectdevelop, 
  FaNetworkWired,
  FaLink
} from 'react-icons/fa';
import theme from '../theme';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import Image from 'next/image';
import '../styles/globals.css';

// Load Inter font
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// Maximum loading time in milliseconds
const MAX_LOADING_TIME = 5000; 

// Motion components
const MotionBox = motion(Box);
const MotionFlex = motion(Flex);
const MotionText = motion(Text);

// Enhanced LoadingScreen component with web3 aesthetics
const Web3LoadingScreen = () => {
  const { colorMode } = useColorMode();
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [initializing, setInitializing] = useState(true);
  
  // Loading steps text
  const loadingSteps = [
    "Initializing application...",
    "Establishing secure connection...",
    "Checking encryption capabilities...",
    "Loading encryption libraries...",
    "Setting up peer-to-peer network...",
    "Verifying cryptographic modules...",
    "Preparing decentralized components...",
    "Syncing with network nodes...",
    "Loading application...",
    "Starting secure messaging environment...",
  ];
  
  // Simulate loading progress
  useEffect(() => {
    if (initializing) {
      setInitializing(false);
      return;
    }
    
    let currentStep = 0;
    let currentProgress = 0;
    
    const interval = setInterval(() => {
      if (currentProgress >= 100) {
        clearInterval(interval);
        return;
      }
      
      // Update progress
      currentProgress += Math.floor(Math.random() * 5) + 1;
      setLoadingProgress(Math.min(currentProgress, 100));
      
      // Update step occasionally
      if (currentProgress > (currentStep + 1) * 10 && currentStep < loadingSteps.length - 1) {
        currentStep++;
        setLoadingStep(currentStep);
      }
    }, 300);
    
    return () => clearInterval(interval);
  }, [initializing, loadingSteps.length]);
  
  return (
    <Center 
      height="100vh" 
      bg={colorMode === 'dark' ? 'gray.900' : 'gray.50'}
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={9999}
      overflow="hidden"
    >
      {/* Background decoration */}
      <Box 
        position="absolute" 
        top={0} 
        left={0} 
        right={0} 
        bottom={0} 
        opacity={0.03} 
        pointerEvents="none"
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <Box 
            key={i}
            position="absolute"
            top={`${i * 10}%`}
            left="10%"
            width="80%"
            height="1px"
            bg="purple.500"
          />
        ))}
        
        {Array.from({ length: 5 }).map((_, i) => (
          <Box 
            key={`circle-${i}`}
            position="absolute"
            top={`${Math.random() * 80}%`}
            left={`${Math.random() * 80}%`}
            width="8px"
            height="8px"
            borderRadius="full"
            bg="purple.500"
            opacity={0.2}
          />
        ))}
      </Box>
      
      <MotionFlex
        direction="column"
        align="center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        maxW="500px"
        w="100%"
        px={4}
      >
        <Box position="relative" width="100px" height="100px" mb={4}>
          <Image 
            src="/logo.svg" 
            alt="AeroNyx Logo"
            layout="fill"
            priority
          />
        </Box>
        
        <Heading 
          size="lg" 
          mb={3}
          bgGradient="linear(to-r, purple.500, blue.500)" 
          bgClip="text"
        >
          AeroNyx
        </Heading>
        
        <Text mb={6} textAlign="center">
          Secure end-to-end encrypted messaging with decentralized privacy
        </Text>
        
        <Box w="100%" mb={6}>
          <Text fontSize="sm" mb={1}>{loadingSteps[loadingStep]}</Text>
          <Progress 
            value={loadingProgress} 
            colorScheme="purple" 
            w="100%" 
            borderRadius="full"
            hasStripe
            isAnimated
          />
        </Box>
        
        <HStack spacing={6} wrap="wrap" justify="center">
          <MotionFlex 
            align="center" 
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Icon as={FaLock} mr={2} color="green.500" />
            <Text fontSize="sm">E2E Encrypted</Text>
          </MotionFlex>
          
          <MotionFlex 
            align="center" 
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2, delay: 0.3 }}
          >
            <Icon as={FaShieldAlt} mr={2} color="blue.500" />
            <Text fontSize="sm">Decentralized</Text>
          </MotionFlex>
          
          <MotionFlex 
            align="center" 
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2, delay: 0.6 }}
          >
            <Icon as={FaKey} mr={2} color="purple.500" />
            <Text fontSize="sm">Wallet Secured</Text>
          </MotionFlex>
        </HStack>
        
        <Box position="absolute" bottom={6}>
          <Badge colorScheme="purple">v0.9.7-beta</Badge>
        </Box>
      </MotionFlex>
    </Center>
  );
};

export default function App({ Component, pageProps }: AppProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Polyfill Buffer for client-side
    if (typeof window !== 'undefined') {
      (window as any).Buffer = require('buffer/').Buffer;
    }
    
    // Set up loading timeout
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
    }, MAX_LOADING_TIME);
    
    // Set up quick load check (to prevent flash of loading screen for fast loads)
    const quickCheckId = setTimeout(() => {
      // Check for any localStorage that indicates previous successful load
      try {
        const hasVisited = localStorage.getItem('aero-has-visited');
        if (hasVisited) {
          setIsLoading(false);
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }, 500);
    
    // Track that user has visited before
    try {
      localStorage.setItem('aero-has-visited', 'true');
    } catch (e) {
      // Ignore localStorage errors
    }
    
    // Clean up timeouts
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(quickCheckId);
    };
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>AeroNyx Secure Messaging</title>
        <meta name="description" content="End-to-end encrypted peer-to-peer messaging with AeroNyx" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#7762F3" />
      </Head>
      <style jsx global>{`
        :root {
          --font-inter: ${inter.variable};
        }
      `}</style>
      <ChakraProvider theme={theme}>
        <ColorModeScript initialColorMode={theme.config.initialColorMode} />
        <AuthProvider>
          <NotificationProvider>
            <ThemeProvider>
              <ErrorBoundary>
                {isLoading && <Web3LoadingScreen />}
                <Component {...pageProps} />
              </ErrorBoundary>
            </ThemeProvider>
          </NotificationProvider>
        </AuthProvider>
      </ChakraProvider>
    </>
  );
}
