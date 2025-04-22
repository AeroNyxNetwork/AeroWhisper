// src/components/settings/EncryptionSettings.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Switch,
  Text,
  VStack,
  HStack,
  Icon,
  Badge,
  useColorMode,
  Divider,
  RadioGroup,
  Radio,
  Tooltip,
  Select,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { FaLock, FaInfoCircle, FaSave, FaExclamationTriangle } from 'react-icons/fa';
import { isAesGcmSupported } from '../../utils/cryptoUtils';

interface EncryptionSettings {
  preferredMethod: 'aes-gcm' | 'chacha20poly1305' | 'auto';
  keySize: 128 | 256;
  fieldName: 'encryption_algorithm' | 'encryption' | 'auto';
}

const defaultSettings: EncryptionSettings = {
  preferredMethod: 'auto',
  keySize: 256,
  fieldName: 'auto',
};

export const EncryptionSettings: React.FC = () => {
  const { colorMode } = useColorMode();
  const [settings, setSettings] = useState<EncryptionSettings>(defaultSettings);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [aesGcmSupported, setAesGcmSupported] = useState<boolean>(true);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);

  // Check for AES-GCM support on component mount
  useEffect(() => {
    const checkSupport = async () => {
      const supported = await isAesGcmSupported();
      setAesGcmSupported(supported);
    };
    
    checkSupport();
    
    // Load existing settings from localStorage
    try {
      const savedSettings = localStorage.getItem('aero-encryption-settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings) as EncryptionSettings;
        setSettings(parsedSettings);
      }
    } catch (error) {
      console.error('Failed to load encryption settings:', error);
    }
  }, []);

  // Handle settings changes
  const handleSettingChange = (field: keyof EncryptionSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setSaveStatus('idle');
  };

  // Save settings to localStorage
  const saveSettings = () => {
    try {
      localStorage.setItem('aero-encryption-settings', JSON.stringify(settings));
      setIsDirty(false);
      setSaveStatus('saved');
      
      // Reset status after delay
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('Failed to save encryption settings:', error);
      setSaveStatus('error');
    }
  };

  // Reset to default settings
  const resetSettings = () => {
    setSettings(defaultSettings);
    setIsDirty(true);
    setSaveStatus('idle');
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
        <HStack justify="space-between">
          <HStack>
            <Icon as={FaLock} color="purple.500" boxSize={6} mr={2} />
            <Heading size="md">Encryption Settings</Heading>
          </HStack>
          {!aesGcmSupported && (
            <Badge colorScheme="red" p={2} borderRadius="md">
              <Icon as={FaExclamationTriangle} mr={1} />
              AES-GCM Not Supported
            </Badge>
          )}
        </HStack>
        
        {!aesGcmSupported && (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Encryption Compatibility Warning</AlertTitle>
              <AlertDescription>
                Your browser doesn't fully support AES-GCM encryption which may cause issues
                with secure messaging. Consider using a more modern browser.
              </AlertDescription>
            </Box>
          </Alert>
        )}
        
        <FormControl>
          <FormLabel fontWeight="medium">Preferred Encryption Method</FormLabel>
          <RadioGroup 
            value={settings.preferredMethod} 
            onChange={(val) => handleSettingChange('preferredMethod', val)}
          >
            <VStack align="start" spacing={2}>
              <Radio value="auto">
                <HStack>
                  <Text>Automatic (Recommended)</Text>
                  <Tooltip label="System will determine the best encryption method based on browser support.">
                    <span><Icon as={FaInfoCircle} ml={1} color="gray.500" /></span>
                  </Tooltip>
                </HStack>
              </Radio>
              <Radio value="aes-gcm" isDisabled={!aesGcmSupported}>
                <HStack>
                  <Text>AES-GCM</Text>
                  {aesGcmSupported ? (
                    <Badge colorScheme="green">Supported</Badge>
                  ) : (
                    <Badge colorScheme="red">Not Supported</Badge>
                  )}
                </HStack>
              </Radio>
              <Radio value="chacha20poly1305">
                <Text>ChaCha20-Poly1305 (Legacy)</Text>
              </Radio>
            </VStack>
          </RadioGroup>
        </FormControl>
        
        <Divider />
        
        <FormControl display="flex" alignItems="center">
          <FormLabel htmlFor="advanced-mode" mb="0">
            Show Advanced Settings
          </FormLabel>
          <Switch 
            id="advanced-mode" 
            isChecked={isAdvancedMode}
            onChange={() => setIsAdvancedMode(!isAdvancedMode)}
          />
        </FormControl>
        
        {isAdvancedMode && (
          <>
            <FormControl>
              <FormLabel fontWeight="medium">Encryption Key Size</FormLabel>
              <Select 
                value={settings.keySize.toString()} 
                onChange={(e) => handleSettingChange('keySize', parseInt(e.target.value))}
              >
                <option value="256">256-bit (Recommended)</option>
                <option value="128">128-bit (Faster, less secure)</option>
              </Select>
            </FormControl>
            
            <FormControl>
              <FormLabel fontWeight="medium">Encryption Field Name</FormLabel>
              <RadioGroup 
                value={settings.fieldName} 
                onChange={(val) => handleSettingChange('fieldName', val)}
              >
                <VStack align="start" spacing={2}>
                  <Radio value="auto">
                    <Text>Automatic (Recommended)</Text>
                  </Radio>
                  <Radio value="encryption_algorithm">
                    <Text>encryption_algorithm</Text>
                  </Radio>
                  <Radio value="encryption">
                    <Text>encryption</Text>
                  </Radio>
                </VStack>
              </RadioGroup>
              <Text fontSize="sm" color="gray.500" mt={2}>
                This affects how encryption information is shared with the server and other clients. 
                Only change if experiencing connection issues.
              </Text>
            </FormControl>
          </>
        )}
        
        <Divider />
        
        <HStack justify="space-between">
          <Button 
            variant="outline" 
            onClick={resetSettings}
            size="sm"
          >
            Reset to Default
          </Button>
          
          <Button
            colorScheme="purple"
            onClick={saveSettings}
            isDisabled={!isDirty}
            leftIcon={<FaSave />}
            size="md"
          >
            {saveStatus === 'saved' ? 'Saved!' : 'Save Settings'}
          </Button>
        </HStack>
        
        {saveStatus === 'error' && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <AlertTitle>Save Error</AlertTitle>
            <AlertDescription>
              Failed to save settings. Please try again.
            </AlertDescription>
          </Alert>
        )}
      </VStack>
    </Box>
  );
};
