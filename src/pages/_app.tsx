// src/pages/_app.tsx
import React, { useEffect } from 'react';
import { AppProps } from 'next/app';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { Inter } from 'next/font/google';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import theme from '../theme';
import { AuthProvider } from '../contexts/AuthContext';
import { useAuth } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import '../styles/globals.css';

// Load Inter font
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const AuthProviderWithWallet = dynamic(() => 
  import('../contexts/AuthContext').then(mod => mod.AuthProvider), 
  { ssr: false }
);

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Polyfill Buffer for client-side
    if (typeof window !== 'undefined') {
      (window as any).Buffer = require('buffer/').Buffer;
    }
  }, []);

  useEffect(() => {
    // Global navigation guard
    const handleRouteChange = (url: string) => {
      const protectedRoutes = ['/dashboard', '/settings', '/chat'];
      const isProtectedRoute = protectedRoutes.some(route => url.startsWith(route));
      
      if (isProtectedRoute && !isAuthenticated && !isLoading) {
        router.push('/auth/connect-wallet');
      }
    };
    
    // Listen for route changes
    router.events.on('routeChangeStart', handleRouteChange);
    
    // Clean up listener
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [isAuthenticated, isLoading, router]);

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
        <Component {...pageProps} />
      </ChakraProvider>
    </>
  );
}

export default function App(props: AppProps) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <MyApp {...props} />
          </ErrorBoundary>
        </ThemeProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
