// src/components/layout/Header.tsx
import React, { useCallback, useState, useEffect, MouseEvent } from 'react';
import {
  Box, 
  Flex, 
  Button, 
  IconButton, 
  useColorMode,
  Heading, 
  HStack, 
  Avatar, 
  Menu, 
  MenuButton,
  MenuList, 
  MenuItem, 
  Divider, 
  Text, 
  useToast,
  useDisclosure, 
  Drawer, 
  DrawerBody, 
  DrawerHeader,
  DrawerOverlay, 
  DrawerContent, 
  DrawerCloseButton,
  DrawerFooter,
  VStack, 
  Badge,
  Tooltip,
  useMediaQuery
} from '@chakra-ui/react';
import { 
  FaMoon, 
  FaSun, 
  FaBars, 
  FaUserCircle, 
  FaCog, 
  FaSignOutAlt,
  FaHome,
  FaChartBar,
  FaUserShield,
  FaComments,
  FaInfoCircle
} from 'react-icons/fa';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
// Import the notification toggle component
import { NotificationToggle } from '../common/NotificationToggle';

// Logo component with improved organization and proper TypeScript types
interface AeronyxLogoProps {
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  showText?: boolean;
}

const AeronyxLogo: React.FC<AeronyxLogoProps> = ({ 
  size = 'md', 
  onClick, 
  showText = true 
}) => {
  const { colorMode } = useColorMode();
  // 调整 logo 尺寸以更好地适配不同场景
  const logoSize = size === 'sm' ? "22px" : size === 'md' ? "28px" : "36px";
  const textSize = size === 'sm' ? "sm" : size === 'md' ? "md" : "lg";
  const fontWeight = size === 'sm' ? "semibold" : "bold";
  
  return (
    <Flex 
      align="center" 
      onClick={onClick}
      cursor={onClick ? "pointer" : "default"}
      aria-label="AeroNyx Logo"
    >
      <Box 
        position="relative" 
        width={logoSize} 
        height={logoSize} 
        mr={size === 'sm' ? 1.5 : 2.5}
        // 添加轻微动画效果增强质感
        transition="transform 0.2s ease-in-out"
        _hover={{ transform: "scale(1.05)" }}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          height="100%" 
          width="100%" 
          viewBox="0 0 40 40"
          style={{ filter: colorMode === 'dark' ? 'drop-shadow(0 0 2px rgba(149, 128, 255, 0.5))' : 'drop-shadow(0 0 1px rgba(116, 98, 247, 0.3))' }}
        >
          <g clipPath="url(#clip0_41_7839)">
            <mask height="40" id="mask0_41_7839" maskUnits="userSpaceOnUse" style={{maskType: "luminance"}} width="40" x="0" y="0">
              <path d="M-1.74846e-06 0L0 40L40 40L40 -1.74846e-06L-1.74846e-06 0Z" fill="white"/>
            </mask>
            <g mask="url(#mask0_41_7839)">
              <path 
                clipRule="evenodd" 
                d="M-8.74228e-07 20L0 40L20 20L20 40L40 20L40 -1.74846e-06L20 20L20 -8.74228e-07L-8.74228e-07 20Z" 
                fill={colorMode === 'dark' ? "#8673ff" : "#7462F7"} 
                fillRule="evenodd"
              />
            </g>
          </g>
          <defs>
            <clipPath id="clip0_41_7839">
              <rect fill="white" height="40" transform="translate(0 40) rotate(-90)" width="40"/>
            </clipPath>
          </defs>
        </svg>
      </Box>
      {showText && (
        <Heading 
          size={textSize} 
          fontWeight={fontWeight}
          letterSpacing="tight"
          // 更柔和的渐变色调
          bgGradient={colorMode === 'dark' 
            ? "linear(to-r, purple.300, blue.300)" 
            : "linear(to-r, purple.600, blue.500)"
          } 
          bgClip="text"
          // 增加轻微文字阴影以增强质感
          textShadow={colorMode === 'dark' ? "0 0 8px rgba(149, 128, 255, 0.3)" : "none"}
        >
          AeroNyx
        </Heading>
      )}
    </Flex>
  );
};

// Navigation item component for better reuse
interface NavItemProps {
  icon: React.ReactElement;
  label: string;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
  isMobile?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ 
  icon, 
  label, 
  href, 
  onClick, 
  isActive = false,
  isMobile = false
}) => {
  const { colorMode } = useColorMode();
  
  // Use Next.js Link for navigation items with href
  if (href) {
    return (
      <Link href={href} passHref>
        <Button
          as="a"
          variant={isMobile ? "ghost" : (isActive ? "solid" : "ghost")}
          leftIcon={icon}
          size={isMobile ? "md" : "sm"}
          justifyContent={isMobile ? "flex-start" : "center"}
          width={isMobile ? "full" : "auto"}
          colorScheme={isActive ? "purple" : undefined}
          fontWeight={isActive ? "bold" : "medium"}
          py={isMobile ? 3 : 2}
          _hover={{
            bg: colorMode === 'dark' ? 'purple.800' : 'purple.50',
            color: colorMode === 'dark' ? 'purple.200' : 'purple.600'
          }}
        >
          {label}
        </Button>
      </Link>
    );
  }
  
  // Use regular button for action items
  return (
    <Button
      variant="ghost"
      leftIcon={icon}
      onClick={onClick}
      size={isMobile ? "md" : "sm"}
      justifyContent={isMobile ? "flex-start" : "center"}
      width={isMobile ? "full" : "auto"}
      py={isMobile ? 3 : 2}
      _hover={{
        bg: colorMode === 'dark' ? 'red.800' : 'red.50',
        color: colorMode === 'dark' ? 'red.200' : 'red.600'
      }}
    >
      {label}
    </Button>
  );
};

// Custom User interface with avatarUrl property
interface ExtendedUser {
  displayName?: string;
  walletAddress?: string;
  avatarUrl?: string;
  [key: string]: any; // Allow any other properties that might be on the user object
}

export const Header: React.FC = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuth();
  const toast = useToast();
  const [isMobile] = useMediaQuery("(max-width: 768px)");
  const [scrollDirection, setScrollDirection] = useState('none');
  const [lastScrollTop, setLastScrollTop] = useState(0);
  
  // Handle scroll behavior for auto-hiding header on mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleScroll = () => {
      const st = window.pageYOffset;
      
      if (st > lastScrollTop && st > 60) {
        // Scrolling down
        setScrollDirection('down');
      } else if (st < lastScrollTop) {
        // Scrolling up
        setScrollDirection('up');
      }
      
      setLastScrollTop(st);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollTop]);
  
  const handleLogoClick = useCallback(() => {
    router.push('/');
    if (isOpen) onClose();
  }, [router, isOpen, onClose]);
  
  const handleLogout = useCallback(async () => {
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
      
      // Close drawer if open on mobile
      if (isOpen) onClose();
      
      toast({
        title: "Logged out successfully",
        status: "success",
        duration: 3000,
        position: isMobile ? "bottom" : "top-right",
        isClosable: true
      });
      
      // Navigation will be handled by the logout function
    } catch (error) {
      console.error("Logout failed:", error);
      
      toast({
        title: "Logout failed",
        description: "Please try again",
        status: "error",
        duration: 3000,
        position: isMobile ? "bottom" : "top-right",
        isClosable: true
      });
    }
  }, [logout, isOpen, onClose, toast, isMobile]);
  
  const handleProfileClick = useCallback(() => {
    router.push('/profile');
    if (isOpen) onClose();
  }, [router, isOpen, onClose]);
  
  const handleSettingsClick = useCallback(() => {
    router.push('/settings');
    if (isOpen) onClose();
  }, [router, isOpen, onClose]);
  
  const handleDashboardClick = useCallback(() => {
    router.push('/dashboard');
    if (isOpen) onClose();
  }, [router, isOpen, onClose]);

  // Using type assertion for user
  const extendedUser = user as ExtendedUser;

  // Get current route for active state
  const currentRoute = router.pathname;
  
  return (
    <Box
      as="header"
      py={{ base: 2, md: 3 }}
      px={{ base: 4, md: 6 }}
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      boxShadow="sm"
      position="sticky"
      top={0}
      zIndex={100}
      transition="transform 0.3s ease"
      transform={isMobile && scrollDirection === 'down' ? 'translateY(-100%)' : 'translateY(0)'}
    >
      <Flex align="center" justify="space-between" maxW="1200px" mx="auto">
        <HStack spacing={{ base: 2, md: 4 }}>
          {isMobile && (
            <IconButton
              display={{ base: 'flex', md: 'none' }}
              aria-label="Open menu"
              icon={<FaBars />}
              onClick={onOpen}
              variant="ghost"
              size="md"
            />
          )}
          
          <AeronyxLogo
            onClick={handleLogoClick}
            size={isMobile ? "sm" : "md"}
            showText={!isMobile}
          />
          
          {!isMobile && (
            <HStack spacing={1} ml={4} display={{ base: 'none', md: 'flex' }}>
              <NavItem
                icon={<FaChartBar />}
                label="Dashboard"
                href="/dashboard"
                isActive={currentRoute === '/dashboard'}
              />
              <NavItem
                icon={<FaComments />}
                label="Chats"
                href="/chats"
                isActive={currentRoute.startsWith('/chat')}
              />
              <NavItem
                icon={<FaUserShield />}
                label="Profile"
                href="/profile"
                isActive={currentRoute === '/profile'}
              />
            </HStack>
          )}
        </HStack>

        <HStack spacing={{ base: 2, md: 3 }}>
          {/* Notification Toggle Button - Only shown if user is authenticated */}
          {isAuthenticated && (
            <NotificationToggle 
              size={isMobile ? "sm" : "md"} 
              variant="ghost" 
              isCompact={true}
            />
          )}
          
          <Tooltip label={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`}>
            <IconButton
              aria-label={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`}
              icon={colorMode === 'dark' ? <FaSun /> : <FaMoon />}
              onClick={toggleColorMode}
              variant="ghost"
              size={isMobile ? "sm" : "md"}
            />
          </Tooltip>
          
          {isAuthenticated ? (
            <Menu closeOnSelect placement="bottom-end">
              <MenuButton
                as={Button}
                variant="ghost"
                rounded="full"
                p={0}
                _hover={{ bg: 'transparent' }}
              >
                <Avatar 
                  size={isMobile ? "xs" : "sm"}
                  name={extendedUser?.displayName || 'User'} 
                  bg="purple.500"
                  src={extendedUser?.avatarUrl}
                />
              </MenuButton>
              <MenuList py={2} boxShadow="lg">
                {isMobile && (
                  <Box px={3} py={2} mb={2}>
                    <Text fontWeight="bold">{extendedUser?.displayName || 'User'}</Text>
                    <Text fontSize="sm" color="gray.500" noOfLines={1}>
                      {extendedUser?.walletAddress ? 
                        `${extendedUser.walletAddress.substring(0, 6)}...${extendedUser.walletAddress.substring(extendedUser.walletAddress.length - 4)}` 
                        : 'Wallet Connected'}
                    </Text>
                  </Box>
                )}
                
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
                
                {/* Add notifications menu item for mobile */}
                {isMobile && (
                  <Box width="full" px={3} py={2}>
                    <Flex align="center" justify="space-between">
                      <Text fontSize="sm">Notifications</Text>
                      <NotificationToggle size="sm" variant="ghost" isCompact={false} />
                    </Flex>
                  </Box>
                )}
                
                <Divider my={2} />
                <MenuItem 
                  icon={<FaSignOutAlt />} 
                  onClick={handleLogout}
                  _hover={{
                    bg: colorMode === 'dark' ? 'red.900' : 'red.50',
                    color: colorMode === 'dark' ? 'red.200' : 'red.600'
                  }}
                >
                  Logout
                </MenuItem>
              </MenuList>
            </Menu>
          ) : (
            <Button 
              colorScheme="purple"
              size={isMobile ? "sm" : "md"}
              onClick={() => router.push('/auth/connect-wallet')}
              fontWeight="medium"
              px={isMobile ? 3 : 4}
            >
              Connect
            </Button>
          )}
        </HStack>
      </Flex>
      
      {/* Mobile Menu Drawer - Enhanced for usability */}
      <Drawer 
        isOpen={isOpen} 
        placement="left" 
        onClose={onClose}
        size={isMobile ? "full" : "xs"}
      >
        <DrawerOverlay />
        <DrawerContent bg={colorMode === 'dark' ? 'gray.800' : 'white'}>
          <DrawerCloseButton size="lg" />
          <DrawerHeader borderBottomWidth="1px" py={4}>
            <AeronyxLogo size="sm" />
          </DrawerHeader>
          
          <DrawerBody py={4}>
            {isAuthenticated && (
              <Flex 
                direction="column" 
                align="center" 
                mb={6} 
                pt={2}
                pb={4}
                borderBottomWidth="1px"
                borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
              >
                <Avatar 
                  size="lg" 
                  name={extendedUser?.displayName || 'User'} 
                  bg="purple.500"
                  src={extendedUser?.avatarUrl}
                  mb={3}
                />
                <Text fontWeight="bold" fontSize="lg">{extendedUser?.displayName || 'User'}</Text>
                {extendedUser?.walletAddress && (
                  <Badge colorScheme="purple" mt={1} fontSize="xs">
                    {`${extendedUser.walletAddress.substring(0, 6)}...${extendedUser.walletAddress.substring(extendedUser.walletAddress.length - 4)}`}
                  </Badge>
                )}
                
                {/* Add notification button in mobile profile section */}
                <Box mt={3}>
                  <NotificationToggle size="md" variant="outline" isCompact={false} />
                </Box>
              </Flex>
            )}
            
            <VStack align="start" spacing={3}>
              <NavItem
                icon={<FaHome />}
                label="Home"
                href="/"
                isMobile={true}
                isActive={currentRoute === '/'}
              />
              <NavItem
                icon={<FaChartBar />}
                label="Dashboard"
                href="/dashboard"
                isMobile={true}
                isActive={currentRoute === '/dashboard'}
              />
              <NavItem
                icon={<FaComments />}
                label="Chats"
                href="/chats"
                isMobile={true}
                isActive={currentRoute.startsWith('/chat')}
              />
              <NavItem
                icon={<FaUserCircle />}
                label="Profile"
                href="/profile"
                isMobile={true}
                isActive={currentRoute === '/profile'}
              />
              <NavItem
                icon={<FaCog />}
                label="Settings"
                href="/settings"
                isMobile={true}
                isActive={currentRoute === '/settings'}
              />
              
              <Divider my={2} />
              
              <Box width="full">
                <Button
                  leftIcon={<FaInfoCircle />}
                  variant="ghost"
                  width="full"
                  justifyContent="flex-start"
                  py={3}
                  onClick={() => router.push('/about')}
                >
                  About AeroNyx
                </Button>
              </Box>
            </VStack>
          </DrawerBody>
          
          <DrawerFooter borderTopWidth="1px">
            {isAuthenticated ? (
              <Button 
                colorScheme="red" 
                variant="outline"
                onClick={handleLogout}
                size="lg"
                width="full"
                leftIcon={<FaSignOutAlt />}
              >
                Logout
              </Button>
            ) : (
              <Button 
                colorScheme="purple" 
                onClick={() => {
                  router.push('/auth/connect-wallet');
                  onClose();
                }}
                size="lg"
                width="full"
              >
                Connect Wallet
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Box>
  );
};
