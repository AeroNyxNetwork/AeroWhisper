// src/components/modals/EnhancedCreateChatModal.tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  FormHelperText,
  Input,
  Switch,
  VStack,
  Text,
  useColorMode,
  useToast,
  Box,
  Flex,
  Divider,
  Select,
  Collapse,
  Icon,
  HStack,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Badge,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Tooltip,
  InputGroup,
  InputRightElement,
  Progress,
  RadioGroup,
  Radio,
  Stack,
  Code,
  Tag,
  TagLabel,
  TagLeftIcon,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { 
  FaChevronDown, 
  FaChevronUp, 
  FaLock, 
  FaShieldAlt, 
  FaUserSecret, 
  FaKey, 
  FaClock, 
  FaGlobe, 
  FaUsers, 
  FaEye, 
  FaEyeSlash, 
  FaBolt, 
  FaDice, 
  FaFingerprint, 
  FaPuzzlePiece, 
  FaRandom, 
  FaServer, 
  FaNetworkWired, 
  FaExchangeAlt, 
  FaProjectDiagram, 
  FaCheckCircle, 
  FaQuestionCircle, 
  FaCubes, 
  FaEthereum, 
  FaBitcoin, 
  FaLightbulb, 
  FaWallet,
  FaChartLine,
  FaLink,
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { createChatRoom } from '../../lib/chatService';
import { generateSessionId } from '../../utils/cryptoUtils';

interface EnhancedCreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Motion components for animations
const MotionBox = motion(Box);

// Simulate gas price calculations (blockchain inspiration)
const calculateGasEstimate = (complexity: number) => {
  // Base cost
  const baseCost = 0.001;
  // Gas price (varies by network load)
  const gasPrice = Math.random() * 50 + 50; // 50-100 GWEI
  
  // Calculate total
  return (baseCost * complexity * gasPrice).toFixed(4);
};

export const EnhancedCreateChatModal: React.FC<EnhancedCreateChatModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const { colorMode } = useColorMode();
  const toast = useToast();
  
  // Basic chat settings
  const [chatName, setChatName] = useState('');
  const [isEphemeral, setIsEphemeral] = useState(true);
  const [useP2P, setUseP2P] = useState(true);
  const [loading, setLoading] = useState(false);
  const [randomNameLoading, setRandomNameLoading] = useState(false);
  
  // Advanced settings
  const [encryptionType, setEncryptionType] = useState<'standard' | 'high' | 'maximum'>('high');
  const [messageRetention, setMessageRetention] = useState('7'); // days, 0 = forever
  const [joinPermission, setJoinPermission] = useState<'open' | 'invite-only' | 'token-gated'>('open');
  const [keyRotationEnabled, setKeyRotationEnabled] = useState(true);
  const [keyRotationInterval, setKeyRotationInterval] = useState(24); // hours
  const [customTokenGate, setCustomTokenGate] = useState('');
  const [shardingEnabled, setShardingEnabled] = useState(false);
  const [forwardSecrecy, setForwardSecrecy] = useState(true);
  const [metadataPrivacy, setMetadataPrivacy] = useState<'standard' | 'enhanced' | 'maximum'>('enhanced');
  const [consensusModel, setConsensusModel] = useState<'default' | 'threshold' | 'multisig'>('default');
  
  // Web3/Blockchain inspired settings
  const [channelType, setChannelType] = useState<'main' | 'shard' | 'private'>('main');
  const [verificationLevel, setVerificationLevel] = useState<'basic' | 'enhanced' | 'maximum'>('enhanced');
  const [backupToIPFS, setBackupToIPFS] = useState(false);
  const [delegatedVerification, setDelegatedVerification] = useState(false);
  const [gasLevel, setGasLevel] = useState<'economy' | 'standard' | 'priority'>('standard');
  
  // UI states
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showEncryptionDetails, setShowEncryptionDetails] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [createProgress, setCreateProgress] = useState(0);
  const [generatingRoom, setGeneratingRoom] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  
  // References
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const { isOpen: isAlertOpen, onOpen: onOpenAlert, onClose: onCloseAlert } = useDisclosure();
  
  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setChatName('');
        setIsEphemeral(true);
        setUseP2P(true);
        setEncryptionType('high');
        setMessageRetention('7');
        setShowAdvancedOptions(false);
        setCurrentStep(0);
        setCreateProgress(0);
        setGeneratingRoom(false);
        setRoomId('');
        setActiveTab(0);
      }, 300);
    }
  }, [isOpen]);
  
  // Simulate gas price based on settings complexity
  const getComplexityScore = () => {
    let score = 1;
    
    // Each feature adds to complexity
    if (isEphemeral) score += 0.2;
    if (useP2P) score += 0.5;
    if (encryptionType === 'high') score += 0.5;
    if (encryptionType === 'maximum') score += 1;
    if (keyRotationEnabled) score += 0.3;
    if (shardingEnabled) score += 0.7;
    if (forwardSecrecy) score += 0.2;
    if (metadataPrivacy === 'enhanced') score += 0.3;
    if (metadataPrivacy === 'maximum') score += 0.7;
    if (consensusModel === 'threshold') score += 0.5;
    if (consensusModel === 'multisig') score += 0.8;
    if (channelType === 'shard') score += 0.5;
    if (channelType === 'private') score += 0.3;
    if (verificationLevel === 'enhanced') score += 0.3;
    if (verificationLevel === 'maximum') score += 0.7;
    if (backupToIPFS) score += 0.4;
    if (delegatedVerification) score += 0.3;
    
    // Gas level modifier
    if (gasLevel === 'economy') score *= 0.8;
    if (gasLevel === 'priority') score *= 1.5;
    
    return score;
  };
  
  // Get gas estimate
  const gasEstimate = calculateGasEstimate(getComplexityScore());
  
  // Generate a random cryptographically inspired name
  const generateRandomName = () => {
    setRandomNameLoading(true);
    
    // Crypto-inspired prefixes and suffixes
    const prefixes = ['Cipher', 'Crypt', 'Secure', 'Quantum', 'Zero', 'Onion', 'Ghost', 'Phantom', 'Shadow', 'Vault'];
    const middleParts = ['Node', 'Chain', 'Block', 'Net', 'Cast', 'Mesh', 'Key', 'Link', 'Pulse', 'Hash'];
    const suffixes = ['Room', 'Hub', 'Space', 'Portal', 'Nexus', 'Channel', 'Shard', 'Frame', 'Sphere', 'Zone'];
    
    // Random selection
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const middlePart = middleParts[Math.floor(Math.random() * middleParts.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    
    // Random number (sometimes)
    const addNumber = Math.random() > 0.5;
    const randomNum = addNumber ? Math.floor(Math.random() * 1000) : '';
    
    // Combine parts
    const randomName = `${prefix}${middlePart}${suffix}${randomNum}`;
    
    // Simulate server delay
    setTimeout(() => {
      setChatName(randomName);
      setRandomNameLoading(false);
    }, 600);
  };
  
  // Simulate step progress during room creation
  const simulateRoomCreation = async () => {
    setGeneratingRoom(true);
    setCreateProgress(0);
    
    // Step 1: Generate encryption keys
    setCreateProgress(10);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 2: Setting up secure channel
    setCreateProgress(30);
    await new Promise(resolve => setTimeout(resolve, 700));
    
    // Step 3: Configure privacy settings
    setCreateProgress(50);
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Step 4: Register with network
    setCreateProgress(75);
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Step 5: Complete setup
    setCreateProgress(90);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setCreateProgress(100);
  };
  
  // Generate session ID with blockchain-inspired format
  const generateEnhancedSessionId = () => {
    const randomHex = () => Math.floor(Math.random() * 16).toString(16);
    const timestamp = Date.now().toString(16);
    const randomPart = Array.from({length: 16}, randomHex).join('');
    
    return `arx-${timestamp.slice(-8)}-${randomPart.slice(0, 12)}`;
  };
  
  // Handle create chat 
  const handleCreateChat = async () => {
    if (!chatName.trim()) {
      toast({
        title: 'Chat name required',
        description: 'Please enter a name for your secure chat room',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setLoading(true);
    
    try {
      // Simulate the creation process with progress indicator
      await simulateRoomCreation();
      
      // Generate IDs
      const sessionId = generateEnhancedSessionId();
      setRoomId(sessionId);
      
      // Create the room with all the settings
      const room = await createChatRoom({
        name: chatName,
        isEphemeral,
        useP2P,
        encryptionType,
        messageRetention: parseInt(messageRetention),
        createdAt: new Date().toISOString(),
        // Add additional settings for enhanced chat room
        channelType,
        verificationLevel,
        backupToIPFS,
        metadataPrivacy,
        shardingEnabled,
        keyRotationInterval,
        forwardSecrecy,
      });

      toast({
        title: 'Secure chat room created',
        description: 'Your end-to-end encrypted room is ready',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onClose();
      router.push(`/chat/${room.id}`);
    } catch (error) {
      console.error('Failed to create chat room:', error);
      setGeneratingRoom(false);
      
      toast({
        title: 'Failed to create chat room',
        description: 'An error occurred while creating your secure room. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to get encryption description
  const getEncryptionDescription = () => {
    switch (encryptionType) {
      case 'standard':
        return 'AES-256-GCM encryption (industry standard)';
      case 'high':
        return 'ChaCha20-Poly1305 cipher suite for enhanced security';
      case 'maximum':
        return 'Dual-layer encryption with forward secrecy protection';
    }
  };
  
  // Get gas level description
  const getGasLevelDescription = () => {
    switch (gasLevel) {
      case 'economy':
        return 'Slower processing, lower resource cost';
      case 'standard':
        return 'Balanced performance and resource cost';
      case 'priority':
        return 'Fastest processing, higher resource cost';
    }
  };
  
  // Next/previous step handlers
  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 2));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));
  
  // Motion animation variants
  const pageVariants = {
    hidden: { opacity: 0, x: 100 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -100 }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" motionPreset="slideInBottom">
      <ModalOverlay backdropFilter="blur(5px)" />
      <ModalContent 
        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
        borderRadius="xl"
        boxShadow="xl"
        overflow="hidden"
        maxW="800px"
      >
        {generatingRoom ? (
          /* Room Creation Progress Screen */
          <Box p={8}>
            <VStack spacing={8} align="center">
              <Heading size="lg" textAlign="center">Creating Secure Chat Room</Heading>
              
              <Progress 
                value={createProgress} 
                size="sm" 
                width="100%" 
                colorScheme="purple" 
                borderRadius="full"
                hasStripe
                isAnimated
              />
              
              <Text textAlign="center">
                {createProgress < 20 && "Generating encryption keys..."}
                {createProgress >= 20 && createProgress < 40 && "Setting up secure channel..."}
                {createProgress >= 40 && createProgress < 60 && "Configuring privacy settings..."}
                {createProgress >= 60 && createProgress < 80 && "Registering with network..."}
                {createProgress >= 80 && createProgress < 100 && "Finalizing secure parameters..."}
                {createProgress === 100 && "Room created successfully!"}
              </Text>
              
              {createProgress === 100 && (
                <Button
                  colorScheme="purple"
                  size="lg"
                  width="200px"
                  mt={4}
                  onClick={() => {
                    onClose();
                    if (roomId) {
                      router.push(`/chat/${roomId}`);
                    }
                  }}
                >
                  Enter Room
                </Button>
              )}
              
              <HStack mt={4} spacing={6}>
                <VStack align="center">
                  <Icon as={FaKey} boxSize={6} color="purple.400" />
                  <Text fontSize="sm">End-to-End Encrypted</Text>
                </VStack>
                
                {useP2P && (
                  <VStack align="center">
                    <Icon as={FaShieldAlt} boxSize={6} color="blue.400" />
                    <Text fontSize="sm">P2P Secured</Text>
                  </VStack>
                )}
                
                {isEphemeral && (
                  <VStack align="center">
                    <Icon as={FaClock} boxSize={6} color="orange.400" />
                    <Text fontSize="sm">Ephemeral</Text>
                  </VStack>
                )}
                
                <VStack align="center">
                  <Icon as={FaFingerprint} boxSize={6} color="green.400" />
                  <Text fontSize="sm">Privacy Enhanced</Text>
                </VStack>
              </HStack>
            </VStack>
          </Box>
        ) : (
          <>
            <ModalHeader>
              <Flex align="center">
                <Icon as={FaKey} mr={2} color="purple.400" />
                Create Secure Chat Room
              </Flex>
            </ModalHeader>
            <ModalCloseButton />
            
            <ModalBody pb={6}>
              <Tabs 
                index={activeTab} 
                onChange={(index) => setActiveTab(index)}
                colorScheme="purple"
                variant="soft-rounded"
                mb={6}
              >
                <TabList>
                  <Tab>Basic</Tab>
                  <Tab>Security</Tab>
                  <Tab>Advanced</Tab>
                </TabList>
                
                <TabPanels mt={4}>
                  {/* Basic Settings Tab */}
                  <TabPanel px={0}>
                    <VStack spacing={6} align="stretch">
                      <FormControl id="chat-name" isRequired>
                        <FormLabel display="flex" alignItems="center">
                          Chat Room Name
                          <Button 
                            size="xs" 
                            ml={2} 
                            leftIcon={<FaDice />}
                            onClick={generateRandomName}
                            isLoading={randomNameLoading}
                            colorScheme="purple"
                            variant="outline"
                          >
                            Random
                          </Button>
                        </FormLabel>
                        <Input 
                          value={chatName}
                          onChange={(e) => setChatName(e.target.value)}
                          placeholder="Enter a name for your secure chat"
                          size="lg"
                        />
                        <FormHelperText>
                          Create a unique name for your encrypted chat room
                        </FormHelperText>
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center" justifyContent="space-between">
                        <Box>
                          <FormLabel htmlFor="ephemeral-chat" mb="0" fontWeight="medium">
                            <Flex align="center">
                              <Icon as={FaClock} mr={2} color="orange.400" />
                              Ephemeral Chat
                            </Flex>
                          </FormLabel>
                          <FormHelperText>
                            Messages disappear after a period of inactivity
                          </FormHelperText>
                        </Box>
                        <Switch 
                          id="ephemeral-chat" 
                          isChecked={isEphemeral} 
                          onChange={() => setIsEphemeral(!isEphemeral)}
                          colorScheme="purple"
                          size="lg"
                        />
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center" justifyContent="space-between">
                        <Box>
                          <FormLabel htmlFor="p2p-connection" mb="0" fontWeight="medium">
                            <Flex align="center">
                              <Icon as={FaShieldAlt} mr={2} color="blue.400" />
                              Direct P2P Connection
                            </Flex>
                          </FormLabel>
                          <FormHelperText>
                            Enable peer-to-peer connection for maximum privacy
                          </FormHelperText>
                        </Box>
                        <Switch 
                          id="p2p-connection" 
                          isChecked={useP2P} 
                          onChange={() => setUseP2P(!useP2P)}
                          colorScheme="purple"
                          size="lg"
                        />
                      </FormControl>
                      
                      <FormControl>
                        <FormLabel display="flex" alignItems="center" fontWeight="medium">
                          <Icon as={FaGlobe} mr={2} color="green.400" />
                          Join Permission
                        </FormLabel>
                        <Select
                          value={joinPermission}
                          onChange={(e) => setJoinPermission(e.target.value as any)}
                        >
                          <option value="open">Open (Anyone with Link)</option>
                          <option value="invite-only">Invite Only</option>
                          <option value="token-gated">Token Gated (Web3)</option>
                        </Select>
                        <FormHelperText>
                          Control who can access this secure chat room
                        </FormHelperText>
                      </FormControl>
                      
                      {joinPermission === 'token-gated' && (
                        <FormControl>
                          <FormLabel>Token Gate Address</FormLabel>
                          <InputGroup>
                            <Input 
                              value={customTokenGate}
                              onChange={(e) => setCustomTokenGate(e.target.value)}
                              placeholder="e.g., 0x123...abc or ENS domain"
                            />
                            <InputRightElement width="4.5rem">
                              <Button h="1.75rem" size="sm" onClick={() => {}}>
                                Verify
                              </Button>
                            </InputRightElement>
                          </InputGroup>
                          <FormHelperText>
                            Only users possessing tokens from this contract can join
                          </FormHelperText>
                        </FormControl>
                      )}
                    </VStack>
                  </TabPanel>
                  
                  {/* Security Settings Tab */}
                  <TabPanel px={0}>
                    <VStack spacing={6} align="stretch">
                      <FormControl>
                        <FormLabel display="flex" alignItems="center" fontWeight="medium">
                          <Icon as={FaLock} mr={2} color="green.400" />
                          Encryption Level
                        </FormLabel>
                        <Select
                          value={encryptionType}
                          onChange={(e) => setEncryptionType(e.target.value as any)}
                        >
                          <option value="standard">Standard (AES-256-GCM)</option>
                          <option value="high">High (ChaCha20-Poly1305)</option>
                          <option value="maximum">Maximum (Dual Encryption + Forward Secrecy)</option>
                        </Select>
                        <Flex justify="space-between" align="center" mt={1}>
                          <FormHelperText>
                            {getEncryptionDescription()}
                          </FormHelperText>
                          <Button 
                            size="xs" 
                            onClick={() => setShowEncryptionDetails(!showEncryptionDetails)}
                            variant="link"
                            colorScheme="purple"
                          >
                            Details
                          </Button>
                        </Flex>
                      </FormControl>
                      
                      <Collapse in={showEncryptionDetails} animateOpacity>
                        <Box
                          p={4}
                          mt={2}
                          mb={4}
                          bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
                          borderRadius="md"
                          fontSize="sm"
                        >
                          <Text fontWeight="medium" mb={2}>Encryption Specifications:</Text>
                          <VStack align="start" spacing={2}>
                            <Text>• <strong>Standard:</strong> AES-256 in GCM mode with 256-bit keys (NIST approved)</Text>
                            <Text>• <strong>High:</strong> ChaCha20-Poly1305 AEAD with 256-bit keys and 96-bit nonces</Text>
                            <Text>• <strong>Maximum:</strong> Dual encryption layers (AES + ChaCha20) with X25519 key exchange</Text>
                          </VStack>
                        </Box>
                      </Collapse>
                      
                      <FormControl display="flex" alignItems="center" justifyContent="space-between">
                        <Box>
                          <FormLabel htmlFor="key-rotation" mb="0" fontWeight="medium">
                            <Flex align="center">
                              <Icon as={FaExchangeAlt} mr={2} color="blue.400" />
                              Key Rotation
                            </Flex>
                          </FormLabel>
                          <FormHelperText>
                            Automatically change encryption keys periodically
                          </FormHelperText>
                        </Box>
                        <Switch 
                          id="key-rotation" 
                          isChecked={keyRotationEnabled} 
                          onChange={() => setKeyRotationEnabled(!keyRotationEnabled)}
                          colorScheme="purple"
                          size="lg"
                        />
                      </FormControl>
                      
                      {keyRotationEnabled && (
                        <FormControl>
                          <FormLabel display="flex" alignItems="center">
                            Key Rotation Interval
                            <Badge ml={2} colorScheme="purple">{keyRotationInterval} hours</Badge>
                          </FormLabel>
                          <Slider
                            min={1}
                            max={72}
                            step={1}
                            value={keyRotationInterval}
                            onChange={(val) => setKeyRotationInterval(val)}
                            colorScheme="purple"
                          >
                            <SliderTrack>
                              <SliderFilledTrack />
                            </SliderTrack>
                            <SliderThumb boxSize={6}>
                              <Box color="purple.500" as={FaKey} />
                            </SliderThumb>
                          </Slider>
                          <FormHelperText>
                            Shorter intervals provide stronger security but require more resources
                          </FormHelperText>
                        </FormControl>
                      )}
                      
                      <FormControl>
                        <FormLabel display="flex" alignItems="center" fontWeight="medium">
                          <Icon as={FaEyeSlash} mr={2} color="purple.400" />
                          Metadata Privacy
                        </FormLabel>
                        <Select
                          value={metadataPrivacy}
                          onChange={(e) => setMetadataPrivacy(e.target.value as any)}
                        >
                          <option value="standard">Standard</option>
                          <option value="enhanced">Enhanced</option>
                          <option value="maximum">Maximum</option>
                        </Select>
                        <FormHelperText>
                          Controls how much metadata about your messages is visible to the network
                        </FormHelperText>
                      </FormControl>
                      
                      <FormControl>
                        <FormLabel display="flex" alignItems="center" fontWeight="medium">
                          <Icon as={FaClock} mr={2} color="orange.400" />
                          Message Retention
                          <Badge ml={2} colorScheme="purple">
                            {messageRetention === '0' ? 'Forever' : `${messageRetention} days`}
                          </Badge>
                        </FormLabel>
                        <RadioGroup 
                          value={messageRetention}
                          onChange={setMessageRetention}
                        >
                          <Stack direction="row" spacing={5}>
                            <Radio value="1">1 day</Radio>
                            <Radio value="7">7 days</Radio>
                            <Radio value="30">30 days</Radio>
                            <Radio value="0">Forever</Radio>
                          </Stack>
                        </RadioGroup>
                        <FormHelperText>
                          How long messages will be stored in the chat history
                        </FormHelperText>
                      </FormControl>
                    </VStack>
                  </TabPanel>
                  
                  {/* Advanced Settings Tab */}
                  <TabPanel px={0}>
                    <VStack spacing={6} align="stretch">
                      <FormControl>
                        <FormLabel display="flex" alignItems="center" fontWeight="medium">
                          <Icon as={FaProjectDiagram} mr={2} color="blue.400" />
                          Channel Type
                        </FormLabel>
                        <Select
                          value={channelType}
                          onChange={(e) => setChannelType(e.target.value as any)}
                        >
                          <option value="main">Main Channel (Standard)</option>
                          <option value="shard">Sharded Channel (High Privacy)</option>
                          <option value="private">Private Circuit (Maximum Privacy)</option>
                        </Select>
                        <FormHelperText>
                          Determines how messages are routed through the network
                        </FormHelperText>
                      </FormControl>
                      
                      <FormControl>
                        <FormLabel display="flex" alignItems="center" fontWeight="medium">
                          <Icon as={FaUserSecret} mr={2} color="green.400" />
                          Verification Level
                        </FormLabel>
                        <Select
                          value={verificationLevel}
                          onChange={(e) => setVerificationLevel(e.target.value as any)}
                        >
                          <option value="basic">Basic Verification</option>
                          <option value="enhanced">Enhanced Verification</option>
                          <option value="maximum">Maximum Verification</option>
                        </Select>
                        <FormHelperText>
                          Controls how strictly participant identities are verified
                        </FormHelperText>
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center" justifyContent="space-between">
                        <Box>
                          <FormLabel htmlFor="forward-secrecy" mb="0" fontWeight="medium">
                            <Flex align="center">
                              <Icon as={FaFingerprint} mr={2} color="teal.400" />
                              Forward Secrecy
                            </Flex>
                          </FormLabel>
                          <FormHelperText>
                            Protects past messages if keys are compromised
                          </FormHelperText>
                        </Box>
                        <Switch 
                          id="forward-secrecy" 
                          isChecked={forwardSecrecy} 
                          onChange={() => setForwardSecrecy(!forwardSecrecy)}
                          colorScheme="purple"
                          size="lg"
                        />
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center" justifyContent="space-between">
                        <Box>
                          <FormLabel htmlFor="message-sharding" mb="0" fontWeight="medium">
                            <Flex align="center">
                              <Icon as={FaPuzzlePiece} mr={2} color="cyan.400" />
                              Message Sharding
                            </Flex>
                          </FormLabel>
                          <FormHelperText>
                            Split messages across multiple encrypted fragments
                          </FormHelperText>
                        </Box>
                        <Switch 
                          id="message-sharding" 
                          isChecked={shardingEnabled} 
                          onChange={() => setShardingEnabled(!shardingEnabled)}
                          colorScheme="purple"
                          size="lg"
                        />
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center" justifyContent="space-between">
                        <Box>
                          <FormLabel htmlFor="ipfs-backup" mb="0" fontWeight="medium">
                            <Flex align="center">
                              <Icon as={FaCubes} mr={2} color="blue.400" />
                              Encrypted IPFS Backup
                            </Flex>
                          </FormLabel>
                          <FormHelperText>
                            Store encrypted message backups on decentralized storage
                          </FormHelperText>
                        </Box>
                        <Switch 
                          id="ipfs-backup" 
                          isChecked={backupToIPFS} 
                          onChange={() => setBackupToIPFS(!backupToIPFS)}
                          colorScheme="purple"
                          size="lg"
                        />
                      </FormControl>
                      
                      <Box
                        p={4}
                        borderRadius="md"
                        borderWidth="1px"
                        borderColor={colorMode === 'dark' ? 'purple.500' : 'purple.200'}
                        bg={colorMode === 'dark' ? 'gray.700' : 'purple.50'}
                      >
                        <FormLabel fontWeight="medium" mb={3}>
                          <Flex align="center">
                            <Icon as={FaChartLine} mr={2} color="purple.400" />
                            Resource Allocation (Gas)
                          </Flex>
                        </FormLabel>
                        
                        <RadioGroup 
                          value={gasLevel}
                          onChange={(value) => setGasLevel(value as any)}
                        >
                          <Stack spacing={3}>
                            <Radio value="economy">
                              <Flex align="center">
                                <Text fontWeight="medium">Economy</Text>
                                <Badge ml={2} colorScheme="yellow">0.8x</Badge>
                                <Text ml={2} fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
                                  Slower processing, lower resource usage
                                </Text>
                              </Flex>
                            </Radio>
                            
                            <Radio value="standard">
                              <Flex align="center">
                                <Text fontWeight="medium">Standard</Text>
                                <Badge ml={2} colorScheme="blue">1.0x</Badge>
                                <Text ml={2} fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
                                  Balanced performance
                                </Text>
                              </Flex>
                            </Radio>
                            
                            <Radio value="priority">
                              <Flex align="center">
                                <Text fontWeight="medium">Priority</Text>
                                <Badge ml={2} colorScheme="purple">1.5x</Badge>
                                <Text ml={2} fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
                                  Faster processing, higher resource usage
                                </Text>
                              </Flex>
                            </Radio>
                          </Stack>
                        </RadioGroup>
                        
                        <Flex justify="space-between" align="center" mt={3}>
                          <Text fontSize="sm">Estimated resource cost:</Text>
                          <Badge colorScheme="purple" p={1}>
                            <Flex align="center">
                              <Icon as={FaBolt} mr={1} />
                              {gasEstimate} GWEI
                            </Flex>
                          </Badge>
                        </Flex>
                      </Box>
                    </VStack>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </ModalBody>

            <ModalFooter 
              borderTopWidth="1px" 
              borderTopColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
              p={4}
            >
              <HStack spacing={3}>
                <Button 
                  variant="outline" 
                  onClick={onClose}
                  isDisabled={loading}
                >
                  Cancel
                </Button>
                
                <Button 
                  leftIcon={<Icon as={FaRocket} />}
                  colorScheme="purple" 
                  onClick={handleCreateChat}
                  isLoading={loading}
                  loadingText="Creating Secure Room"
                >
                  Create Secure Room
                </Button>
              </HStack>
            </ModalFooter>
          </>
        )}
      </ModalContent>
      
      {/* Confirmation alert when leaving with unsaved changes */}
      <AlertDialog
        isOpen={isAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={onCloseAlert}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Discard Changes
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to leave? All your secure room configuration will be lost.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onCloseAlert}>
                Stay
              </Button>
              <Button colorScheme="red" onClick={onClose} ml={3}>
                Discard
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Modal>
  );
};
