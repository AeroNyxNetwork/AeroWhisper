// src/components/chat/MessageComposer.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  Flex,
  Textarea,
  IconButton,
  useColorMode,
  Tooltip,
  HStack,
  VStack,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Text,
  Icon,
  useDisclosure,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverFooter,
  Button,
  PopoverArrow,
  Badge,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Select,
  Switch,
  FormControl,
  FormLabel,
  Kbd,
  Tag,
  TagLabel,
  TagLeftIcon,
  TagCloseButton,
  Input,
  InputGroup,
  InputRightElement,
} from '@chakra-ui/react';
import {
  FaPaperPlane,
  FaSmile,
  FaPaperclip,
  FaCamera,
  FaImage,
  FaVideo,
  FaFile,
  FaLock,
  FaKeyboard,
  FaEllipsisH,
  FaMicrophone,
  FaKey,
  FaEthereum,
  FaShieldAlt,
  FaCog,
  FaGasPump,
  FaCoins,
  FaBolt,
  FaRocket,
  FaFire,
  FaClock,
  FaGem,
  FaDollarSign,
  FaCertificate,
  FaUserShield,
  FaChartLine,
  FaTools,
  FaUser,
} from 'react-icons/fa';
import { FileTransfer } from './FileTransfer';
import { AnimatePresence, motion } from 'framer-motion';

// Encryption settings and types
type EncryptionType = 'standard' | 'high' | 'maximum';
type GasLevel = 'low' | 'medium' | 'high';

interface MessageComposerProps {
  onSendMessage: (text: string) => Promise<boolean>;
  isEncrypted?: boolean;
  encryptionType?: EncryptionType;
  isP2P?: boolean;
  isDisabled?: boolean;
  placeholder?: string;
  chatId?: string;
}

const MotionBox = motion(Box);
const [isMobile] = useMediaQuery("(max-width: 768px)");

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  isEncrypted = true,
  encryptionType = 'standard',
  isP2P = false,
  isDisabled = false,
  placeholder = 'Type a secure message...',
  chatId,
}) => {
  const { colorMode } = useColorMode();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Web3 inspired features
  const [gasLevel, setGasLevel] = useState<GasLevel>('medium');
  const [tokenizedWords, setTokenizedWords] = useState<string[]>([]);
  const [showNFTSelector, setShowNFTSelector] = useState(false);
  const [verifiedProfile, setVerifiedProfile] = useState(false);
  const [signatureType, setSignatureType] = useState<'personal' | 'verifiable'>('personal');
  
  // File transfer modal
  const { isOpen: isFileTransferOpen, onOpen: onFileTransferOpen, onClose: onFileTransferClose } = useDisclosure();
  
  // Encryption settings
  const { isOpen: isEncryptionOpen, onOpen: onEncryptionOpen, onClose: onEncryptionClose } = useDisclosure();
  
  // Gas settings (blockchain-inspired)
  const { isOpen: isGasSettingsOpen, onOpen: onGasSettingsOpen, onClose: onGasSettingsClose } = useDisclosure();
  
  // Handle recording
  const startRecording = useCallback(() => {
    setIsRecording(true);
    setRecordingTime(0);
    
    recordingInterval.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  }, []);
  
  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
      recordingInterval.current = null;
    }
    
    // Here you would normally process the recording
    // For demo purposes, we'll just add a placeholder message
    setMessage(prev => prev + " [Voice message: " + formatRecordingTime(recordingTime) + "]");
  }, [recordingTime]);
  
  // Format recording time as mm:ss
  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Format gas price (blockchain-inspired)
  const getGasPrice = (level: GasLevel): number => {
    switch (level) {
      case 'low': return 0.5;
      case 'medium': return 1;
      case 'high': return 2;
    }
  };
  
  // Get gas estimate (blockchain-inspired)
  const getGasEstimate = (): string => {
    // Base cost per character
    const baseCost = 0.001;
    // Additional cost for encryption level
    const encryptionMultiplier = 
      encryptionType === 'standard' ? 1 :
      encryptionType === 'high' ? 1.5 :
      2; // maximum
    
    // P2P discount
    const p2pDiscount = isP2P ? 0.7 : 1;
    
    // Gas level multiplier
    const gasMultiplier = getGasPrice(gasLevel);
    
    // Calculate total (characters × base cost × multipliers)
    const characters = message.length || 1;
    const total = characters * baseCost * encryptionMultiplier * p2pDiscount * gasMultiplier;
    
    return total.toFixed(4);
  };
  
  // Cleanup recording interval on unmount
  useEffect(() => {
    return () => {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    };
  }, []);
  
  // Handle sending message
  const sendMessage = useCallback(async () => {
    if (!message.trim() || isDisabled || isLoading) return;
    
    setIsLoading(true);
    
    try {
      const success = await onSendMessage(message);
      
      if (success) {
        setMessage('');
        setTokenizedWords([]);
        
        // Focus back on textarea
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 0);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  }, [message, isDisabled, isLoading, onSendMessage]);
  
  // Handle keyboard shortcuts (Ctrl/Cmd + Enter to send)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Check for Ctrl/Cmd + Enter
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
    
    // Check for tokenizing words with '@' symbol
    if (e.key === '@' && !isDisabled) {
      // In a real app, this would trigger a username selection UI
      // For demo purposes, we'll add a sample tokenized word
      const tokenText = 'satoshi';
      setTokenizedWords([...tokenizedWords, tokenText]);
      e.preventDefault();
      setMessage(prev => prev + `@${tokenText} `);
    }
  }, [sendMessage, isDisabled, tokenizedWords]);
  
  // Handle file upload
  const handleFileSelect = useCallback(async (file: File, encryptFile: boolean) => {
    // In a real implementation, this would upload and send the file
    console.log('File selected:', file, 'Encrypt:', encryptFile);
    
    // For now, just mention the file in a message
    const fileSize = (file.size / 1024).toFixed(1);
    const fileMessage = `[Encrypted File: ${file.name} (${fileSize} KB)]`;
    setMessage(prev => prev ? `${prev} ${fileMessage}` : fileMessage);
    
    onFileTransferClose();
  }, [onFileTransferClose]);
  
  // Auto-resize textarea based on content
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };
  
  // Get encryption color based on type
  const getEncryptionColor = () => {
    switch (encryptionType) {
      case 'maximum': return 'green';
      case 'high': return 'teal';
      case 'standard':
      default: return 'blue';
    }
  };
  
  // Format gas level for display
  const formatGasLevel = (level: GasLevel) => {
    switch (level) {
      case 'low': return { text: 'Low Priority', icon: FaClock, color: 'orange' };
      case 'medium': return { text: 'Medium Priority', icon: FaRocket, color: 'blue' };
      case 'high': return { text: 'High Priority', icon: FaFire, color: 'red' };
    }
  };
  
  const gasInfo = formatGasLevel(gasLevel);
  
  // Get animation variants for the composer box
  const composerVariants = {
    disabled: { opacity: 0.7, y: 5 },
    enabled: { opacity: 1, y: 0 }
  };
  
  return (
    <>
      <MotionBox 
        p={3} 
        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
        borderTop="1px solid"
        borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
        initial={isDisabled ? "disabled" : "enabled"}
        animate={isDisabled ? "disabled" : "enabled"}
        variants={composerVariants}
        transition={{ duration: 0.3 }}
      >
        {/* Transaction fee (gas) indicator */}
        <Flex 
          justify="space-between" 
          align="center" 
          mb={2}
          px={2}
          py={1}
          borderRadius="md"
          bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
        >
          <HStack>
            <Tooltip 
              label={`${isP2P ? 'Peer-to-peer' : ''} ${isEncrypted ? `${encryptionType} encryption` : 'No encryption'}`} 
              placement="top"
            >
              <Badge
                colorScheme={getEncryptionColor()}
                display="flex"
                alignItems="center"
                px={2}
                py={1}
                borderRadius="full"
                cursor="pointer"
                onClick={onEncryptionOpen}
              >
                <Icon as={FaLock} mr={1} boxSize="10px" />
                <Text fontSize="xs">
                  {isEncrypted 
                    ? encryptionType.charAt(0).toUpperCase() + encryptionType.slice(1) 
                    : 'Not Encrypted'}
                </Text>
              </Badge>
            </Tooltip>
            
            {isP2P && (
              <Badge
                colorScheme="purple"
                display="flex"
                alignItems="center"
                px={2}
                py={1}
                borderRadius="full"
              >
                <Icon as={FaShieldAlt} mr={1} boxSize="10px" />
                <Text fontSize="xs">P2P</Text>
              </Badge>
            )}
            
            <Badge
              colorScheme={gasInfo.color}
              display="flex"
              alignItems="center"
              px={2}
              py={1}
              borderRadius="full"
              cursor="pointer"
              onClick={onGasSettingsOpen}
            >
              <Icon as={gasInfo.icon} mr={1} boxSize="10px" />
              <Text fontSize="xs">{gasInfo.text}</Text>
            </Badge>
          </HStack>
          
          <Tooltip label="Estimated gas fee" placement="top">
            <Badge variant="outline" colorScheme="purple">
              <Flex align="center">
                <Icon as={FaGasPump} mr={1} boxSize="10px" />
                <Text fontSize="xs">{getGasEstimate()} GWEI</Text>
              </Flex>
            </Badge>
          </Tooltip>
        </Flex>
        
        {/* Tokenized words list */}
        {tokenizedWords.length > 0 && (
          <Box mb={2}>
            <HStack spacing={2} flexWrap="wrap">
              {tokenizedWords.map((word, index) => (
                <Tag
                  key={index}
                  size="sm"
                  borderRadius="full"
                  variant="subtle"
                  colorScheme="purple"
                >
                  <TagLeftIcon boxSize="10px" as={FaUser} />
                  <TagLabel>@{word}</TagLabel>
                  <TagCloseButton
                    onClick={() => {
                      const newTokens = [...tokenizedWords];
                      newTokens.splice(index, 1);
                      setTokenizedWords(newTokens);
                      // In a real app, you'd also remove it from the message text
                    }} 
                  />
                </Tag>
              ))}
            </HStack>
          </Box>
        )}
        
        {/* Voice recording indicator */}
        <AnimatePresence>
          {isRecording && (
            <MotionBox
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              mb={2}
            >
              <Flex 
                align="center" 
                justify="space-between"
                p={2}
                borderRadius="md"
                bg={colorMode === 'dark' ? 'red.900' : 'red.100'}
              >
                <Flex align="center">
                  <Box 
                    w="10px" 
                    h="10px" 
                    borderRadius="full" 
                    bg="red.500" 
                    mr={2}
                    animation="pulse 1.5s infinite"
                    sx={{
                      '@keyframes pulse': {
                        '0%': { boxShadow: '0 0 0 0 rgba(229, 62, 62, 0.7)' },
                        '70%': { boxShadow: '0 0 0 10px rgba(229, 62, 62, 0)' },
                        '100%': { boxShadow: '0 0 0 0 rgba(229, 62, 62, 0)' },
                      },
                    }}
                  />
                  <Text fontWeight="medium" color={colorMode === 'dark' ? 'white' : 'red.800'}>
                    Recording: {formatRecordingTime(recordingTime)}
                  </Text>
                </Flex>
                <Button size="xs" onClick={stopRecording} colorScheme="red">Stop</Button>
              </Flex>
            </MotionBox>
          )}
        </AnimatePresence>
        
        {/* Composer area */}
        <Flex>
          <Box 
            flex="1" 
            mr={2} 
            borderRadius="md" 
            bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
            overflow="hidden"
            borderWidth="1px"
            borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.300'}
            _hover={{
              borderColor: colorMode === 'dark' ? 'purple.400' : 'purple.500',
            }}
            transition="all 0.2s"
          >
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={isDisabled ? "Waiting for secure connection..." : placeholder}
              border="none"
              _focus={{ border: 'none', boxShadow: 'none' }}
              minH="40px"
              maxH="150px"
              resize="none"
              py={2}
              px={3}
              disabled={isDisabled || isRecording}
            />
            
            {/* Attachment and emoji toolbar */}
            <Flex 
              p={1} 
              borderTop="1px solid" 
              borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
              bg={colorMode === 'dark' ? 'gray.800' : 'gray.100'}
            >
              <HStack spacing={1}>
                <Tooltip label="Add emoji" placement="top">
                  <IconButton
                    aria-label="Add emoji"
                    icon={<FaSmile />}
                    size="sm"
                    variant="ghost"
                    isDisabled={isDisabled || isRecording}
                  />
                </Tooltip>
                
                <Menu>
                  <MenuButton
                    as={IconButton}
                    aria-label="Attach file"
                    icon={<FaPaperclip />}
                    size="sm"
                    variant="ghost"
                    isDisabled={isDisabled || isRecording}
                  />
                  <MenuList>
                    <MenuItem icon={<FaImage />} onClick={onFileTransferOpen}>
                      Image
                    </MenuItem>
                    <MenuItem icon={<FaVideo />} onClick={onFileTransferOpen}>
                      Video
                    </MenuItem>
                    <MenuItem icon={<FaFile />} onClick={onFileTransferOpen}>
                      Document
                    </MenuItem>
                    <MenuItem icon={<FaCamera />}>
                      Camera
                    </MenuItem>
                    <MenuItem icon={<FaGem />} onClick={() => setShowNFTSelector(!showNFTSelector)}>
                      NFT
                    </MenuItem>
                  </MenuList>
                </Menu>
                
                <Tooltip label={isRecording ? "Stop recording" : "Record voice message"} placement="top">
                  <IconButton
                    aria-label="Record voice message"
                    icon={isRecording ? <FaFire /> : <FaMicrophone />}
                    size="sm"
                    colorScheme={isRecording ? "red" : "gray"}
                    variant={isRecording ? "solid" : "ghost"}
                    isDisabled={isDisabled}
                    onClick={isRecording ? stopRecording : startRecording}
                  />
                </Tooltip>
                
                <Tooltip label="Message settings" placement="top">
                  <IconButton
                    aria-label="Message settings"
                    icon={<FaCog />}
                    size="sm"
                    variant="ghost"
                    isDisabled={isDisabled || isRecording}
                    onClick={onEncryptionOpen}
                  />
                </Tooltip>
                
                <Tooltip label="Priority settings" placement="top">
                  <IconButton
                    aria-label="Priority settings"
                    icon={<FaGasPump />}
                    size="sm"
                    variant="ghost"
                    isDisabled={isDisabled || isRecording}
                    onClick={onGasSettingsOpen}
                  />
                </Tooltip>
              </HStack>
              
              <Box flex="1" />
              
              {!isMobile && (
              <Tooltip label="Keyboard shortcuts" placement="top">
                <Flex align="center" mx={2} opacity={0.6}>
                  <Kbd fontSize="xs" mr={1}>Enter</Kbd>
                  <span>to send,</span>
                  <Kbd fontSize="xs" mx={1}>Shift</Kbd>
                  <span>+</span>
                  <Kbd fontSize="xs" ml={1}>Enter</Kbd>
                  <span>for new line</span>
                </Flex>
              </Tooltip>
            )}
            </Flex>
          </Box>
          
          <Tooltip label="Send message" placement="top">
            <IconButton
              aria-label="Send message"
              icon={<FaPaperPlane />}
              colorScheme="purple"
              borderRadius="md"
              onClick={sendMessage}
              isLoading={isLoading}
              isDisabled={!message.trim() || isDisabled || isRecording}
              boxShadow="sm"
              _hover={{
                transform: 'translateY(-2px)',
                boxShadow: 'md',
              }}
              transition="all 0.2s"
            />
          </Tooltip>
        </Flex>
      </MotionBox>
      
      {/* File transfer modal */}
      {chatId && (
        <FileTransfer
          isOpen={isFileTransferOpen}
          onClose={onFileTransferClose}
          onFileSelect={handleFileSelect}
          chatId={chatId}
        />
      )}
      
      {/* Encryption Settings Popover */}
      <Popover
        isOpen={isEncryptionOpen}
        onClose={onEncryptionClose}
        placement="top"
        closeOnBlur={true}
      >
        <PopoverContent
          bg={colorMode === 'dark' ? 'gray.800' : 'white'}
          borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
          boxShadow="lg"
        >
          <PopoverArrow />
          <PopoverHeader fontWeight="semibold" borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}>
            <Flex align="center">
              <Icon as={FaKey} mr={2} />
              Encryption Settings
            </Flex>
          </PopoverHeader>
          <PopoverBody>
            <VStack spacing={4} align="stretch">
              <FormControl display="flex" alignItems="center" justifyContent="space-between">
                <FormLabel htmlFor="is-encrypted" mb="0" fontSize="sm">
                  End-to-End Encryption
                </FormLabel>
                <Switch
                  id="is-encrypted"
                  isChecked={isEncrypted}
                  colorScheme="purple"
                  isDisabled
                />
              </FormControl>
              
              <FormControl>
                <FormLabel fontSize="sm">Encryption Level</FormLabel>
                <Select
                  size="sm"
                  value={encryptionType}
                  onChange={(e) => console.log('Encryption type set to:', e.target.value)}
                >
                  <option value="standard">Standard (AES-256-GCM)</option>
                  <option value="high">High (ChaCha20-Poly1305)</option>
                  <option value="maximum">Maximum (Dual Encryption)</option>
                </Select>
              </FormControl>
              
              <FormControl display="flex" alignItems="center" justifyContent="space-between">
                <FormLabel htmlFor="verify-signature" mb="0" fontSize="sm">
                  Verified Digital Signature
                </FormLabel>
                <Switch
                  id="verify-signature"
                  isChecked={verifiedProfile}
                  onChange={() => setVerifiedProfile(!verifiedProfile)}
                  colorScheme="green"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel fontSize="sm">Signature Type</FormLabel>
                <HStack spacing={4}>
                  <Button
                    size="xs"
                    colorScheme={signatureType === 'personal' ? 'purple' : 'gray'}
                    variant={signatureType === 'personal' ? 'solid' : 'outline'}
                    onClick={() => setSignatureType('personal')}
                    leftIcon={<FaUserShield />}
                    flex="1"
                  >
                    Personal
                  </Button>
                  <Button
                    size="xs"
                    colorScheme={signatureType === 'verifiable' ? 'blue' : 'gray'}
                    variant={signatureType === 'verifiable' ? 'solid' : 'outline'}
                    onClick={() => setSignatureType('verifiable')}
                    leftIcon={<FaCertificate />}
                    flex="1"
                  >
                    Verifiable
                  </Button>
                </HStack>
              </FormControl>
            </VStack>
          </PopoverBody>
          <PopoverFooter
            display="flex"
            justifyContent="space-between"
            borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
          >
            <Button size="sm" variant="ghost" onClick={onEncryptionClose}>
              Close
            </Button>
            <Button size="sm" colorScheme="purple" onClick={onEncryptionClose}>
              Apply
            </Button>
          </PopoverFooter>
        </PopoverContent>
      </Popover>
      
      {/* Gas Settings Popover */}
      <Popover
        isOpen={isGasSettingsOpen}
        onClose={onGasSettingsClose}
        placement="top"
        closeOnBlur={true}
      >
        <PopoverContent
          bg={colorMode === 'dark' ? 'gray.800' : 'white'}
          borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
          boxShadow="lg"
        >
          <PopoverArrow />
          <PopoverHeader fontWeight="semibold" borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}>
            <Flex align="center">
              <Icon as={FaGasPump} mr={2} />
              Message Priority Settings
            </Flex>
          </PopoverHeader>
          <PopoverBody>
            <VStack spacing={4} align="stretch">
              <Text fontSize="sm">
                Select message priority level. Higher priority messages are processed faster but consume more resources.
              </Text>
              
              <Box>
                <Flex justify="space-between" mb={1}>
                  <Text fontSize="xs">Economy</Text>
                  <Text fontSize="xs">Premium</Text>
                </Flex>
                <Slider
                  min={0}
                  max={2}
                  step={1}
                  value={gasLevel === 'low' ? 0 : gasLevel === 'medium' ? 1 : 2}
                  onChange={(val) => {
                    const level = val === 0 ? 'low' : val === 1 ? 'medium' : 'high';
                    setGasLevel(level as GasLevel);
                  }}
                  colorScheme="purple"
                >
                  <SliderTrack>
                    <SliderFilledTrack />
                  </SliderTrack>
                  <SliderThumb boxSize={6} color="purple.500">
                    <Icon as={gasLevel === 'low' ? FaClock : gasLevel === 'medium' ? FaRocket : FaFire} boxSize={3} />
                  </SliderThumb>
                </Slider>
              </Box>
              
              <VStack spacing={1} align="stretch" py={2} px={3} borderRadius="md" bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}>
                <Flex justify="space-between">
                  <Text fontSize="sm">Priority Level:</Text>
                  <Badge colorScheme={gasInfo.color}>{gasInfo.text}</Badge>
                </Flex>
                <Flex justify="space-between">
                  <Text fontSize="sm">Processing Time:</Text>
                  <Text fontSize="sm" fontWeight="medium">
                    {gasLevel === 'low' 
                      ? '30-60 seconds' 
                      : gasLevel === 'medium' 
                        ? '5-10 seconds' 
                        : '< 2 seconds'}
                  </Text>
                </Flex>
                <Flex justify="space-between">
                  <Text fontSize="sm">Resource Cost:</Text>
                  <Text fontSize="sm" fontWeight="medium">
                    {getGasPrice(gasLevel)} GWEI/char
                  </Text>
                </Flex>
              </VStack>
            </VStack>
          </PopoverBody>
          <PopoverFooter
            display="flex"
            justifyContent="space-between"
            borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
          >
            <Button size="sm" variant="ghost" onClick={onGasSettingsClose}>
              Cancel
            </Button>
            <Button size="sm" colorScheme="purple" onClick={onGasSettingsClose}>
              Apply Settings
            </Button>
          </PopoverFooter>
        </PopoverContent>
      </Popover>
    </>
  );
};
