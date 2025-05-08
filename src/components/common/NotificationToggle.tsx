// src/components/common/NotificationToggle.tsx
import React, { useState, useEffect } from 'react';
import {
  Button,
  IconButton,
  Tooltip,
  useToast,
  useColorMode,
  Box,
  Text,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Switch
} from '@chakra-ui/react';
import { FaBell, FaBellSlash, FaInfoCircle } from 'react-icons/fa';
import { useNotifications } from '../../contexts/NotificationContext';

// AeroNyx logo as inline SVG data URI
const AERONYX_LOGO_SVG = `data:image/svg+xml;base64,${btoa(`<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 20010904//EN"
"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd">
<svg version="1.0" xmlns="http://www.w3.org/2000/svg"
width="32.000000pt" height="32.000000pt" viewBox="0 0 512.000000 512.000000"
preserveAspectRatio="xMidYMid meet">
<g transform="translate(0.000000,512.000000) scale(0.100000,-0.100000)"
fill="#7762F3" stroke="none">
<path d="M1277 3833 l-1277 -1278 0 -1275 0 -1275 1280 1280 1280 1280 -2
1273 -3 1272 -1278 -1277z"/>
<path d="M3838 3833 l-1278 -1278 0 -1275 0 -1275 1280 1280 1280 1280 -2
1273-3 1272-1277 -1277z"/>
</g>
</svg>`)}`;

interface NotificationToggleProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'outline' | 'solid';
  isCompact?: boolean;
  className?: string;
}

// Notification status type to track different states
type NotificationStatus = 'default' | 'granted' | 'denied' | 'unavailable';

export const NotificationToggle: React.FC<NotificationToggleProps> = ({
  size = 'md',
  variant = 'ghost',
  isCompact = false,
  className
}) => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  // Use notification context
  const {
    settings,
    updateSettings,
    hasPermission,
    requestPermission,
    notificationsSupported
  } = useNotifications();
  
  // Track notification permission status
  const [permissionStatus, setPermissionStatus] = useState<NotificationStatus>('default');
  const [isSupported, setIsSupported] = useState<boolean>(true); // Default to true to avoid flickering
  
  // Detect browser support for notifications
  useEffect(() => {
    // Check if browser supports notifications
    const checkNotificationSupport = () => {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        setIsSupported(false);
        return;
      }
      
      // Check if the Notification API is available
      const hasNotificationAPI = 'Notification' in window;
      
      if (!hasNotificationAPI) {
        setIsSupported(false);
        setPermissionStatus('unavailable');
        return;
      }
      
      // Additional check for mobile browsers that claim to support 
      // but don't actually show notifications
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      
      // Safari on iOS says it supports but doesn't actually allow
      const isSafariIOS = isMobile && /Safari/i.test(navigator.userAgent) && /Apple/i.test(navigator.vendor);
      
      // Check for Web3 wallet browser environment more safely
      let hasWalletExtension = false;
      
      try {
        // Use type assertions with a separate variable
        const windowAny = window as any;
        hasWalletExtension = !!(
          windowAny.ethereum || 
          windowAny.web3 || 
          windowAny.solana || 
          windowAny.phantom
        );
      } catch (error) {
        console.warn("Error checking for wallet extensions:", error);
        // Continue without wallet detection
      }
      
      const isInsideWalletBrowser = hasWalletExtension && isMobile;
      
      // Set support flag based on these checks
      // Safari on iOS is problematic unless inside a wallet browser
      const supported = hasNotificationAPI && !(isSafariIOS && !isInsideWalletBrowser);
      
      setIsSupported(supported);
      
      // Check current permission status if supported
      if (supported) {
        try {
          const currentPermission = Notification.permission;
          if (currentPermission === 'granted') {
            setPermissionStatus('granted');
          } else if (currentPermission === 'denied') {
            setPermissionStatus('denied');
          } else {
            setPermissionStatus('default');
          }
        } catch (error) {
          console.error("Error checking notification permission:", error);
          setPermissionStatus('unavailable');
        }
      } else {
        setPermissionStatus('unavailable');
      }
    };
    
    // Safely execute the check
    try {
      checkNotificationSupport();
    } catch (error) {
      console.error("Fatal error in notification support check:", error);
      setIsSupported(false);
      setPermissionStatus('unavailable');
    }
    
  }, []);

  // Sync with NotificationContext
  useEffect(() => {
    if (hasPermission) {
      setPermissionStatus('granted');
    }
  }, [hasPermission]);
  
  // Handle requesting notification permission
  const handleNotificationToggle = async () => {
    if (!isSupported || typeof window === 'undefined' || !('Notification' in window)) {
      toast({
        title: 'Notifications not supported',
        description: 'Your browser does not support notifications',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    // If notifications are currently enabled, we want to disable them
    if (settings.enableNotifications) {
      // Update context to disable notifications
      updateSettings({ enableNotifications: false });
      toast({
        title: 'Notifications disabled',
        description: 'You will no longer receive notifications from AeroNyx',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    // If notifications are disabled but we already have permission, just enable them
    if (permissionStatus === 'granted') {
      // Update context to enable notifications
      updateSettings({ enableNotifications: true });
      toast({
        title: 'Notifications enabled',
        description: 'You will now receive notifications from AeroNyx',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      sendTestNotification();
      return;
    }
    
    // Otherwise, request permission
    try {
      // Request permission through context
      const granted = await requestPermission();
      
      // Update state based on user's choice
      if (granted) {
        setPermissionStatus('granted');
        updateSettings({ enableNotifications: true });
        sendTestNotification();
        toast({
          title: 'Notifications enabled',
          description: 'You will now receive updates from AeroNyx',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else if (Notification.permission === 'denied') {
        setPermissionStatus('denied');
        updateSettings({ enableNotifications: false });
        toast({
          title: 'Notifications blocked',
          description: 'Please update your browser settings to enable notifications',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } else {
        // Permission state is still "default" (user closed the prompt)
        toast({
          title: 'Notification permission required',
          description: 'Please allow notifications to receive important updates',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast({
        title: 'Something went wrong',
        description: 'Could not request notification permission',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  // Send a test notification when permissions are granted
  const sendTestNotification = () => {
    if (Notification.permission !== 'granted') return;
    
    try {
      // Use the inline SVG data URI as the icon
      const notification = new Notification('AeroNyx Notifications Enabled', {
        body: 'You will now receive important updates and alerts',
        icon: AERONYX_LOGO_SVG,
        badge: AERONYX_LOGO_SVG,
        tag: 'welcome-notification'
      });
      
      // Close notification after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
      
      // Handle notification click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.error('Error sending test notification:', error);
      // Don't show error to user - notification failed but permission is still granted
    }
  };
  
  // Open browser settings if permission is denied
  const openBrowserSettings = () => {
    toast({
      title: 'Browser settings required',
      description: 'Please enable notifications in your browser settings for this site',
      status: 'info',
      duration: 5000,
      isClosable: true,
    });
    
    onOpen(); // Open modal with instructions
  };
  
  // Determine button appearance based on status and settings
  const getButtonProps = () => {
    if (!isSupported) {
      return {
        icon: <FaBellSlash />,
        colorScheme: 'gray',
        tooltipText: 'Notifications not supported in this browser',
        onClick: () => {
          toast({
            title: 'Notifications not supported',
            description: 'Your browser does not support notifications or they are disabled by your settings',
            status: 'info',
            duration: 3000,
            isClosable: true,
          });
        },
        'aria-label': 'Notifications not supported'
      };
    }
    
    if (permissionStatus === 'denied') {
      return {
        icon: <FaBellSlash />,
        colorScheme: 'red',
        tooltipText: 'Notifications blocked - Click to open settings',
        onClick: openBrowserSettings,
        'aria-label': 'Notifications blocked'
      };
    }
    
    if (permissionStatus === 'granted') {
      return {
        icon: settings.enableNotifications ? <FaBell /> : <FaBellSlash />,
        colorScheme: settings.enableNotifications ? 'green' : 'gray',
        tooltipText: settings.enableNotifications ? 
          'Notifications enabled - Click to disable' : 
          'Notifications disabled - Click to enable',
        onClick: handleNotificationToggle,
        'aria-label': settings.enableNotifications ? 
          'Disable notifications' : 
          'Enable notifications'
      };
    }
    
    if (permissionStatus === 'unavailable') {
      return {
        icon: <FaBellSlash />,
        colorScheme: 'gray',
        tooltipText: 'Notifications not available',
        onClick: () => {
          toast({
            title: 'Notifications unavailable',
            description: 'Notifications are not available in your current browser environment',
            status: 'info',
            duration: 3000,
            isClosable: true,
          });
        },
        'aria-label': 'Notifications unavailable'
      };
    }
    
    // Default
    return {
      icon: <FaBell />,
      colorScheme: 'purple',
      tooltipText: 'Enable notifications',
      onClick: handleNotificationToggle,
      'aria-label': 'Enable notifications'
    };
  };
  
  const buttonProps = getButtonProps();
  
  return (
    <>
      {isCompact ? (
        <Tooltip 
          label={buttonProps.tooltipText}
          placement="bottom"
          hasArrow
        >
          <IconButton
            icon={buttonProps.icon}
            colorScheme={buttonProps.colorScheme}
            variant={variant}
            size={size}
            onClick={buttonProps.onClick}
            aria-label={buttonProps['aria-label']}
            className={className}
          />
        </Tooltip>
      ) : (
        <Button
          leftIcon={buttonProps.icon}
          colorScheme={buttonProps.colorScheme}
          variant={variant}
          size={size}
          onClick={buttonProps.onClick}
          className={className}
        >
          {permissionStatus === 'granted' && settings.enableNotifications ? 'Notifications On' : 
           permissionStatus === 'granted' && !settings.enableNotifications ? 'Notifications Off' :
           permissionStatus === 'denied' ? 'Notifications Blocked' : 
           permissionStatus === 'unavailable' || !isSupported ? 'Not Supported' :
           'Enable Notifications'}
        </Button>
      )}
      
      {/* Help modal for denied permissions */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay backdropFilter="blur(2px)" />
        <ModalContent 
          bg={colorMode === 'dark' ? 'gray.800' : 'white'}
          maxW="500px"
        >
          <ModalHeader display="flex" alignItems="center">
            <Box mr={2} display="inline-flex">
              <svg width="24" height="24" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet">
                <g transform="translate(0,512) scale(0.1,-0.1)" fill="#7762F3" stroke="none">
                  <path d="M1277 3833 l-1277 -1278 0 -1275 0 -1275 1280 1280 1280 1280 -2 1273 -3 1272 -1278 -1277z"/>
                  <path d="M3838 3833 l-1278 -1278 0 -1275 0 -1275 1280 1280 1280 1280 -2 1273-3 1272-1277 -1277z"/>
                </g>
              </svg>
            </Box>
            <Text>How to Enable Notifications</Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={4}>
              To receive important updates from AeroNyx, you'll need to enable notifications in your browser settings:
            </Text>
            
            <Box p={4} bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'} borderRadius="md" mb={4}>
              <Text fontWeight="bold" mb={2}>Desktop:</Text>
              <Text mb={1}>1. Click on the lock/info icon in your address bar</Text>
              <Text mb={1}>2. Find "Notifications" or "Site Settings"</Text>
              <Text>3. Change the setting to "Allow"</Text>
            </Box>
            
            <Box p={4} bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'} borderRadius="md">
              <Text fontWeight="bold" mb={2}>Mobile:</Text>
              <Text mb={1}>1. Open your browser settings</Text>
              <Text mb={1}>2. Go to "Site Settings" → "Notifications"</Text>
              <Text>3. Find AeroNyx and enable notifications</Text>
            </Box>
          </ModalBody>
          
          <ModalFooter>
            <Button colorScheme="purple" mr={3} onClick={onClose}>
              Got it
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Maybe later
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
