// src/components/settings/EncryptionSettings.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Icon,
  Select,
  Switch,
  Text,
  VStack,
  useColorMode,
  useToast,
  Alert,
  AlertIcon,
  Collapse,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react';
import { 
  FaLock, 
  FaKey, 
  FaShieldAlt, 
  FaServer, 
  FaWrench, 
  FaSync,
  FaBug
} from 'react-icons/fa';
import { EncryptionDiagnostics } from './EncryptionDiagnostics';
import { isAesGcmSupported } from '../../utils/cryptoUtils';
import { testEncryptionFormat } from '../../utils/testCrypto';

interface EncryptionSettingsProps {
  onSave?: () => void;
}

/**
 * Encryption Settings Component
 * 
 * Allows configuration of encryption options and provides diagnostic tools
 */
export const EncryptionSettings: React.FC<EncryptionSettingsProps> = ({ onSave }) => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  
  // Settings state
  const [settings, setSettings] = useState({
    encryptionAlgorithm: 'aes-gcm',
    encryptionFieldName: 'encryption', // The field name used in data packets: 'encryption' or 'encryption_algorithm'
    preferP2P: true,
    keySize: 256, // bits
    sessionKeyRotation: false,
    sessionKeyRotationInterval: 24, // hours
    useFallbackEncryption: true,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [aesGcmSupported, setAesGcmSupported] = useState<boolean | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  // Check for AES-GCM support on component mount
  useEffect(() => {
    setAesGcmSupported(isAesGcmSupported());
    
    // Load existing settings from localStorage
    try {
      const savedSettings = localStorage.getItem('aero-encryption-settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Failed to load encryption settings:', error);
    }
  }, []);
  
  const handleSwitchChange = (name: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, [name]: e.target.checked });
  };
  
  const handleSelectChange = (name: string) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings({ ...settings, [name]: e.target.value });
  };
  
  const handleFixIssue = (fixType: string) => {
    const newSettings = { ...settings };
    
    // Apply different fixes based on the identified issue
    switch (fixType) {
      case 'use_encryption_algorithm_field':
        newSettings.encryptionFieldName = 'encryption_algorithm';
        toast({
          title: "Field name updated",
          description: "Changed encryption field to 'encryption_algorithm'",
          status: "info"
        });
        break;
        
      case 'use_encryption_field':
        newSettings.encryptionFieldName = 'encryption';
        toast({
          title: "Field name updated",
          description: "Changed encryption field to 'encryption'",
          status: "info"
        });
        break;
        
      case 'check_key_length':
        // Toggle between 256 and 128 bit keys
        newSettings.keySize = settings.keySize === 256 ? 128 : 256;
        toast({
          title: "Key size updated",
          description: `Changed encryption key size to ${newSettings.keySize} bits`,
          status: "info"
        });
        break;
        
      case 'unknown_error':
        // For unknown errors, we'll just refresh the settings
        newSettings.useFallbackEncryption = true;
        toast({
          title: "Fallback encryption enabled",
          description: "Enabled fallback encryption for better compatibility",
          status: "info"
        });
        break;
        
      default:
        toast({
          title: "No fix applied",
          description: "Unknown fix type specified",
          status: "warning"
        });
    }
    
    // Update settings state
    setSettings(newSettings);
    
    // Save the settings to localStorage
    try {
      localStorage.setItem('aero-encryption-settings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save encryption settings:', error);
    }
  };
  
  const saveSettings = async () => {
    setIsLoading(true);
    
    try {
      // Run a quick encryption test to validate settings
      const testResult = await testEncryptionFormat({test: "Validation"}, settings.encryptionFieldName);
      
      if (!testResult.success) {
        toast({
          title: "Validation Failed",
          description: "The encryption settings failed validation. Please run diagnostics to fix issues.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        setShowDiagnostics(true);
        return;
      }
      
      // Save settings to localStorage
      localStorage.setItem('aero-encryption-settings', JSON.stringify(settings));
      
      toast({
        title: "Encryption settings saved",
        description: "Your encryption settings have been updated.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      if (onSave) {
        onSave();
      }
    } catch (error) {
      console.error('Error saving encryption settings:', error);
      
      toast({
        title: "Failed to save settings",
        description: error instanceof Error ? error.message : String(error),
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetSettings = () => {
    // Default settings
    const defaultSettings = {
      encryptionAlgorithm: 'aes-gcm',
      encryptionFieldName: 'encryption',
      preferP2P: true,
      keySize: 256,
      sessionKeyRotation: false,
      sessionKeyRotationInterval: 24,
      useFallbackEncryption: true,
    };
    
    setSettings(defaultSettings);
    
    toast({
      title: "Settings reset",
      description: "Encryption settings have been reset to defaults.",
      status: "info",
      duration: 3000,
      isClosable: true,
    });
  };
  
  return (
    <Box
      p={6}
      borderRadius="lg"
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      boxShadow="md"
      w="100%"
    >
      <VStack spacing={6} align="stretch">
        <Flex align="center">
          <Icon as={FaKey} color="purple.500" boxSize={6} mr={3} />
          <Heading size="md">Encryption Settings</Heading>
        </Flex>
        
        {!aesGcmSupported && (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            Your browser may not fully support the recommended AES-GCM encryption method. 
            This may cause connection issues. Consider using a modern browser like Chrome, Firefox, or Safari.
          </Alert>
        )}
        
        <Tabs variant="soft-rounded" colorScheme="purple">
          <TabList mb={4}>
            <Tab>Settings</Tab>
            <Tab>Diagnostics</Tab>
          </TabList>
          
          <TabPanels>
            <TabPanel px={0}>
              <VStack spacing={6} align="stretch">
                <Box>
                  <Heading size="sm" mb={4}>Encryption Configuration</Heading>
                  
                  <VStack spacing={5} align="stretch">
                    <FormControl>
                      <FormLabel>Encryption Algorithm</FormLabel>
                      <Select
                        value={settings.encryptionAlgorithm}
                        onChange={handleSelectChange('encryptionAlgorithm')}
                      >
                        <option value="aes-gcm">AES-GCM (Recommended)</option>
                        <option value="chacha20poly1305">ChaCha20-Poly1305 (Limited Browser Support)</option>
                        <option value="aes-cbc">AES-CBC with HMAC (Legacy)</option>
                      </Select>
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Encryption Field Name</FormLabel>
                      <Select
                        value={settings.encryptionFieldName}
                        onChange={handleSelectChange('encryptionFieldName')}
                      >
                        <option value="encryption">encryption (Default)</option>
                        <option value="encryption_algorithm">encryption_algorithm (Alternative)</option>
                      </Select>
                      <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'} mt={1}>
                        The field name used in data packets. Change if you're having connection issues.
                      </Text>
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Key Size</FormLabel>
                      <Select
                        value={settings.keySize.toString()}
                        onChange={(e) => setSettings({...settings, keySize: parseInt(e.target.value)})}
                      >
                        <option value="256">256 bits (Recommended)</option>
                        <option value="128">128 bits (Higher Compatibility)</option>
                      </Select>
                    </FormControl>
                    
                    <FormControl display="flex" alignItems="center">
                      <FormLabel htmlFor="prefer-p2p" mb="0">
                        Prefer P2P Connections
                      </FormLabel>
                      <Switch
                        id="prefer-p2p"
                        colorScheme="purple"
                        isChecked={settings.preferP2P}
                        onChange={handleSwitchChange('preferP2P')}
                      />
                    </FormControl>
                    
                    <FormControl display="flex" alignItems="center">
                      <FormLabel htmlFor="session-key-rotation" mb="0">
                        Enable Session Key Rotation
                      </FormLabel>
                      <Switch
                        id="session-key-rotation"
                        colorScheme="purple"
                        isChecked={settings.sessionKeyRotation}
                        onChange={handleSwitchChange('sessionKeyRotation')}
                      />
                    </FormControl>
                    
                    {settings.sessionKeyRotation && (
                      <FormControl>
                        <FormLabel>Key Rotation Interval (hours)</FormLabel>
                        <Select
                          value={settings.sessionKeyRotationInterval.toString()}
                          onChange={(e) => setSettings({...settings, sessionKeyRotationInterval: parseInt(e.target.value)})}
                        >
                          <option value="1">1 hour</option>
                          <option value="6">6 hours</option>
                          <option value="12">12 hours</option>
                          <option value="24">24 hours</option>
                          <option value="48">48 hours</option>
                        </Select>
                      </FormControl>
                    )}
                    
                    <FormControl display="flex" alignItems="center">
                      <FormLabel htmlFor="use-fallback" mb="0">
                        Use Fallback Encryption
                      </FormLabel>
                      <Switch
                        id="use-fallback"
                        colorScheme="purple"
                        isChecked={settings.useFallbackEncryption}
                        onChange={handleSwitchChange('useFallbackEncryption')}
                      />
                    </FormControl>
                    <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
                      When enabled, AeroNyx will try alternative encryption methods if the preferred one fails.
                    </Text>
                  </VStack>
                </Box>
                
                <Divider />
                
                <Flex justify="space-between">
                  <Button
                    variant="outline"
                    onClick={resetSettings}
                    leftIcon={<FaSync />}
                  >
                    Reset to Defaults
                  </Button>
                  
                  <Button
                    colorScheme="purple"
                    onClick={saveSettings}
                    isLoading={isLoading}
                    loadingText="Saving"
                    leftIcon={<FaLock />}
                  >
                    Save Encryption Settings
                  </Button>
                </Flex>
              </VStack>
            </TabPanel>
            
            <TabPanel px={0}>
              <EncryptionDiagnostics onFixIssue={handleFixIssue} />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Box>
  );
};
