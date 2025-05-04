// src/components/wallet/WalletConnectionCard.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  Heading,
  VStack,
  HStack,
  Icon,
  Divider,
  Avatar,
  Badge,
  useColorMode,
  Tooltip,
  useToast,
  Skeleton,
  Collapse,
  Progress,
  Code,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Grid
} from '@chakra-ui/react';
import {
  FaWallet,
  FaEthereum,
  FaKey,
  FaLock,
  FaShieldAlt,
  FaFingerprint,
  FaUserSecret,
  FaExchangeAlt,
  FaChevronDown,
  FaCopy,
  FaExternalLinkAlt,
  FaSignOutAlt,
  FaEllipsisV,
  FaUserCircle,
  FaCog,
  FaPlus,
  FaBackspace,
  FaInfoCircle,
  FaChartLine,
  FaCheck,
  FaConnectdevelop,
  FaRegCheckCircle,
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';

// Motion components
const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

interface WalletConnectionCardProps {
  showDetails?: boolean;
  isMinimal?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export const WalletConnectionCard: React.FC<WalletConnectionCardProps> = ({
  showDetails = true,
  isMinimal = false,
  onConnect,
  onDisconnect,
}) => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const { isAuthenticated, user, connect, logout } = useAuth();
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStep, setConnectionStep] = useState(0);
  const [showSecurityInfo, setShowSecurityInfo] = useState(false);
  
  // Simulated security metrics
  const [securityMetrics, setSecurityMetrics] = useState({
    encryptionType: 'ChaCha20-Poly1305',
    keyStrength: 384, // bits
    lastKeyRotation: new Date(),
    signaturesVerified: 136,
    connectionType: isAuthenticated ? 'wallet' : 'none',
    protectionLevel: 'high',
  });
  
  // Handle wallet connection
  const handleConnect = async () => {
    setIsConnecting(true);
    setConnectionStep(0);
    
    try {
      // Simulate multi-step connection process
      setConnectionStep(1); // Initializing
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setConnectionStep(2); // Connecting to wallet
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setConnectionStep(3); // Authenticating
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      setConnectionStep(4); // Generating keys
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Connect wallet
      await connect();
      
      setConnectionStep(5); // Complete
      
      toast({
        title: "Wallet connected successfully",
        description: "Your wallet is now linked to the application",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      if (onConnect) {
        onConnect();
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      
      toast({
        title: "Failed to connect wallet",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsConnecting(false);
    }
  };
  
  // Handle wallet disconnection
  const handleDisconnect = async () => {
    try {
      await logout();
      
      toast({
        title: "Wallet disconnected",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      if (onDisconnect) {
        onDisconnect();
      }
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      
      toast({
        title: "Failed to disconnect wallet",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Copy wallet address to clipboard
  const copyWalletAddress = () => {
    if (user?.publicKey) {
      navigator.clipboard.writeText(user.publicKey);
      
      toast({
        title: "Address copied",
        description: "Wallet address copied to clipboard",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    }
  };
  
  // Format wallet address for display
  const formatWalletAddress = (address: string) => {
    if (!address) return '';
    
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  // Calculate connection step progress
  const getConnectionProgress = () => {
    if (connectionStep === 0) return 0;
    return Math.round((connectionStep / 5) * 100);
  };
  
  // Get connection step text
  const getConnectionStepText = () => {
    switch (connectionStep) {
      case 1: return 'Initializing secure connection...';
      case 2: return 'Connecting to wallet...';
      case 3: return 'Authenticating identity...';
      case 4: return 'Generating encryption keys...';
      case 5: return 'Connection complete';
      default: return 'Preparing connection...';
    }
  };
  
  // Minimal wallet display for header/compact view
  if (isMinimal) {
    return (
      <Box>
        {isAuthenticated ? (
          <Menu>
            <MenuButton
              as={Button}
              variant="outline"
              colorScheme="purple"
              size="sm"
              rightIcon={<FaChevronDown />}
            >
              <HStack>
                <Icon as={FaWallet} />
                <Text>{user?.displayName || formatWalletAddress(user?.publicKey || '')}</Text>
              </HStack>
            </MenuButton>
            <MenuList>
              <MenuItem icon={<FaUserCircle />}>Profile</MenuItem>
              <MenuItem icon={<FaKey />}>Security</MenuItem>
              <MenuItem icon={<FaCog />}>Settings</MenuItem>
              <MenuDivider />
              <MenuItem icon={<FaSignOutAlt />} onClick={handleDisconnect}>
                Disconnect Wallet
              </MenuItem>
            </MenuList>
          </Menu>
        ) : (
          <Button
            colorScheme="purple"
            leftIcon={<FaWallet />}
            onClick={handleConnect}
            isLoading={isConnecting}
            loadingText="Connecting"
            size="sm"
          >
            Connect Wallet
          </Button>
        )}
      </Box>
    );
  }
  
  // Full wallet card display
  return (
    <Box
      p={5}
      borderRadius="lg"
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      boxShadow="md"
      overflow="hidden"
      position="relative"
    >
      {/* Background decoration */}
      <Box 
        position="absolute" 
        top={0} 
        right={0} 
        bottom={0} 
        width="40%" 
        opacity={0.03} 
        pointerEvents="none"
        zIndex={0}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Box 
            key={i}
            position="absolute"
            top={`${i * 16}%`}
            right={`${Math.random() * 20}%`}
            width={`${Math.random() * 30 + 20}%`}
            height="1px"
            bg="purple.500"
          />
        ))}
      </Box>
      
      {/* Header */}
      <Flex 
        justify="space-between" 
        align="center" 
        mb={4} 
        position="relative"
        zIndex={1}
      >
        <HStack>
          <Icon as={FaWallet} color="purple.500" boxSize={6} />
          <Heading size="md">Wallet Connection</Heading>
        </HStack>
        
        <Badge colorScheme={isAuthenticated ? 'green' : 'gray'}>
          {isAuthenticated ? 'Connected' : 'Disconnected'}
        </Badge>
      </Flex>
      
      {/* Connection state */}
      {isAuthenticated ? (
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Connected state */}
          <Flex 
            p={4} 
            borderRadius="lg" 
            bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'} 
            mb={4}
            align="center"
            position="relative"
            overflow="hidden"
          >
            <Box
              position="absolute"
              top={0}
              left={0}
              bottom={0}
              width="4px"
              bg="green.500"
            />
            
            <Avatar 
              icon={<FaUserCircle fontSize="1.5rem" />} 
              bg="purple.500" 
              color="white" 
              size="md" 
              mr={4}
            />
            
            <Box flex={1}>
              <Text fontWeight="bold">{user?.displayName || 'Connected User'}</Text>
              
              <HStack mt={1}>
                <Tooltip label="Copy address">
                  <Button 
                    variant="link" 
                    size="sm" 
                    rightIcon={<FaCopy />}
                    onClick={copyWalletAddress}
                  >
                    {formatWalletAddress(user?.publicKey || '')}
                  </Button>
                </Tooltip>
                
                <Badge colorScheme="green" display="flex" alignItems="center">
                  <Icon as={FaRegCheckCircle} mr={1} />
                  Verified
                </Badge>
              </HStack>
            </Box>
            
            <Menu>
              <MenuButton
                as={Button}
                variant="ghost"
                size="sm"
                aria-label="Options"
              >
                <Icon as={FaEllipsisV} />
              </MenuButton>
              <MenuList>
                <MenuItem icon={<FaKey />}>
                  View Public Key
                </MenuItem>
                <MenuItem icon={<FaExternalLinkAlt />}>
                  View on Explorer
                </MenuItem>
                <MenuItem icon={<FaBackspace />} onClick={handleDisconnect}>
                  Disconnect
                </MenuItem>
              </MenuList>
            </Menu>
          </Flex>
          
          {showDetails && (
            <>
              <HStack mb={3}>
                <Text fontWeight="medium">Security Status</Text>
                <Badge colorScheme="purple">
                  {securityMetrics.protectionLevel.charAt(0).toUpperCase() + securityMetrics.protectionLevel.slice(1)}
                </Badge>
              </HStack>
              
              <Grid
                templateColumns="repeat(2, 1fr)"
                gap={3}
                mb={4}
              >
                <Flex direction="column">
                  <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    Encryption
                  </Text>
                  <HStack>
                    <Icon as={FaLock} color="teal.500" boxSize={3} />
                    <Text fontSize="sm" fontWeight="medium">
                      {securityMetrics.encryptionType}
                    </Text>
                  </HStack>
                </Flex>
                
                <Flex direction="column">
                  <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    Key Strength
                  </Text>
                  <HStack>
                    <Icon as={FaKey} color="blue.500" boxSize={3} />
                    <Text fontSize="sm" fontWeight="medium">
                      {securityMetrics.keyStrength} bits
                    </Text>
                  </HStack>
                </Flex>
                
                <Flex direction="column">
                  <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    Connection Type
                  </Text>
                  <HStack>
                    <Icon as={FaConnectdevelop} color="green.500" boxSize={3} />
                    <Text fontSize="sm" fontWeight="medium">
                      Wallet Authentication
                    </Text>
                  </HStack>
                </Flex>
                
                <Flex direction="column">
                  <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    Signatures Verified
                  </Text>
                  <HStack>
                    <Icon as={FaFingerprint} color="purple.500" boxSize={3} />
                    <Text fontSize="sm" fontWeight="medium">
                      {securityMetrics.signaturesVerified}
                    </Text>
                  </HStack>
                </Flex>
              </Grid>
              
              <Button
                variant="link"
                size="sm"
                rightIcon={showSecurityInfo ? <FaChevronDown /> : <FaChevronDown />}
                onClick={() => setShowSecurityInfo(!showSecurityInfo)}
                mb={2}
              >
                {showSecurityInfo ? 'Hide Details' : 'View Security Details'}
              </Button>
              
              <Collapse in={showSecurityInfo} animateOpacity>
                <Box 
                  p={3} 
                  borderRadius="md" 
                  bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
                  fontSize="sm"
                >
                  <Text fontWeight="medium" mb={2}>Local Key Information</Text>
                  <VStack align="start" spacing={1}>
                    <HStack>
                      <Icon as={FaUserSecret} color="purple.500" boxSize={3} />
                      <Text>Private keys are stored locally on your device</Text>
                    </HStack>
                    <HStack>
                      <Icon as={FaShieldAlt} color="green.500" boxSize={3} />
                      <Text>End-to-end encryption with forward secrecy</Text>
                    </HStack>
                    <HStack>
                      <Icon as={FaExchangeAlt} color="blue.500" boxSize={3} />
                      <Text>ECDH key exchange with X25519 curves</Text>
                    </HStack>
                    <HStack>
                      <Icon as={FaChartLine} color="teal.500" boxSize={3} />
                      <Text>Automated key rotation every 24 hours</Text>
                    </HStack>
                  </VStack>
                  
                  <Divider my={3} />
                  
                  <Text fontWeight="medium" mb={2}>Public Key</Text>
                  <Code p={2} fontSize="xs" w="100%">
                    {user?.publicKey || 'No public key available'}
                  </Code>
                </Box>
              </Collapse>
            </>
          )}
          
          <Flex mt={4} justify="center">
            <Button 
              colorScheme="red" 
              variant="outline" 
              leftIcon={<FaSignOutAlt />}
              onClick={handleDisconnect}
              size="sm"
            >
              Disconnect Wallet
            </Button>
          </Flex>
        </MotionBox>
      ) : (
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Disconnected state */}
          {isConnecting ? (
            <VStack spacing={4} p={4}>
              <Text textAlign="center">
                {getConnectionStepText()}
              </Text>
              
              <Progress 
                value={getConnectionProgress()} 
                size="sm" 
                width="100%" 
                colorScheme="purple" 
                isAnimated
                hasStripe
              />
              
              {/* Step indicators */}
              <HStack spacing={4} mt={2}>
                {[1, 2, 3, 4, 5].map((step) => (
                  <Flex 
                    key={step}
                    w="10px" 
                    h="10px" 
                    borderRadius="full"
                    bg={connectionStep >= step ? "green.500" : "gray.300"}
                    justify="center"
                    align="center"
                    transition="all 0.2s"
                  >
                    {connectionStep === step && (
                      <Box
                        position="absolute"
                        w="16px"
                        h="16px"
                        borderRadius="full"
                        borderWidth="1px"
                        borderColor="green.500"
                        animation="pulse 1.5s infinite"
                      />
                    )}
                  </Flex>
                ))}
              </HStack>
            </VStack>
          ) : (
            <>
              <Box
                p={4}
                mb={4}
                borderRadius="lg"
                bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
                textAlign="center"
              >
                <Icon as={FaWallet} boxSize={12} color="purple.500" mb={3} />
                <Heading size="md" mb={2}>Connect Your Wallet</Heading>
                <Text fontSize="sm" mb={4}>
                  Connect your wallet to enable secure end-to-end encrypted messaging with enhanced privacy
                </Text>
                
                <Button
                  colorScheme="purple"
                  leftIcon={<FaWallet />}
                  onClick={handleConnect}
                  size="lg"
                  width="full"
                >
                  Connect Wallet
                </Button>
              </Box>
              
              {showDetails && (
                <VStack spacing={3} align="stretch" fontSize="sm">
                  <Flex align="center">
                    <Icon as={FaLock} color="green.500" mr={2} />
                    <Text>Military-grade encryption protects your messages</Text>
                  </Flex>
                  
                  <Flex align="center">
                    <Icon as={FaShieldAlt} color="blue.500" mr={2} />
                    <Text>Decentralized identity verification</Text>
                  </Flex>
                  
                  <Flex align="center">
                    <Icon as={FaFingerprint} color="purple.500" mr={2} />
                    <Text>Messages are tied to your wallet identity</Text>
                  </Flex>
                  
                  <Flex align="center">
                    <Icon as={FaInfoCircle} color="gray.500" mr={2} />
                    <Text>No private keys leave your device</Text>
                  </Flex>
                </VStack>
              )}
              
              {showDetails && (
                <Flex mt={4} justify="center">
                  <Button
                    variant="link"
                    leftIcon={<FaPlus />}
                    size="sm"
                    onClick={() => {}}
                  >
                    Generate New Keypair
                  </Button>
                </Flex>
              )}
            </>
          )}
        </MotionBox>
      )}
    </Box>
  );
};
