import React, { useState } from 'react';
import {
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Button,
  Box,
  Collapse,
  Link,
  CloseButton,
} from '@chakra-ui/react';

interface CertificateWarningProps {
  serverUrl: string;
}

export const CertificateWarning: React.FC<CertificateWarningProps> = ({ serverUrl }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    // Store in localStorage to remember user's choice
    localStorage.setItem('certificate-warning-dismissed', 'true');
  };

  return (
    <Collapse in={isOpen} animateOpacity>
      <Alert status="warning" variant="solid" borderRadius="md" mb={4}>
        <AlertIcon />
        <Box flex="1">
          <AlertTitle mb={1}>Self-Signed Certificate</AlertTitle>
          <AlertDescription display="block">
            This app is connecting to {serverUrl} which uses a self-signed certificate. 
            You may see security warnings in your browser. This is expected during development.
            <Button
              size="sm"
              colorScheme="orange"
              variant="outline"
              mt={2}
              onClick={() => window.open(`https://${serverUrl.replace('wss://', '')}`, '_blank')}
            >
              Visit server to accept certificate
            </Button>
          </AlertDescription>
        </Box>
        <CloseButton
          alignSelf="flex-start"
          position="relative"
          right={-1}
          top={-1}
          onClick={handleDismiss}
        />
      </Alert>
    </Collapse>
  );
};

// Helper function to check if we should show the warning
export const shouldShowCertificateWarning = () => {
  // Only show in development or if using the IP address
  const isDev = process.env.NODE_ENV === 'development';
  const serverUrl = process.env.NEXT_PUBLIC_AERONYX_SERVER_URL || '';
  const isIPAddress = /^wss?:\/\/\d+\.\d+\.\d+\.\d+/.test(serverUrl);
  const previouslyDismissed = localStorage.getItem('certificate-warning-dismissed') === 'true';
  
  return (isDev || isIPAddress) && !previouslyDismissed;
};
