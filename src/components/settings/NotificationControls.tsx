// src/components/settings/NotificationControls.tsx
import React, { useState, useEffect } from 'react';
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
  useColorMode,
  useToast,
  Divider,
  Select,
  InputGroup,
  Input,
  InputRightElement,
  Badge,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import {
  FaBell,
  FaVolumeUp,
  FaMobileAlt,
  FaDesktop,
  FaMoon,
  FaInfoCircle,
  FaBellSlash,
} from 'react-icons/fa';

interface NotificationControlsProps {
  onSave?: () => void;
}

export const NotificationControls: React.FC<NotificationControlsProps> = ({ onSave }) => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  
  // Check if browser supports notifications
  const [notificationsSupported, setNotificationsSupported] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'default'>('default');
  
  // Notification settings state
  const [settings, setSettings] = useState({
    enableNotifications: false,
    notificationSound: 'standard',
    notifyOnAllMessages: false,
    notifyOnMentions: true,
    notifyOnDirectMessages: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    showPreview: true,
    vibrate: true,
  });
  
  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  
  // Check browser notification support on mount
  useEffect(() => {
    setNotificationsSupported('Notification' in window);
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);
  
  const requestNotificationPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        setSettings(prev => ({
          ...prev,
          enableNotifications: true
        }));
        
        // Show a test notification
        const notification = new Notification("AeroNyx Notifications Enabled", {
          body: "You will now receive secure message notifications",
          icon: "/logo.svg" // Assuming you have a logo at this path
        });
        
        toast({
          title: "Notifications enabled",
          description: "You will now receive secure message notifications",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast({
        title: "Notification permission error",
        description: "Could not request notification permissions",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  const handleSwitchChange = (name: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, [name]: e.target.checked });
  };
  
  const handleInputChange = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSettings({ ...settings, [name]: e.target.value });
  };
  
  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // In a real implementation, this would call an API endpoint
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
      
      toast({
        title: "Notification settings saved",
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
        description: "An error occurred while saving notification settings",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
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
          <Icon as={FaBell} color="purple.500" boxSize={6} mr={3} />
          <Heading size="md">Notification Settings</Heading>
        </Flex>
        
        <Divider />
        
        {notificationsSupported ? (
          <>
            {notificationPermission !== 'granted' && (
              <Alert status="info" borderRadius="md">
                <AlertIcon />
                Browser notifications are not enabled. Enable them to receive message alerts even when the app is in the background.
                <Button 
                  ml={4} 
                  size="sm" 
                  colorScheme="blue"
                  onClick={requestNotificationPermission}
                >
                  Enable Notifications
                </Button>
              </Alert>
            )}
            
            <Box>
              <Heading size="sm" mb={4}>General Notification Settings</Heading>
              
              <VStack spacing={5} align="stretch">
                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="enable-notifications" mb="0">
                    Enable Notifications
                  </FormLabel>
                  <Switch
                    id="enable-notifications"
                    colorScheme="purple"
                    isChecked={settings.enableNotifications}
                    onChange={handleSwitchChange('enableNotifications')}
                    isDisabled={notificationPermission !== 'granted'}
                  />
                </FormControl>
                
                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="notification-sound" mb="0" flex="1">
                    Notification Sound
                  </FormLabel>
                  <Select
                    id="notification-sound"
                    value={settings.notificationSound}
                    onChange={handleInputChange('notificationSound')}
                    width={{ base: '50%', md: '200px' }}
                    isDisabled={!settings.enableNotifications}
                  >
                    <option value="standard">Standard</option>
                    <option value="subtle">Subtle</option>
                    <option value="energetic">Energetic</option>
                    <option value="none">None</option>
                  </Select>
                </FormControl>
                
                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="show-preview" mb="0">
                    Show Message Preview
                  </FormLabel>
                  <Switch
                    id="show-preview"
                    colorScheme="purple"
                    isChecked={settings.showPreview}
                    onChange={handleSwitchChange('showPreview')}
                    isDisabled={!settings.enableNotifications}
                  />
                </FormControl>
                
                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="vibrate" mb="0">
                    Vibrate on Mobile Devices
                  </FormLabel>
                  <Switch
                    id="vibrate"
                    colorScheme="purple"
                    isChecked={settings.vibrate}
                    onChange={handleSwitchChange('vibrate')}
                    isDisabled={!settings.enableNotifications}
                  />
                </FormControl>
              </VStack>
            </Box>
            
            <Divider />
            
            <Box>
              <Heading size="sm" mb={4}>When to Notify</Heading>
              
              <VStack spacing={5} align="stretch">
                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="notify-all-messages" mb="0">
                    All Messages
                  </FormLabel>
                  <Switch
                    id="notify-all-messages"
                    colorScheme="purple"
                    isChecked={settings.notifyOnAllMessages}
                    onChange={handleSwitchChange('notifyOnAllMessages')}
                    isDisabled={!settings.enableNotifications}
                  />
                </FormControl>
                
                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="notify-mentions" mb="0">
                    When Mentioned (@username)
                  </FormLabel>
                  <Switch
                    id="notify-mentions"
                    colorScheme="purple"
                    isChecked={settings.notifyOnMentions}
                    onChange={handleSwitchChange('notifyOnMentions')}
                    isDisabled={!settings.enableNotifications || settings.notifyOnAllMessages}
                  />
                </FormControl>
                
                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="notify-direct-messages" mb="0">
                    Direct Messages
                  </FormLabel>
                  <Switch
                    id="notify-direct-messages"
                    colorScheme="purple"
                    isChecked={settings.notifyOnDirectMessages}
                    onChange={handleSwitchChange('notifyOnDirectMessages')}
                    isDisabled={!settings.enableNotifications || settings.notifyOnAllMessages}
                  />
                </FormControl>
              </VStack>
            </Box>
            
            <Divider />
            
            <Box>
              <Heading size="sm" mb={4}>Quiet Hours</Heading>
              
              <VStack spacing={5} align="stretch">
                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="quiet-hours-enabled" mb="0">
                    <Flex align="center">
                      <Icon as={FaMoon} mr={2} />
                      <Text>Enable Quiet Hours</Text>
                    </Flex>
                  </FormLabel>
                  <Switch
                    id="quiet-hours-enabled"
                    colorScheme="purple"
                    isChecked={settings.quietHoursEnabled}
                    onChange={handleSwitchChange('quietHoursEnabled')}
                    isDisabled={!settings.enableNotifications}
                  />
                </FormControl>
                
                {settings.quietHoursEnabled && (
                  <Flex 
                    direction={{ base: 'column', md: 'row' }} 
                    align={{ base: 'flex-start', md: 'center' }}
                    gap={4}
                  >
                    <FormControl>
                      <FormLabel htmlFor="quiet-hours-start">Start Time</FormLabel>
                      <Input
                        id="quiet-hours-start"
                        type="time"
                        value={settings.quietHoursStart}
                        onChange={handleInputChange('quietHoursStart')}
                        isDisabled={!settings.enableNotifications}
                      />
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel htmlFor="quiet-hours-end">End Time</FormLabel>
                      <Input
                        id="quiet-hours-end"
                        type="time"
                        value={settings.quietHoursEnd}
                        onChange={handleInputChange('quietHoursEnd')}
                        isDisabled={!settings.enableNotifications}
                      />
                    </FormControl>
                  </Flex>
                )}
                
                {settings.quietHoursEnabled && (
                  <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
                    <Icon as={FaBellSlash} mr={2} />
                    Notifications will be silenced between {settings.quietHoursStart} and {settings.quietHoursEnd}
                  </Text>
                )}
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
                Save Notification Settings
              </Button>
            </Flex>
          </>
        ) : (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            Your browser does not support notifications. Try using a modern browser like Chrome, Firefox, or Safari.
          </Alert>
        )}
      </VStack>
    </Box>
  );
};
