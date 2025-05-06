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
  useDisclosure
} from '@chakra-ui/react';
import { FaBell, FaBellSlash, FaInfoCircle } from 'react-icons/fa';

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
  
  // Track notification permission status
  const [permissionStatus, setPermissionStatus] = useState<NotificationStatus>('default');
  const [isSupported, setIsSupported] = useState<boolean>(false);
  
  // Detect browser support for notifications
  useEffect(() => {
    // Check if browser supports notifications
    const checkNotificationSupport = () => {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') return false;
      
      // Check if the Notification API is available
      const hasNotificationAPI = 'Notification' in window;
      
      // Additional check for mobile browsers that claim to support 
      // but don't actually show notifications
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      
      // Safari on iOS says it supports but doesn't actually allow
      const isSafariIOS = isMobile && /Safari/i.test(navigator.userAgent) && /Apple/i.test(navigator.vendor);
      
      // Check for Web3 wallet browser environment more safely
      // Use type assertions with a separate variable
      const windowAny = window as any;
      const hasWalletExtension = !!(
        windowAny.ethereum || 
        windowAny.web3 || 
        windowAny.solana || 
        windowAny.phantom
      );
      
      const isInsideWalletBrowser = hasWalletExtension && isMobile;
      
      // Set support flag based on these checks
      const supported = hasNotificationAPI && !(isSafariIOS && !isInsideWalletBrowser);
      setIsSupported(supported);
      
      // Check current permission status if supported
      if (supported) {
        const currentPermission = Notification.permission;
        if (currentPermission === 'granted') {
          setPermissionStatus('granted');
        } else if (currentPermission === 'denied') {
          setPermissionStatus('denied');
        } else {
          setPermissionStatus('default');
        }
      } else {
        setPermissionStatus('unavailable');
      }
    };
    
    checkNotificationSupport();
    
    // Set up event listener for visibility changes
    // This helps update the permission status when user returns to the page
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isSupported) {
        const currentPermission = Notification.permission;
        if (currentPermission === 'granted') {
          setPermissionStatus('granted');
        } else if (currentPermission === 'denied') {
          setPermissionStatus('denied');
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSupported]);
  
  // Handle requesting notification permission
  const requestPermission = async () => {
    if (!isSupported) {
      toast({
        title: 'Notifications not supported',
        description: 'Your browser does not support notifications',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
      return;
    }
    
    try {
      // Request permission
      const permission = await Notification.requestPermission();
      
      // Update state based on user's choice
      if (permission === 'granted') {
        setPermissionStatus('granted');
        sendTestNotification();
        toast({
          title: 'Notifications enabled',
          description: 'You will now receive updates from AeroNyx',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else if (permission === 'denied') {
        setPermissionStatus('denied');
        toast({
          title: 'Notifications blocked',
          description: 'Please update your browser settings to enable notifications',
          status: 'error',
          duration: 5000,
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
    if (Notification.permission === 'granted') {
      try {
        // Create logo URL for notification icon
        const iconUrl = `${window.location.origin}/images/aeronyx-logo.png`;
        
        // Send test notification
        const notification = new Notification('AeroNyx Notifications Enabled', {
          body: 'You will now receive important updates and alerts',
          icon: iconUrl,
          badge: iconUrl,
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
      }
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
  
  // Only render if the browser supports notifications
  if (!isSupported) return null;
  
  // Determine button appearance based on status
  const getButtonProps = () => {
    switch (permissionStatus) {
      case 'granted':
        return {
          icon: <FaBell />,
          colorScheme: 'green',
          tooltipText: 'Notifications enabled',
          onClick: () => {}, // Do nothing, already enabled
          'aria-label': 'Notifications enabled'
        };
      case 'denied':
        return {
          icon: <FaBellSlash />,
          colorScheme: 'red',
          tooltipText: 'Notifications blocked - Click to open settings',
          onClick: openBrowserSettings,
          'aria-label': 'Notifications blocked'
        };
      default:
        return {
          icon: <FaBell />,
          colorScheme: 'purple',
          tooltipText: 'Enable notifications',
          onClick: requestPermission,
          'aria-label': 'Enable notifications'
        };
    }
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
          {permissionStatus === 'granted' ? 'Notifications On' : 
           permissionStatus === 'denied' ? 'Notifications Off' : 
           'Enable Notifications'}
        </Button>
      )}
      
      {/* Help modal for denied permissions */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent 
          bg={colorMode === 'dark' ? 'gray.800' : 'white'}
          maxW="500px"
        >
          <ModalHeader display="flex" alignItems="center">
            <FaInfoCircle color={colorMode === 'dark' ? '#9F7AEA' : '#6B46C1'} />
            <Text ml={2}>How to Enable Notifications</Text>
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
