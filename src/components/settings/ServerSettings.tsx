// src/components/settings/ServerSettings.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Icon,
  Input,
  Text,
  VStack,
  useColorMode,
  useToast,
  Divider,
  Switch,
  Badge,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  InputGroup,
  InputLeftAddon,
  Code,
} from '@chakra-ui/react';
import {
  FaServer,
  FaNetworkWired,
  FaCheck,
  FaTimes,
  FaRedo,
  FaSyncAlt,
} from 'react-icons/fa';
import { 
  getServerUrl, 
  setServerUrlOverride, 
  clearServerUrlOverride, 
  testServerConnection,
  isUsingMockServer
} from '../../utils/serverConfig';

interface ServerSettingsProps {
  onSave?: () => void;
}

export const ServerSettings: React.FC<ServerSettingsProps> = ({ onSave }) => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  
  const [serverUrl, setServerUrl] = useState<string>('');
  const [originalServerUrl, setOriginalServerUrl] = useState<string>('');
  const [useMockServer, setUseMockServer] = useState<boolean>(false);
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{success: boolean, message: string} | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // Load current settings
  useEffect(() => {
    const currentUrl = getServerUrl();
    setServerUrl(currentUrl);
    setOriginalServerUrl(currentUrl);
    setUseMockServer(isUsingMockServer());
  }, []);
  
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);
    
    try {
      // Format URL if needed
      let urlToTest = serverUrl;
      if (!urlToTest.startsWith('wss://') && !urlToTest.startsWith('ws://')) {
        urlToTest = `wss://${urlToTest}`;
      }
      
      const result = await testServerConnection(urlToTest);
      setTestResult(result);
      
      if (result.success) {
        toast({
          title: "Connection successful",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: "Connection failed",
          description: result.message,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsTestingConnection(false);
    }
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Format URL if needed
      let formattedUrl = serverUrl;
      if (!formattedUrl.startsWith('wss://') && !formattedUrl.startsWith('ws://')) {
        formattedUrl = `wss://${formattedUrl}`;
      }
      
      // Set the override or clear it if we're back to the original
      if (formattedUrl !== originalServerUrl) {
        setServerUrlOverride(formattedUrl);
      } else {
        clearServerUrlOverride();
      }
      
      toast({
        title: "Server settings saved",
        description: "Server configuration updated. You may need to refresh the page for changes to take effect.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      
      if (onSave) {
        onSave();
      }
    } catch (error) {
      console.error('Error saving server settings:', error);
      toast({
        title: "Failed to save settings",
        description: error instanceof Error ? error.message : String(error),
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleReset = () => {
    clearServerUrlOverride();
    const defaultUrl = process.env.NEXT_PUBLIC_AERONYX_SERVER_URL || 'wss://aeronyx-server.example.com';
    setServerUrl(defaultUrl);
    
    toast({
      title: "Server settings reset",
      description: "Server configuration has been reset to default.",
      status: "info",
      duration: 3000,
      isClosable: true,
    });
  };
  
  const isUsingDefault = serverUrl === originalServerUrl;
  
  return (
    <Box
      p={6}
      borderRadius="lg"
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      boxShadow="md"
      w="100%"
    >
      <VStack spacing={8} align="stretch">
        <Flex align="center">
          <Icon as={FaServer} color="purple.500" boxSize={6} mr={3} />
          <Heading size="md">Server Configuration</Heading>
        </Flex>
        
        <Divider />
        
        <Alert 
          status="info" 
          variant="subtle"
          flexDirection="column"
          alignItems="flex-start"
          borderRadius="md"
        >
          <Flex>
            <AlertIcon />
            <AlertTitle mr={2}>Server Information</AlertTitle>
          </Flex>
          <AlertDescription>
            Configure the AeroNyx server connection. Changes will apply after you save and refresh the page.
          </AlertDescription>
        </Alert>
        
        <Box>
          <Heading size="sm" mb={4}>WebSocket Server</Heading>
          
          <VStack spacing={5} align="stretch">
            <FormControl id="server-url">
              <FormLabel>Server URL</FormLabel>
              <InputGroup>
                <InputLeftAddon>wss://</InputLeftAddon>
                <Input
                  value={serverUrl.replace(/^wss?:\/\//, '')}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="example.com or 35.229.220.88:8080"
                />
              </InputGroup>
              <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'} mt={1}>
                {isUsingDefault ? (
                  <Badge colorScheme="green">Default</Badge>
                ) : (
                  <Badge colorScheme="purple">Custom</Badge>
                )}
                {' '}Using {serverUrl}
              </Text>
            </FormControl>
            
            <Flex gap={4}>
              <Button
                leftIcon={<FaSyncAlt />}
                onClick={handleTestConnection}
                isLoading={isTestingConnection}
                loadingText="Testing"
                colorScheme="blue"
              >
                Test Connection
              </Button>
              
              <Button
                leftIcon={<FaRedo />}
                onClick={handleReset}
                variant="outline"
              >
                Reset to Default
              </Button>
            </Flex>
            
            {testResult && (
              <Alert
                status={testResult.success ? "success" : "error"}
                variant="left-accent"
                borderRadius="md"
              >
                <AlertIcon />
                <AlertDescription>
                  {testResult.message}
                </AlertDescription>
              </Alert>
            )}
            
            <Divider />
            
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="use-mock-server" mb="0">
                Use Mock Server (Offline Mode)
              </FormLabel>
              <Switch
                id="use-mock-server"
                colorScheme="purple"
                isChecked={useMockServer}
                onChange={(e) => setUseMockServer(e.target.checked)}
                isDisabled={true} // This requires environment variable changes
              />
            </FormControl>
            
            <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
              The mock server setting is controlled by the <Code>NEXT_PUBLIC_USE_MOCK_SERVER</Code> environment variable.
              Edit <Code>.env.local</Code> to change this setting.
            </Text>
            
            <Alert status="warning" borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle>Self-Signed Certificate Notice</AlertTitle>
                <AlertDescription>
                  If your server uses a self-signed SSL certificate, you may need to visit 
                  <Code ml={2} mr={2}>https://{serverUrl.replace(/^wss?:\/\//, '')}</Code>
                  in your browser first to accept the certificate.
                </AlertDescription>
              </Box>
            </Alert>
          </VStack>
        </Box>
        
        <Divider />
        
        <Flex justifyContent="flex-end">
          <Button
            colorScheme="purple"
            onClick={handleSave}
            isLoading={isSaving}
            loadingText="Saving"
            size="lg"
          >
            Save Server Settings
          </Button>
        </Flex>
      </VStack>
    </Box>
  );
};
