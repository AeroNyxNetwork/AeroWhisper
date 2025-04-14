import React, { useEffect } from 'react';
import { AppProps } from 'next/app';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { Inter } from 'next/font/google';
import Head from 'next/head';
import theme from '../theme';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import '../styles/globals.css';

// Load Inter font
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Polyfill Buffer for client-side
    if (typeof window !== 'undefined') {
      (window as any).Buffer = require('buffer/').Buffer;
    }
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
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              <Component {...pageProps} />
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </ChakraProvider>
    </>
  );
}
