// src/components/settings/SecuritySettings.tsx
import React, { useState } from 'react';
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Icon,
  Switch,
  Text,
  VStack,
  HStack,
  Select,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Tooltip,
  useColorMode,
  useToast,
  Divider,
  Badge,
} from '@chakra-ui/react';
import {
  FaLock,
  FaShieldAlt,
  FaKey,
  FaTrash,
  FaDownload,
  FaExclamationTriangle,
  FaInfoCircle,
  FaEraser,
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';

interface SecuritySettingsProps {
  onSave?: () => void;
}

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({ onSave }) => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const { user } = useAuth();
  
  // Security settings state
  const [settings, setSettings] = useState({
    encryptionLevel: 'high', // standard, high, maximum
    autoDeleteMessages: true,
    autoDeleteDelay: 24, // hours
    messageRetention: 7, // days, 0 = forever
    useP2P: true,
    storeKeysLocally: true,
    biometricAuth: false,
    passwordProtection: false,
  });
  
  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  
  const handleSwitchChange = (name: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, [name]: e.target.checked });
  };
  
  const handleSelectChange = (name: string) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings({ ...settings, [name]: e.target.value });
  };
  
  const handleSliderChange = (name: string) => (val: number) => {
    setSettings({ ...settings, [name]: val });
  };
  
  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // In a real implementation, this would call an API endpoint
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
      
      toast({
        title: "Settings saved",
        description: "Your security settings have been updated",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      if (onSave) {
        onSave();
      }
    } catch (error) {
      toast({
        title: "Failed to save settings",
        description: "An error occurred while saving your settings",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const exportKeys = () => {
    try {
      // Get stored keypair
      const storedKeypair = localStorage.getItem('aero-keypair');
      if (!storedKeypair) {
        throw new Error('No keypair found');
      }
      
      // Create downloadable file
      const blob = new Blob([storedKeypair], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aeronyx-keys-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Keys exported",
        description: "Store this file securely. It contains your encryption keys.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not export keys",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  const clearAllData = () => {
    if (window.confirm('Are you sure you want to clear all local data? This action cannot be undone.')) {
      try {
        // Clear localStorage items related to the app
        const itemsToKeep = ['chakra-ui-color-mode']; // Keep UI preferences
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && !itemsToKeep.includes(key) && key.startsWith('aero-')) {
            localStorage.removeItem(key);
          }
        }
        
        toast({
          title: "Data cleared",
          description: "All your local data has been removed",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        toast({
          title: "Failed to clear data",
          description: "An error occurred while clearing your data",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    }
  };
  
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
          <Icon as={FaShieldAlt} color="purple.500" boxSize={6} mr={3} />
          <Heading size="md">Security & Privacy Settings</Heading>
        </Flex>
        
        <Divider />
        
        <Box>
          <Heading size="sm" mb={4}>Encryption Settings</Heading>
          
          <VStack spacing={5} align="stretch">
            <FormControl>
              <FormLabel d="flex" alignItems="center">
                <Text mr={2}>Encryption Level</Text>
                <Tooltip
                  label="Higher levels provide stronger security but may use more device resources"
                  placement="top"
                >
                  <Icon as={FaInfoCircle} color="gray.500" />
                </Tooltip>
              </FormLabel>
              
              <Select
                value={settings.encryptionLevel}
                onChange={handleSelectChange('encryptionLevel')}
              >
                <option value="standard">Standard (AES-256)</option>
                <option value="high">High (ChaCha20-Poly1305)</option>
                <option value="maximum">Maximum (Dual Encryption + Forward Secrecy)</option>
              </Select>
              
              {settings.encryptionLevel === 'maximum' && (
                <Text fontSize="sm" color={colorMode === 'dark' ? 'yellow.300' : 'yellow.600'} mt={2}>
                  <Icon as={FaExclamationTriangle} mr={1} />
                  Maximum encryption may impact performance on older devices.
                </Text>
              )}
            </FormControl>
            
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="use-p2p" mb="0">
                Use Peer-to-Peer Connection
              </FormLabel>
              <Tooltip
                label="P2P connections bypass servers for direct secure communication"
                placement="top"
              >
                <Icon as={FaInfoCircle} color="gray.500" mr={2} />
              </Tooltip>
              <Switch
                id="use-p2p"
                colorScheme="purple"
                isChecked={settings.useP2P}
                onChange={handleSwitchChange('useP2P')}
              />
            </FormControl>
            
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="store-keys-locally" mb="0">
                Store Keys Locally
              </FormLabel>
              <Tooltip
                label="When disabled, keys are generated per session and not stored"
                placement="top"
              >
                <Icon as={FaInfoCircle} color="gray.500" mr={2} />
              </Tooltip>
              <Switch
                id="store-keys-locally"
                colorScheme="purple"
                isChecked={settings.storeKeysLocally}
                onChange={handleSwitchChange('storeKeysLocally')}
              />
            </FormControl>
          </VStack>
        </Box>
        
        <Divider />
        
        <Box>
          <Heading size="sm" mb={4}>Message Privacy</Heading>
          
          <VStack spacing={5} align="stretch">
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="auto-delete-messages" mb="0">
                Auto-Delete Messages
              </FormLabel>
              <Switch
                id="auto-delete-messages"
                colorScheme="purple"
                isChecked={settings.autoDeleteMessages}
                onChange={handleSwitchChange('autoDeleteMessages')}
              />
            </FormControl>
            
            {settings.autoDeleteMessages && (
              <FormControl>
                <FormLabel d="flex" alignItems="center">
                  <Text mr={2}>Auto-Delete Delay</Text>
                  <Badge colorScheme="purple" ml={2}>
                    {settings.autoDeleteDelay} hours
                  </Badge>
                </FormLabel>
                <Slider
                  aria-label="auto-delete-delay"
                  min={1}
                  max={72}
                  step={1}
                  value={settings.autoDeleteDelay}
                  onChange={handleSliderChange('autoDeleteDelay')}
                  colorScheme="purple"
                >
                  <SliderTrack>
                    <SliderFilledTrack />
                  </SliderTrack>
                  <SliderThumb boxSize={6}>
                    <Box color="purple.500" as={FaEraser} />
                  </SliderThumb>
                </Slider>
              </FormControl>
            )}
            
            <FormControl>
              <FormLabel d="flex" alignItems="center">
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
                  <Box color="purple.500" as={FaEraser} />
                </SliderThumb>
              </Slider>
              <Text fontSize="xs" color="gray.500" mt={1}>
                0 = Keep messages forever
              </Text>
            </FormControl>
          </VStack>
        </Box>
        
        <Divider />
        
        <Box>
          <Heading size="sm" mb={4}>Key Management</Heading>
          
          <VStack spacing={4} align="stretch">
            <Flex direction={{ base: 'column', md: 'row' }} gap={4}>
              <Button
                leftIcon={<FaKey />}
                onClick={exportKeys}
                colorScheme="blue"
                flex={1}
              >
                Export Encryption Keys
              </Button>
              
              <Button
                leftIcon={<FaTrash />}
                onClick={clearAllData}
                colorScheme="red"
                flex={1}
              >
                Clear All Local Data
              </Button>
            </Flex>
            
            <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
              <Icon as={FaLock} mr={2} />
              Your public key: {user?.publicKey 
                ? `${user.publicKey.substring(0, 6)}...${user.publicKey.substring(user.publicKey.length - 4)}` 
                : 'Not available'}
            </Text>
          </VStack>
        </Box>
        
        <Divider />
        
        <Flex justifyContent="flex-end">
          <Button
            colorScheme="purple"
            onClick={saveSettings}
            isLoading={isSaving}
            loadingText="Saving"
            size="lg"
          >
            Save Security Settings
          </Button>
        </Flex>
      </VStack>
    </Box>
  );
};
