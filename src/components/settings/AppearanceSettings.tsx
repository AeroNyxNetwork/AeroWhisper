// src/components/settings/AppearanceSettings.tsx
import React, { useState } from 'react';
import {
  Box, 
  Button, 
  Flex, 
  Grid, 
  Heading, 
  Icon, 
  Radio, 
  RadioGroup, 
  Stack, 
  Text, 
  VStack, 
  useColorMode, 
  useToast, 
  Divider,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Select,
  Badge,
  Tooltip,
} from '@chakra-ui/react';
import {
  FaSun,
  FaMoon,
  FaDesktop,
  FaPalette,
  FaFont,
  FaTextHeight,
  FaCompress,
  FaExpand,
  FaInfoCircle,
} from 'react-icons/fa';

interface AppearanceSettingsProps {
  onSave?: () => void;
}

type ColorModeWithSystem = 'light' | 'dark' | 'system';

export const AppearanceSettings: React.FC<AppearanceSettingsProps> = ({ onSave }) => {
  const { colorMode, toggleColorMode } = useColorMode();
  const toast = useToast();
  
  // Theme settings state
  const [settings, setSettings] = useState({
    colorMode: colorMode as ColorModeWithSystem, // 'light', 'dark', or 'system'
    primaryColor: 'purple', // default color theme
    fontSize: 'medium', // 'small', 'medium', 'large'
    messageDensity: 'comfortable', // 'compact', 'comfortable', 'spacious'
    fontFamily: 'inter', // 'inter', 'roboto', 'system'
    messageAlignment: 'default', // 'default', 'left', 'right'
    enableAnimations: true,
    messageCornerStyle: 'rounded', // 'rounded', 'bubbles', 'angular'
    emojiStyle: 'native', // 'native', 'twitter', 'apple', 'google'
  });
  
  // Color theme options for the color picker grid
  const colorThemes = [
    { name: 'Purple', value: 'purple', bg: 'purple.500' },
    { name: 'Blue', value: 'blue', bg: 'blue.500' },
    { name: 'Teal', value: 'teal', bg: 'teal.500' },
    { name: 'Green', value: 'green', bg: 'green.500' },
    { name: 'Red', value: 'red', bg: 'red.500' },
    { name: 'Orange', value: 'orange', bg: 'orange.500' },
    { name: 'Pink', value: 'pink', bg: 'pink.500' },
    { name: 'Gray', value: 'gray', bg: 'gray.500' },
  ];
  
  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  
  const handleColorModeChange = (value: ColorModeWithSystem) => {
    setSettings({ ...settings, colorMode: value });
    
    // Update the actual color mode
    if (value === 'system') {
      // Check system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if ((systemPrefersDark && colorMode === 'light') || (!systemPrefersDark && colorMode === 'dark')) {
        toggleColorMode();
      }
    } else if (value !== colorMode) {
      toggleColorMode();
    }
  };
  
  const handleSettingChange = (name: string, value: string | boolean) => {
    setSettings({ ...settings, [name]: value });
  };
  
  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // In a real implementation, this would call an API endpoint
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
      
      // Save settings to localStorage
      localStorage.setItem('aero-appearance-settings', JSON.stringify(settings));
      
      toast({
        title: "Appearance settings saved",
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
        description: "An error occurred while saving appearance settings",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Preview message component
  const MessagePreview = () => (
    <Box 
      p={4} 
      borderRadius="md" 
      bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
      position="relative"
      mt={6}
    >
      <Heading size="xs" mb={3} opacity={0.7}>Preview</Heading>
      
      <Flex 
        justifyContent={settings.messageAlignment === 'left' ? 'flex-start' : 
                      settings.messageAlignment === 'right' ? 'flex-end' : 
                      'space-between'}
        width="100%"
      >
        {settings.messageAlignment !== 'right' && (
          <Box
            p={settings.messageDensity === 'compact' ? 2 : 
               settings.messageDensity === 'spacious' ? 4 : 3}
            bg={colorMode === 'dark' ? 'gray.600' : 'white'}
            color={colorMode === 'dark' ? 'white' : 'gray.800'}
            borderRadius={settings.messageCornerStyle === 'angular' ? 'md' :
                         settings.messageCornerStyle === 'bubbles' ? 'full' : 'lg'}
            maxW="60%"
            fontSize={settings.fontSize === 'small' ? 'sm' : 
                    settings.fontSize === 'large' ? 'lg' : 'md'}
            fontFamily={settings.fontFamily === 'roboto' ? 'Roboto, sans-serif' :
                        settings.fontFamily === 'system' ? 'system-ui, sans-serif' :
                        'Inter, sans-serif'}
            mb={2}
          >
            Hi there! How are you?
          </Box>
        )}
        
        {settings.messageAlignment !== 'left' && (
          <Box
            p={settings.messageDensity === 'compact' ? 2 : 
               settings.messageDensity === 'spacious' ? 4 : 3}
            bg={`${settings.primaryColor}.500`}
            color="white"
            borderRadius={settings.messageCornerStyle === 'angular' ? 'md' :
                         settings.messageCornerStyle === 'bubbles' ? 'full' : 'lg'}
            maxW="60%"
            fontSize={settings.fontSize === 'small' ? 'sm' : 
                    settings.fontSize === 'large' ? 'lg' : 'md'}
            fontFamily={settings.fontFamily === 'roboto' ? 'Roboto, sans-serif' :
                        settings.fontFamily === 'system' ? 'system-ui, sans-serif' :
                        'Inter, sans-serif'}
            alignSelf="flex-end"
          >
            I'm doing great, thanks for asking!
          </Box>
        )}
      </Flex>
    </Box>
  );
  
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
          <Icon as={FaPalette} color="purple.500" boxSize={6} mr={3} />
          <Heading size="md">Appearance Settings</Heading>
        </Flex>
        
        <Divider />
        
        <Box>
          <Heading size="sm" mb={4}>Theme Mode</Heading>
          
          <RadioGroup
            value={settings.colorMode}
            onChange={(value) => handleColorModeChange(value as ColorModeWithSystem)}
          >
            <Stack direction={['column', 'row']} spacing={5}>
              <Radio value="light">
                <Flex align="center">
                  <Icon as={FaSun} mr={2} />
                  <Text>Light</Text>
                </Flex>
              </Radio>
              <Radio value="dark">
                <Flex align="center">
                  <Icon as={FaMoon} mr={2} />
                  <Text>Dark</Text>
                </Flex>
              </Radio>
              <Radio value="system">
                <Flex align="center">
                  <Icon as={FaDesktop} mr={2} />
                  <Text>System</Text>
                </Flex>
              </Radio>
            </Stack>
          </RadioGroup>
        </Box>
        
        <Box>
          <Heading size="sm" mb={4}>Color Theme</Heading>
          
          <Grid templateColumns="repeat(4, 1fr)" gap={4}>
            {colorThemes.map((theme) => (
              <Box
                key={theme.value}
                bg={theme.bg}
                height="50px"
                borderRadius="md"
                cursor="pointer"
                onClick={() => handleSettingChange('primaryColor', theme.value)}
                position="relative"
                _hover={{ opacity: 0.8 }}
                transition="all 0.2s"
                boxShadow={settings.primaryColor === theme.value ? "0 0 0 3px rgba(255,255,255,0.6)" : "none"}
              >
                {settings.primaryColor === theme.value && (
                  <Badge
                    position="absolute"
                    bottom="5px"
                    right="5px"
                    bg="white"
                    color="black"
                    borderRadius="full"
                    px={2}
                    fontSize="xs"
                  >
                    Selected
                  </Badge>
                )}
              </Box>
            ))}
          </Grid>
        </Box>
        
        <Divider />
        
        <Box>
          <Heading size="sm" mb={4}>Text Settings</Heading>
          
          <VStack spacing={6} align="stretch">
            <Flex direction={{ base: 'column', md: 'row' }} align="start" justify="space-between">
              <Box flex="1" mb={{ base: 4, md: 0 }} mr={{ md: 6 }}>
                <Flex align="center" mb={2}>
                  <Icon as={FaFont} mr={2} />
                  <Text>Font Family</Text>
                </Flex>
                <Select
                  value={settings.fontFamily}
                  onChange={(e) => handleSettingChange('fontFamily', e.target.value)}
                >
                  <option value="inter">Inter</option>
                  <option value="roboto">Roboto</option>
                  <option value="system">System Default</option>
                </Select>
              </Box>
              
              <Box flex="1">
                <Flex align="center" mb={2}>
                  <Icon as={FaTextHeight} mr={2} />
                  <Text>Font Size</Text>
                </Flex>
                <Select
                  value={settings.fontSize}
                  onChange={(e) => handleSettingChange('fontSize', e.target.value)}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </Select>
              </Box>
            </Flex>
          </VStack>
        </Box>
        
        <Divider />
        
        <Box>
          <Heading size="sm" mb={4}>Message Display</Heading>
          
          <VStack spacing={6} align="stretch">
            <Box>
              <Flex align="center" mb={2}>
                <Icon as={settings.messageDensity === 'compact' ? FaCompress : FaExpand} mr={2} />
                <Text>Message Density</Text>
                <Badge ml={2} colorScheme={settings.primaryColor}>
                  {settings.messageDensity.charAt(0).toUpperCase() + settings.messageDensity.slice(1)}
                </Badge>
              </Flex>
              <RadioGroup
                value={settings.messageDensity}
                onChange={(value) => handleSettingChange('messageDensity', value)}
              >
                <Stack direction="row" spacing={5}>
                  <Radio value="compact">Compact</Radio>
                  <Radio value="comfortable">Comfortable</Radio>
                  <Radio value="spacious">Spacious</Radio>
                </Stack>
              </RadioGroup>
            </Box>
            
            <Box>
              <Flex align="center" mb={2}>
                <Text>Message Corner Style</Text>
                <Tooltip label="Changes the shape of message bubbles">
                  <Icon as={FaInfoCircle} ml={2} opacity={0.7} />
                </Tooltip>
              </Flex>
              <RadioGroup
                value={settings.messageCornerStyle}
                onChange={(value) => handleSettingChange('messageCornerStyle', value)}
              >
                <Stack direction="row" spacing={5}>
                  <Radio value="rounded">Rounded</Radio>
                  <Radio value="bubbles">Bubbles</Radio>
                  <Radio value="angular">Angular</Radio>
                </Stack>
              </RadioGroup>
            </Box>
            
            <Box>
              <Flex align="center" mb={2}>
                <Text>Message Alignment</Text>
              </Flex>
              <RadioGroup
                value={settings.messageAlignment}
                onChange={(value) => handleSettingChange('messageAlignment', value)}
              >
                <Stack direction="row" spacing={5}>
                  <Radio value="default">Default</Radio>
                  <Radio value="left">Left-aligned</Radio>
                  <Radio value="right">Right-aligned</Radio>
                </Stack>
              </RadioGroup>
            </Box>
          </VStack>
        </Box>
        
        <MessagePreview />
        
        <Divider />
        
        <Flex justifyContent="flex-end">
          <Button
            colorScheme={settings.primaryColor}
            onClick={saveSettings}
            isLoading={isSaving}
            loadingText="Saving"
            size="lg"
          >
            Save Appearance Settings
          </Button>
        </Flex>
      </VStack>
    </Box>
  );
};
