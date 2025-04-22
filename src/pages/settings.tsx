import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useColorMode,
  Heading,
  Flex,
  Icon,
  Text,
  Container,
  VStack,
  useToast,
} from '@chakra-ui/react';
import {
  FaShieldAlt,
  FaPalette,
  FaBell,
  FaUser,
  FaCog,
  FaServer,
} from 'react-icons/fa';
import { Layout } from '../components/layout/Layout';
import { SecuritySettings } from '../components/settings/SecuritySettings';
import { AppearanceSettings } from '../components/settings/AppearanceSettings';
import { NotificationControls } from '../components/settings/NotificationControls';
import { ServerSettings } from '../components/settings/ServerSettings';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';


const SettingsPage = () => {
  const router = useRouter();
  const { colorMode } = useColorMode();
  const toast = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { appearance, updateAppearance } = useAppTheme();
  const { settings: notificationSettings, updateSettings: updateNotificationSettings } = useNotifications();
  
  // Get the tab index from the URL query parameter
  const [tabIndex, setTabIndex] = useState(0);
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/connect-wallet');
    }
    
    // Set tab index based on URL query parameter
    const { tab } = router.query;
    if (tab) {
      const index = parseInt(tab as string);
      if (!isNaN(index) && index >= 0 && index <= 4) { // Updated max index to include server settings
        setTabIndex(index);
      }
    }
  }, [isLoading, isAuthenticated, router, router.query]);
  
  // Update URL when tab changes
  const handleTabChange = (index: number) => {
    setTabIndex(index);
    router.push({
      pathname: router.pathname,
      query: { tab: index },
    }, undefined, { shallow: true });
  };
  
  // Handler for saving security settings
  const handleSaveSecuritySettings = () => {
    toast({
      title: "Security settings saved",
      description: "Your security preferences have been updated",
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };
  
  // Handler for saving appearance settings
  const handleSaveAppearanceSettings = () => {
    toast({
      title: "Appearance settings saved",
      description: "Your display preferences have been updated",
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };
  
  // Handler for saving notification settings
  const handleSaveNotificationSettings = () => {
    toast({
      title: "Notification settings saved",
      description: "Your notification preferences have been updated",
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };
  
  // Handler for saving server settings
  const handleSaveServerSettings = () => {
    toast({
      title: "Server settings saved",
      description: "Your server connection preferences have been updated",
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };
  
  if (isLoading) {
    return <Layout>
      <Container maxW="container.xl" py={8}>
        <Text>Loading...</Text>
      </Container>
    </Layout>;
  }
  
  if (!isAuthenticated) {
    return null; // Redirect happens in useEffect
  }

  return (
    <Layout>
      <Container maxW="container.xl" py={8}>
        <VStack spacing={8} align="stretch">
          <Flex align="center" mb={4}>
            <Icon as={FaCog} color="purple.500" boxSize={8} mr={4} />
            <Heading size="lg">AeroNyx Settings</Heading>
          </Flex>
          
          <Tabs 
            variant="soft-rounded" 
            colorScheme="purple" 
            index={tabIndex}
            onChange={handleTabChange}
            isLazy
          >
            <TabList mb={8} overflowX="auto" py={2}>
              <Tab>
                <Icon as={FaShieldAlt} mr={2} />
                <Text>Security & Privacy</Text>
              </Tab>
              <Tab>
                <Icon as={FaPalette} mr={2} />
                <Text>Appearance</Text>
              </Tab>
              <Tab>
                <Icon as={FaBell} mr={2} />
                <Text>Notifications</Text>
              </Tab>
              <Tab>
                <Icon as={FaUser} mr={2} />
                <Text>Profile</Text>
              </Tab>
              <Tab>
                <Icon as={FaServer} mr={2} />
                <Text>Server</Text>
              </Tab>
            </TabList>
                     <TabPanel>
                <ServerSettings onSave={handleSaveServerSettings} />
              </TabPanel>
            <TabPanels>
              <TabPanel>
                <SecuritySettings onSave={handleSaveSecuritySettings} />
              </TabPanel>
              <TabPanel>
                <AppearanceSettings onSave={handleSaveAppearanceSettings} />
              </TabPanel>
              <TabPanel>
                <NotificationControls onSave={handleSaveNotificationSettings} />
              </TabPanel>
              <TabPanel>
                <Box
                  p={6}
                  borderRadius="lg"
                  bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                  boxShadow="md"
                >
                  <Heading size="md" mb={4}>Profile Settings</Heading>
                  <Text>Profile settings coming soon!</Text>
                </Box>
              </TabPanel>
     
    
            </TabPanels>
          </Tabs>
        </VStack>
      </Container>
    </Layout>
  );
};

export default SettingsPage;
