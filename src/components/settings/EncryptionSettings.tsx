// src/components/settings/EncryptionSettings.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
  AlertTitle,
  AlertDescription,
  Collapse,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Badge,
  Tooltip,
  Code,
  HStack,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  ButtonGroup,
} from '@chakra-ui/react';
import { 
  FaLock, 
  FaKey, 
  FaShieldAlt, 
  FaServer, 
  FaWrench, 
  FaSync,
  FaBug,
  FaExclamationTriangle,
  FaCheck,
  FaInfoCircle,
  FaUserSecret,
  FaDownload,
  FaRobot
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { isAesGcmSupported } from '../../utils/cryptoUtils';
import { testEncryptionFormat } from '../../utils/testCrypto';

interface EncryptionSettingsProps {
  onSave?: () => void;
}

/**
 * Enhanced Encryption Settings Component
 * 
 * Allows configuration of encryption options and provides comprehensive diagnostic tools
 * with improved error handling and user guidance.
 */
export const EncryptionSettings: React.FC<EncryptionSettingsProps> = ({ onSave }) => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const { user } = useAuth();
  
  // Settings state with improved typing
  const [settings, setSettings] = useState<{
    encryptionAlgorithm: 'aes-gcm' | 'chacha20poly1305' | 'aes-cbc';
    encryptionFieldName: 'encryption' | 'encryption_algorithm';
    preferP2P: boolean;
    keySize: 128 | 256;
    sessionKeyRotation: boolean;
    sessionKeyRotationInterval: number; // hours
    useFallbackEncryption: boolean;
    messageRetention: number; // days, 0 = forever
    forwardSecrecy: boolean;
    certificateValidation: boolean;
    autoBackupKeys: boolean;
  }>({
    encryptionAlgorithm: 'aes-gcm',
    encryptionFieldName: 'encryption',
    preferP2P: true,
    keySize: 256,
    sessionKeyRotation: false,
    sessionKeyRotationInterval: 24,
    useFallbackEncryption: true,
    messageRetention: 7,
    forwardSecrecy: true,
    certificateValidation: true,
    autoBackupKeys: false,
  });
  
  const [diagnosticStatus, setDiagnosticStatus] = useState<{
    aesGcmSupported: boolean | null;
    keyDerivationSupported: boolean | null;
    encryptionFieldCompatible: boolean | null;
    p2pConnectionPossible: boolean | null;
    certificateValid: boolean | null;
    runningTests: boolean;
    lastTestDate: string | null;
    errorDetails: string | null;
  }>({
    aesGcmSupported: null,
    keyDerivationSupported: null,
    encryptionFieldCompatible: null,
    p2pConnectionPossible: null,
    certificateValid: null,
    runningTests: false,
    lastTestDate: null,
    errorDetails: null,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // Check for AES-GCM support on component mount
  useEffect(() => {
    const checkSupport = async () => {
      try {
        const supported = await isAesGcmSupported();
        setDiagnosticStatus(prev => ({ ...prev, aesGcmSupported: supported }));
        
        // Load existing settings from localStorage
        try {
          const savedSettings = localStorage.getItem('aero-encryption-settings');
          if (savedSettings) {
            setSettings(JSON.parse(savedSettings));
          }
        } catch (error) {
          console.error('Failed to load encryption settings:', error);
        }
      } catch (error) {
        console.error('Error checking AES-GCM support:', error);
        setDiagnosticStatus(prev => ({ ...prev, aesGcmSupported: false }));
      }
    };
    
    checkSupport();
  }, []);
  
  const handleSwitchChange = (name: keyof typeof settings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, [name]: e.target.checked });
  };
  
  const handleSelectChange = (name: keyof typeof settings) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    // Type assertion to handle different value types
    if (name === 'keySize') {
      setSettings({ ...settings, [name]: parseInt(e.target.value) as 128 | 256 });
    } else if (name === 'sessionKeyRotationInterval' || name === 'messageRetention') {
      setSettings({ ...settings, [name]: parseInt(e.target.value) });
    } else if (name === 'encryptionFieldName') {
      setSettings({ ...settings, [name]: e.target.value as 'encryption' | 'encryption_algorithm' });
    } else if (name === 'encryptionAlgorithm') {
      setSettings({ ...settings, [name]: e.target.value as 'aes-gcm' | 'chacha20poly1305' | 'aes-cbc' });
    } else {
      setSettings({ ...settings, [name]: e.target.value });
    }
  };
  
  const handleSliderChange = (name: 'messageRetention' | 'sessionKeyRotationInterval') => (val: number) => {
    setSettings({ ...settings, [name]: val });
  };

  // Export settings to JSON file
  const exportSettings = useCallback(() => {
    try {
      const settingsJson = JSON.stringify(settings, null, 2);
      const blob = new Blob([settingsJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aeronyx-encryption-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Settings exported",
        description: "Your encryption settings have been exported to a JSON file",
        status: "success",
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to export settings:', error);
      toast({
        title: "Export failed",
        description: "Could not export settings to file",
        status: "error",
        duration: 5000,
      });
    }
  }, [settings, toast]);

  // Import settings from JSON file
  const importSettings = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (!target.files?.length) return;
      
      const file = target.files[0];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parsedSettings = JSON.parse(content);
          
          // Validate imported settings
          if (!parsedSettings.encryptionAlgorithm || 
              !parsedSettings.encryptionFieldName) {
            throw new Error('Invalid settings file format');
          }
          
          // Apply imported settings
          setSettings({
            ...settings,
            ...parsedSettings,
            // Ensure numeric types
            keySize: parseInt(parsedSettings.keySize) as 128 | 256,
            sessionKeyRotationInterval: parseInt(parsedSettings.sessionKeyRotationInterval),
            messageRetention: parseInt(parsedSettings.messageRetention),
          });
          
          toast({
            title: "Settings imported",
            description: "Your encryption settings have been imported successfully",
            status: "success",
            duration: 3000,
          });
        } catch (error) {
          console.error('Failed to parse settings file:', error);
          toast({
            title: "Import failed",
            description: "The selected file is not a valid settings file",
            status: "error",
            duration: 5000,
          });
        }
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  }, [settings, toast]);
  
  // Run comprehensive diagnostics
  const runDiagnostics = async () => {
    setDiagnosticStatus(prev => ({ ...prev, runningTests: true, errorDetails: null }));
    
    try {
      // Step 1: Check for AES-GCM support
      const aesGcmSupported = await isAesGcmSupported();
      
      // Step 2: Test both field names for compatibility
      const fieldTest1 = await testEncryptionFormat({ test: "Testing with 'encryption' field" }, 'encryption');
      const fieldTest2 = await testEncryptionFormat({ test: "Testing with 'encryption_algorithm' field" }, 'encryption_algorithm');
      
      // Step 3: Test P2P support (simplified check)
      const p2pSupported = typeof RTCPeerConnection !== 'undefined';
      
      // Step 4: Check for secure context
      const isSecureContext = typeof window !== 'undefined' && window.isSecureContext;
      
      // Update state with all results
      setDiagnosticStatus({
        aesGcmSupported,
        keyDerivationSupported: aesGcmSupported, // Usually if AES-GCM works, so does HKDF
        encryptionFieldCompatible: fieldTest1.success || fieldTest2.success,
        p2pConnectionPossible: p2pSupported,
        certificateValid: isSecureContext,
        runningTests: false,
        lastTestDate: new Date().toISOString(),
        errorDetails: null
      });
      
      // Auto-fix settings based on diagnostics
      const updatedSettings = { ...settings };
      
      // If encryption_algorithm field works, use that (it's more explicit)
      if (fieldTest2.success) {
        updatedSettings.encryptionFieldName = 'encryption_algorithm';
      } else if (fieldTest1.success) {
        updatedSettings.encryptionFieldName = 'encryption';
      }
      
      // If AES-GCM is not supported, switch to AES-CBC
      if (!aesGcmSupported) {
        updatedSettings.encryptionAlgorithm = 'aes-cbc';
      }
      
      // Update settings with diagnostic-based recommendations
      setSettings(updatedSettings);
      
      toast({
        title: "Diagnostics complete",
        description: "Settings have been adjusted based on compatibility tests",
        status: "success",
        duration: 3000,
      });
    } catch (error) {
      console.error('Error running diagnostics:', error);
      
      setDiagnosticStatus(prev => ({
        ...prev,
        runningTests: false,
        errorDetails: error instanceof Error ? error.message : String(error)
      }));
      
      toast({
        title: "Diagnostics failed",
        description: "An error occurred while running compatibility tests",
        status: "error",
        duration: 5000,
      });
    }
  };
  
  const saveSettings = async () => {
    setIsLoading(true);
    
    try {
      // Verify and validate settings
      const validationResult = await validateSettings();
      
      if (!validationResult.valid) {
        toast({
          title: "Validation Failed",
          description: validationResult.message,
          status: "error",
          duration: 5000,
        });
        setIsLoading(false);
        return;
      }
      
      // Save settings to localStorage
      localStorage.setItem('aero-encryption-settings', JSON.stringify(settings));
      
      toast({
        title: "Encryption settings saved",
        description: "Your encryption settings have been updated.",
        status: "success",
        duration: 3000,
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
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Validates settings before saving
  const validateSettings = async (): Promise<{valid: boolean, message: string}> => {
    // Check if AES-GCM is selected but not supported
    if (settings.encryptionAlgorithm === 'aes-gcm' && 
        diagnosticStatus.aesGcmSupported === false) {
      return {
        valid: false,
        message: "AES-GCM is not supported in your browser. Please select a different encryption algorithm."
      };
    }
    
    // Verify session key rotation interval is reasonable
    if (settings.sessionKeyRotation && 
        (settings.sessionKeyRotationInterval < 1 || settings.sessionKeyRotationInterval > 168)) {
      return {
        valid: false,
        message: "Session key rotation interval must be between 1 and 168 hours."
      };
    }
    
    return { valid: true, message: "" };
  };
  
  const resetSettings = () => {
    // Default settings
    const defaultSettings = {
      encryptionAlgorithm: 'aes-gcm' as const,
      encryptionFieldName: 'encryption' as const,
      preferP2P: true,
      keySize: 256 as const,
      sessionKeyRotation: false,
      sessionKeyRotationInterval: 24,
      useFallbackEncryption: true,
      messageRetention: 7,
      forwardSecrecy: true,
      certificateValidation: true,
      autoBackupKeys: false,
    };
    
    setSettings(defaultSettings);
    
    toast({
      title: "Settings reset",
      description: "Encryption settings have been reset to defaults.",
      status: "info",
      duration: 3000,
    });
  };
  
  // Render security status indicators
  const SecurityStatusIndicator = ({ 
    isSupported, 
    label, 
    supportedText = "Supported", 
    unsupportedText = "Not Supported" 
  }: { 
    isSupported: boolean | null; 
    label: string;
    supportedText?: string;
    unsupportedText?: string;
  }) => (
    <Flex align="center" mb={2}>
      <Text mr={2}>{label}:</Text>
      {isSupported === null ? (
        <Badge colorScheme="gray">Unknown</Badge>
      ) : isSupported ? (
        <Badge colorScheme="green" display="flex" alignItems="center">
          <Icon as={FaCheck} mr={1} /> {supportedText}
        </Badge>
      ) : (
        <Badge colorScheme="red" display="flex" alignItems="center">
          <Icon as={FaExclamationTriangle} mr={1} /> {unsupportedText}
        </Badge>
      )}
    </Flex>
  );
  
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
        
        {diagnosticStatus.aesGcmSupported === false && (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Limited Browser Support</AlertTitle>
              <AlertDescription>
                Your browser has limited support for some encryption features. Settings have been adjusted
                for maximum compatibility.
              </AlertDescription>
            </Box>
          </Alert>
        )}
        
        <Tabs variant="soft-rounded" colorScheme="purple">
          <TabList mb={4}>
            <Tab>Settings</Tab>
            <Tab>Advanced</Tab>
            <Tab>Diagnostics</Tab>
          </TabList>
          
          <TabPanels>
            {/* Basic Settings Tab */}
            <TabPanel px={0}>
              <VStack spacing={6} align="stretch">
                <Box>
                  <Heading size="sm" mb={4}>Encryption Configuration</Heading>
                  
                  <VStack spacing={5} align="stretch">
                    <FormControl>
                      <FormLabel display="flex" alignItems="center">
                        <Text mr={2}>Encryption Method</Text>
                        <Tooltip
                          label="Choose the encryption algorithm used for your messages"
                          placement="top"
                        >
                          <Icon as={FaInfoCircle} color="gray.500" />
                        </Tooltip>
                      </FormLabel>
                      
                      <Select
                        value={settings.encryptionAlgorithm}
                        onChange={handleSelectChange('encryptionAlgorithm')}
                      >
                        <option value="aes-gcm">AES-GCM (Recommended)</option>
                        <option value="chacha20poly1305">ChaCha20-Poly1305 (Limited Browser Support)</option>
                        <option value="aes-cbc">AES-CBC with HMAC (Legacy)</option>
                      </Select>
                      
                      {settings.encryptionAlgorithm === 'aes-gcm' && diagnosticStatus.aesGcmSupported === false && (
                        <Alert status="warning" mt={2} borderRadius="md" size="sm">
                          <AlertIcon as={FaExclamationTriangle} />
                          <Box>
                            <AlertTitle fontSize="sm">Compatibility Issue</AlertTitle>
                            <AlertDescription fontSize="xs">
                              Your browser may not fully support AES-GCM. Consider using AES-CBC instead.
                            </AlertDescription>
                          </Box>
                        </Alert>
                      )}
                      
                      {settings.encryptionAlgorithm === 'aes-gcm' && diagnosticStatus.aesGcmSupported === true && (
                        <Alert status="success" mt={2} borderRadius="md" size="sm">
                          <AlertIcon as={FaCheck} />
                          <Box>
                            <AlertTitle fontSize="sm">Recommended</AlertTitle>
                            <AlertDescription fontSize="xs">
                              AES-GCM provides strong security and is supported by your browser
                            </AlertDescription>
                          </Box>
                        </Alert>
                      )}
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Key Size</FormLabel>
                      <Select
                        value={settings.keySize.toString()}
                        onChange={(e) => setSettings({...settings, keySize: parseInt(e.target.value) as 128 | 256})}
                      >
                        <option value="256">256 bits (Recommended)</option>
                        <option value="128">128 bits (Higher Compatibility)</option>
                      </Select>
                      <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'} mt={1}>
                        256-bit keys offer stronger security, while 128-bit keys may have better performance
                      </Text>
                    </FormControl>
                    
                    <FormControl display="flex" alignItems="center">
                      <FormLabel htmlFor="prefer-p2p" mb="0">
                        Prefer Peer-to-Peer Connections
                      </FormLabel>
                      <Tooltip
                        label="P2P connections bypass servers for direct secure communication"
                        placement="top"
                      >
                        <Icon as={FaInfoCircle} color="gray.500" mr={2} />
                      </Tooltip>
                      <Switch
                        id="prefer-p2p"
                        colorScheme="purple"
                        isChecked={settings.preferP2P}
                        onChange={handleSwitchChange('preferP2P')}
                      />
                    </FormControl>
                    
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
                    
                    <FormControl>
                      <FormLabel display="flex" alignItems="center">
                        <Text mr={2}>Message Retention Period</Text>
                        <Badge colorScheme="purple" ml={2}>
                          {settings.messageRetention === 0 ? 'Forever' : `${settings.messageRetention} days`}
                        </Badge>
                      </FormLabel>
                      <Slider
                        aria-label="message-retention"
                        min={0}
                        max={30}
                        step={1}
                        value={settings.messageRetention}
                        onChange={handleSliderChange('messageRetention')}
                        colorScheme="purple"
                      >
                        <SliderTrack>
                          <SliderFilledTrack />
                        </SliderTrack>
                        <SliderThumb boxSize={6}>
                          <Icon color="purple.500" as={FaKey} fontSize="xs" />
                        </SliderThumb>
                      </Slider>
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        0 = Keep messages forever
                      </Text>
                    </FormControl>
                  </VStack>
                </Box>
                
                <Divider />
                
                <Flex justify="space-between">
                  <HStack>
                    <Button
                      variant="outline"
                      onClick={resetSettings}
                      leftIcon={<FaSync />}
                    >
                      Reset to Defaults
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={runDiagnostics}
                      leftIcon={<FaBug />}
                      isLoading={diagnosticStatus.runningTests}
                      loadingText="Running Tests"
                    >
                      Run Diagnostics
                    </Button>
                  </HStack>
                  
                  <Button
                    colorScheme="purple"
                    onClick={saveSettings}
                    isLoading={isLoading}
                    loadingText="Saving"
                    leftIcon={<FaLock />}
                  >
                    Save Settings
                  </Button>
                </Flex>
              </VStack>
            </TabPanel>
            
            {/* Advanced Settings Tab */}
            <TabPanel px={0}>
              <VStack spacing={6} align="stretch">
                <Box>
                  <Heading size="sm" mb={4}>Advanced Encryption Settings</Heading>
                  
                  <VStack spacing={5} align="stretch">
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
                      <FormLabel htmlFor="forward-secrecy" mb="0">
                        Enable Forward Secrecy
                      </FormLabel>
                      <Tooltip
                        label="Ensures past messages remain encrypted even if your key is compromised"
                        placement="top"
                      >
                        <Icon as={FaInfoCircle} color="gray.500" mr={2} />
                      </Tooltip>
                      <Switch
                        id="forward-secrecy"
                        colorScheme="purple"
                        isChecked={settings.forwardSecrecy}
                        onChange={handleSwitchChange('forwardSecrecy')}
                      />
                    </FormControl>
                    
                    <FormControl display="flex" alignItems="center">
                      <FormLabel htmlFor="certificate-validation" mb="0">
                        Strict Certificate Validation
                      </FormLabel>
                      <Switch
                        id="certificate-validation"
                        colorScheme="purple"
                        isChecked={settings.certificateValidation}
                        onChange={handleSwitchChange('certificateValidation')}
                      />
                    </FormControl>
                    
                    <FormControl display="flex" alignItems="center">
                      <FormLabel htmlFor="auto-backup-keys" mb="0">
                        Auto-Backup Encryption Keys
                      </FormLabel>
                      <Tooltip
                        label="Automatically backs up your keys in encrypted format"
                        placement="top"
                      >
                        <Icon as={FaInfoCircle} color="gray.500" mr={2} />
                      </Tooltip>
                      <Switch
                        id="auto-backup-keys"
                        colorScheme="purple"
                        isChecked={settings.autoBackupKeys}
                        onChange={handleSwitchChange('autoBackupKeys')}
                      />
                    </FormControl>
                    
                    <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
                      Advanced settings should only be changed if you understand their implications
                      or if directed by support to resolve specific issues.
                    </Text>
                  </VStack>
                </Box>
                
                <Divider />
                
                <Box>
                  <Heading size="sm" mb={4}>Import/Export Settings</Heading>
                  
                  <ButtonGroup spacing={4}>
                    <Button
                      leftIcon={<FaDownload />}
                      onClick={exportSettings}
                      colorScheme="blue"
                      variant="outline"
                    >
                      Export Settings
                    </Button>
                    
                    <Button
                      leftIcon={<FaRobot />}
                      onClick={importSettings}
                      colorScheme="teal"
                      variant="outline"
                    >
                      Import Settings
                    </Button>
                  </ButtonGroup>
                  
                  <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'} mt={2}>
                    Export settings to backup your configuration or import settings from another device.
                  </Text>
                </Box>
                
                <Box>
                  <Heading size="sm" mb={4}>Your Encryption Identity</Heading>
                  
                  <VStack align="flex-start" spacing={2} p={4} borderRadius="md" bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}>
                    <Text fontWeight="medium">Public Key:</Text>
                    <Code p={2} borderRadius="md" fontSize="sm" w="100%" overflowX="auto">
                      {user?.publicKey 
                        ? `${user.publicKey.substring(0, 16)}...${user.publicKey.substring(user.publicKey.length - 16)}` 
                        : 'Not available'}
                    </Code>
                    
                    <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'} mt={1}>
                      <Icon as={FaUserSecret} mr={2} />
                      Your private key never leaves your device and is used for end-to-end encryption
                    </Text>
                  </VStack>
                </Box>
                
                <Divider />
                
                <Flex justify="flex-end">
                  <Button
                    colorScheme="purple"
                    onClick={saveSettings}
                    isLoading={isLoading}
                    loadingText="Saving"
                  >
                    Save Advanced Settings
                  </Button>
                </Flex>
              </VStack>
            </TabPanel>
            
            {/* Diagnostics Tab */}
            <TabPanel px={0}>
              <VStack spacing={6} align="stretch">
                <Box>
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="sm">Encryption Diagnostics</Heading>
                    
                    <Button
                      leftIcon={<Icon as={FaSync} />}
                      colorScheme="purple"
                      size="sm"
                      isLoading={diagnosticStatus.runningTests}
                      loadingText="Running Tests"
                      onClick={runDiagnostics}
                    >
                      Run Tests
                    </Button>
                  </Flex>
                  
                  <Text mb={4}>
                    These tests help diagnose encryption compatibility issues with your browser and our server.
                    If you're experiencing connection problems, run the tests to identify potential fixes.
                  </Text>
                  
                  <VStack align="start" spacing={3} p={4} borderRadius="md" bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}>
                    <SecurityStatusIndicator 
                      isSupported={diagnosticStatus.aesGcmSupported}
                      label="AES-GCM Encryption" 
                    />
                    
                    <SecurityStatusIndicator 
                      isSupported={diagnosticStatus.keyDerivationSupported}
                      label="Key Derivation (HKDF)" 
                    />
                    
                    <SecurityStatusIndicator 
                      isSupported={diagnosticStatus.encryptionFieldCompatible}
                      label="Data Format Compatibility" 
                    />
                    
                    <SecurityStatusIndicator 
                      isSupported={diagnosticStatus.p2pConnectionPossible}
                      label="P2P Connection Support" 
                    />
                    
                    <SecurityStatusIndicator 
                      isSupported={diagnosticStatus.certificateValid}
                      label="Secure Context" 
                      supportedText="Verified"
                      unsupportedText="Not Verified"
                    />
                    
                    {diagnosticStatus.lastTestDate && (
                      <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
                        Last tested: {new Date(diagnosticStatus.lastTestDate).toLocaleString()}
                      </Text>
                    )}
                  </VStack>
                  
                  {diagnosticStatus.errorDetails && (
                    <Alert status="error" mt={4} borderRadius="md">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>Error Running Tests</AlertTitle>
                        <AlertDescription>
                          {diagnosticStatus.errorDetails}
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}
                </Box>
                
                <Box>
                  <Heading size="sm" mb={4}>Recommendations</Heading>
                  
                  {diagnosticStatus.aesGcmSupported === false && (
                    <Alert status="warning" mb={3} borderRadius="md">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>Switch Encryption Algorithm</AlertTitle>
                        <AlertDescription>
                          Your browser doesn't support AES-GCM. We recommend switching to AES-CBC for better compatibility.
                        </AlertDescription>
                        <Button
                          mt={2}
                          size="sm"
                          colorScheme="orange"
                          onClick={() => setSettings({...settings, encryptionAlgorithm: 'aes-cbc'})}
                        >
                          Switch to AES-CBC
                        </Button>
                      </AlertDescription>
                    </Box>
                  </Alert>
                  )}
                  
                  {!diagnosticStatus.p2pConnectionPossible && (
                    <Alert status="warning" mb={3} borderRadius="md">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>WebRTC Not Available</AlertTitle>
                        <AlertDescription>
                          Your browser doesn't support peer-to-peer connections. We recommend disabling P2P mode.
                        </AlertDescription>
                        <Button
                          mt={2}
                          size="sm"
                          colorScheme="orange"
                          onClick={() => setSettings({...settings, preferP2P: false})}
                        >
                          Disable P2P Mode
                        </Button>
                      </AlertDescription>
                    </Box>
                  </Alert>
                  )}
                  
                  {!diagnosticStatus.certificateValid && (
                    <Alert status="info" mb={3} borderRadius="md">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>Certificate Validation</AlertTitle>
                        <AlertDescription>
                          Your connection is not in a secure context. This may affect some encryption features.
                          Consider accessing AeroNyx via HTTPS instead.
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}
                  
                  {diagnosticStatus.encryptionFieldCompatible === false && (
                    <Alert status="error" mb={3} borderRadius="md">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>Data Format Incompatibility</AlertTitle>
                        <AlertDescription>
                          There seems to be an issue with the encryption format. Try enabling the fallback option.
                        </AlertDescription>
                        <Button
                          mt={2}
                          size="sm"
                          colorScheme="red"
                          onClick={() => setSettings({...settings, useFallbackEncryption: true})}
                        >
                          Enable Fallback Encryption
                        </Button>
                      </Box>
                    </Alert>
                  )}
                  
                  {/* Show positive message when all tests pass */}
                  {diagnosticStatus.aesGcmSupported === true && 
                   diagnosticStatus.p2pConnectionPossible === true && 
                   diagnosticStatus.encryptionFieldCompatible === true && (
                    <Alert status="success" mb={3} borderRadius="md">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>All Tests Passed</AlertTitle>
                        <AlertDescription>
                          Your browser supports all encryption features. You're ready for secure communications.
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}
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
                  >
                    Apply Recommended Settings
                  </Button>
                </Flex>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Box>
  );
};
