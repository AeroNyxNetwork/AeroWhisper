// src/components/ui/CertificateWarning.tsx
import React from 'react';
import { Box, Alert, AlertIcon, AlertTitle, AlertDescription, Link, Button, Text } from '@chakra-ui/react';

export function shouldShowCertificateWarning(): boolean {
  // Check if we've already shown the certificate warning and user acknowledged it
  if (typeof window !== 'undefined') {
    const acknowledged = localStorage.getItem('certificate-warning-acknowledged');
    if (acknowledged) {
      const timestamp = parseInt(acknowledged, 10);
      // If acknowledged within last 7 days, don't show again
      if (Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000) {
        return false;
      }
    }
    
    // Only show for secure connections with WebSockets (wss://)
    return window.location.protocol === 'https:';
  }
  return false;
}

interface CertificateWarningProps {
  serverUrl: string;
}

export const CertificateWarning: React.FC<CertificateWarningProps> = ({ serverUrl }) => {
  const [dismissed, setDismissed] = React.useState(false);
  
  // Extract the host part of the WebSocket URL
  const serverUrlObj = new URL(serverUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'));
  const serverHostUrl = serverUrlObj.origin;
  
  const handleAcknowledge = () => {
    localStorage.setItem('certificate-warning-acknowledged', Date.now().toString());
    setDismissed(true);
  };
  
  if (dismissed) return null;
  
  return (
    <Alert status="warning" variant="solid" borderRadius="md">
      <AlertIcon />
      <Box flex="1">
        <AlertTitle>Connection Certificate Notice</AlertTitle>
        <AlertDescription>
          <Text mb={2}>
            If you experience connection issues, you may need to visit the server URL in your browser 
            first to accept its security certificate.
          </Text>
          <Link href={serverHostUrl} isExternal color="white" textDecoration="underline">
            Visit {serverHostUrl}
          </Link>
        </AlertDescription>
      </Box>
      <Button onClick={handleAcknowledge} size="sm" colorScheme="orange" variant="outline">
        I understand
      </Button>
    </Alert>
  );
};
