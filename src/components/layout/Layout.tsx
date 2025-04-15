import React, { useEffect, useState } from 'react';
import { Box, Flex, useColorMode } from '@chakra-ui/react';
import { Header } from './Header';
import { Footer } from './Footer';
import { useRouter } from 'next/router';
import { CertificateWarning, shouldShowCertificateWarning } from '../ui/CertificateWarning';

interface LayoutProps {
  children: React.ReactNode;
  hideFooter?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, hideFooter = false }) => {
  const { colorMode } = useColorMode();
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  
  // Check if this is a chat page
  const isChatPage = router.pathname.startsWith('/chat/');

  useEffect(() => {
    // Check if we should show certificate warning
    // Only check on client side
    if (typeof window !== 'undefined') {
      setShowWarning(shouldShowCertificateWarning());
    }
  }, []);

  const serverUrl = typeof process !== 'undefined' ? 
    (process.env.NEXT_PUBLIC_AERONYX_SERVER_URL || 'wss://aeronyx-server.example.com') : 
    'wss://aeronyx-server.example.com';

  return (
    <Flex 
      direction="column" 
      minH="100vh"
      bg={colorMode === 'dark' ? 'gray.900' : 'gray.50'}
      transition="background 0.2s ease"
    >
      <Header />
      
      <Box 
        as="main" 
        flex="1"
        maxW={isChatPage ? '100%' : '1200px'} 
        w="100%" 
        mx="auto"
        px={isChatPage ? 0 : 4}
      >
        {showWarning && (
          <Box mt={4} mx={4}>
            <CertificateWarning serverUrl={serverUrl} />
          </Box>
        )}
        {children}
      </Box>
      
      {!hideFooter && !isChatPage && <Footer />}
    </Flex>
  );
};
