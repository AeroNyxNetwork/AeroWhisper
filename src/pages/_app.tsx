// src/pages/_app.tsx
import React, { useState, useEffect } from 'react';
import { AppProps } from 'next/app';
import { ChakraProvider, ColorModeScript, Center, VStack, Box, Text, Heading, Progress, useColorMode } from '@chakra-ui/react';
import { Inter } from 'next/font/google';
import Head from 'next/head';
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

export default function App({ Component, pageProps }: AppProps) {
  const [isLoading, setIsLoading] = useState(true);
  const { colorMode } = useColorMode || { colorMode: 'light' };
  
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
  
  // Loading screen component
  const LoadingScreen = () => (
    <Center 
      height="100vh" 
      bg={colorMode === 'dark' ? 'gray.900' : 'gray.50'}
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={9999}
    >
      <VStack spacing={6}>
        <Box position="relative" width="80px" height="80px">
          <Image 
            src="/logo.svg" 
            alt="AeroNyx Logo"
            layout="fill"
            priority
          />
        </Box>
        <Heading 
          size="md" 
          bgGradient="linear(to-r, purple.500, blue.500)" 
          bgClip="text"
        >
          AeroNyx
        </Heading>
        <Text>Secure messaging loading...</Text>
        <Progress 
          isIndeterminate 
          colorScheme="purple" 
          w="300px" 
          borderRadius="full" 
        />
      </VStack>
    </Center>
  );

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
                {isLoading && <LoadingScreen />}
                <Component {...pageProps} />
              </ErrorBoundary>
            </ThemeProvider>
          </NotificationProvider>
        </AuthProvider>
      </ChakraProvider>
    </>
  );
}
