// src/components/layout/Header.tsx
import React from 'react';
import {
  Box, Flex, Button, IconButton, useColorMode,
  Heading, HStack, Avatar, Menu, MenuButton,
  MenuList, MenuItem, Divider, Text, useToast,
  useDisclosure, Drawer, DrawerBody, DrawerHeader,
  DrawerOverlay, DrawerContent, DrawerCloseButton,
  VStack, Badge
} from '@chakra-ui/react';
import { FaMoon, FaSun, FaBars, FaUserCircle, FaCog, FaSignOutAlt } from 'react-icons/fa';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';

export const Header: React.FC = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuth();
  const toast = useToast();
  
  const handleLogoClick = () => {
    router.push('/');
  };
  
  const handleLogout = async () => {
    try {
      // Clear any active WebSocket connections before logout
      if (typeof window !== 'undefined') {
        // Dispatch event to notify components to clean up
        window.dispatchEvent(new CustomEvent('aeronyx-logout'));
      }
      
      // Set logout flag to prevent auto-login
      sessionStorage.setItem('force-logout', 'true');
      
      // Call the logout function from AuthContext
      await logout();
      
      toast({
        title: "Logged out successfully",
        status: "success",
        duration: 3000,
      });
      
      // Navigation will be handled by the logout function
    } catch (error) {
      console.error("Logout failed:", error);
      
      toast({
        title: "Logout failed",
        description: "Please try again",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  const handleProfileClick = () => {
    router.push('/profile');
  };
  
  const handleSettingsClick = () => {
    router.push('/settings');
  };

  return (
    <Box
      as="header"
      py={3}
      px={6}
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      boxShadow="sm"
      position="sticky"
      top={0}
      zIndex={10}
    >
      <Flex align="center" justify="space-between" maxW="1200px" mx="auto">
        <HStack spacing={4}>
          <IconButton
            display={{ base: 'flex', md: 'none' }}
            aria-label="Open menu"
            icon={<FaBars />}
            onClick={onOpen}
            variant="ghost"
          />
          
          <Box 
            cursor="pointer" 
            onClick={handleLogoClick}
            display="flex"
            alignItems="center"
          >
            <Box position="relative" width="32px" height="32px" mr={2}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" height="40" viewBox="0 0 40 40" width="40">
                <g clipPath="url(#clip0_41_7839)">
                  <mask height="40" id="mask0_41_7839" maskUnits="userSpaceOnUse" style={{maskType: "luminance"}} width="40" x="0" y="0">
                    <path d="M-1.74846e-06 0L0 40L40 40L40 -1.74846e-06L-1.74846e-06 0Z" fill="white"/>
                  </mask>
                  <g mask="url(#mask0_41_7839)">
                    <path clipRule="evenodd" d="M-8.74228e-07 20L0 40L20 20L20 40L40 20L40 -1.74846e-06L20 20L20 -8.74228e-07L-8.74228e-07 20Z" fill="#7462F7" fillRule="evenodd"/>
                  </g>
                </g>
                <defs>
                  <clipPath id="clip0_41_7839">
                    <rect fill="white" height="40" transform="translate(0 40) rotate(-90)" width="40"/>
                  </clipPath>
                </defs>
              </svg>
            </Box>
            <Heading size="md" bgGradient="linear(to-r, purple.500, blue.500)" bgClip="text">
              AeroNyx
            </Heading>
          </Box>
        </HStack>

        <HStack spacing={4}>
          <IconButton
            aria-label={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`}
            icon={colorMode === 'dark' ? <FaSun /> : <FaMoon />}
            onClick={toggleColorMode}
            variant="ghost"
          />
          
          {isAuthenticated ? (
            <Menu>
              <MenuButton
                as={Button}
                variant="ghost"
                rounded="full"
                p={0}
              >
                <Avatar 
                  size="sm" 
                  name={user?.displayName || 'User'} 
                  bg="purple.500"
                />
              </MenuButton>
              <MenuList>
                <MenuItem 
                  icon={<FaUserCircle />} 
                  onClick={handleProfileClick}
                >
                  Profile
                </MenuItem>
                <MenuItem 
                  icon={<FaCog />} 
                  onClick={handleSettingsClick}
                >
                  Settings
                </MenuItem>
                <Divider />
                <MenuItem 
                  icon={<FaSignOutAlt />} 
                  onClick={handleLogout}
                >
                  Logout
                </MenuItem>
              </MenuList>
            </Menu>
          ) : (
            <Button 
              colorScheme="purple"
              onClick={() => router.push('/auth/connect-wallet')}
            >
              Connect
            </Button>
          )}
        </HStack>
      </Flex>
      
      {/* Mobile Menu Drawer */}
      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent bg={colorMode === 'dark' ? 'gray.800' : 'white'}>
          <DrawerCloseButton />
          <DrawerHeader>
            <Flex align="center">
              <Box position="relative" width="24px" height="24px" mr={2}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" height="40" viewBox="0 0 40 40" width="40">
                  <g clipPath="url(#clip0_41_7839)">
                    <mask height="40" id="mask0_41_7839" maskUnits="userSpaceOnUse" style={{maskType: "luminance"}} width="40" x="0" y="0">
                      <path d="M-1.74846e-06 0L0 40L40 40L40 -1.74846e-06L-1.74846e-06 0Z" fill="white"/>
                    </mask>
                    <g mask="url(#mask0_41_7839)">
                      <path clipRule="evenodd" d="M-8.74228e-07 20L0 40L20 20L20 40L40 20L40 -1.74846e-06L20 20L20 -8.74228e-07L-8.74228e-07 20Z" fill="#7462F7" fillRule="evenodd"/>
                    </g>
                  </g>
                  <defs>
                    <clipPath id="clip0_41_7839">
                      <rect fill="white" height="40" transform="translate(0 40) rotate(-90)" width="40"/>
                    </clipPath>
                  </defs>
                </svg>
              </Box>
              <Text bgGradient="linear(to-r, purple.500, blue.500)" bgClip="text" fontWeight="bold">
                AeroNyx
              </Text>
            </Flex>
          </DrawerHeader>
          <DrawerBody>
            <VStack align="start" spacing={4}>
              <Link href="/dashboard" passHref>
                <Button as="a" variant="ghost" justifyContent="flex-start" width="full">
                  Dashboard
                </Button>
              </Link>
              <Link href="/profile" passHref>
                <Button as="a" variant="ghost" justifyContent="flex-start" width="full">
                  Profile
                </Button>
              </Link>
              <Link href="/settings" passHref>
                <Button as="a" variant="ghost" justifyContent="flex-start" width="full">
                  Settings
                </Button>
              </Link>
              <Divider />
              <Button variant="ghost" onClick={handleLogout} justifyContent="flex-start" width="full">
                Logout
              </Button>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  );
};
