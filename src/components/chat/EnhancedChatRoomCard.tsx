// src/components/chat/EnhancedChatRoomCard.tsx
import React, { useState } from 'react';
import { 
  Box, 
  Flex, 
  Text, 
  Badge, 
  useColorMode, 
  Icon, 
  Heading, 
  VStack, 
  HStack,
  Tag,
  TagLabel,
  Tooltip,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton,
  Divider,
  Progress,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useToast,
  SimpleGrid
} from '@chakra-ui/react';
import { 
  FaShieldAlt, 
  FaUsers, 
  FaClock, 
  FaLock,
  FaEllipsisV,
  FaUserPlus,
  FaTrash,
  FaArchive,
  FaExclamationTriangle,
  FaStar,
  FaKey,
  FaChartLine,
  FaEthereum,
  FaCloudDownloadAlt,
  FaRocket,
  FaInfoCircle,
  FaLink,
  FaCopy,
  FaFingerprint,
  FaCheckCircle,
  FaHistory,
  FaNetworkWired,
  FaExternalLinkAlt,
  FaLockOpen,
  FaRegBell,
  FaBellSlash,
  FaHashtag,
  FaGlobe
} from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { ChatRoom } from '../../types/chat';

interface EnhancedChatRoomCardProps {
  room: ChatRoom;
  onClick: () => void;
  onDelete?: (roomId: string) => Promise<void>;
  onArchive?: (roomId: string) => Promise<void>;
  onStar?: (roomId: string) => Promise<void>;
}

// Create a motion box for animations
const MotionBox = motion(Box);

export const EnhancedChatRoomCard: React.FC<EnhancedChatRoomCardProps> = ({ 
  room, 
  onClick,
  onDelete,
  onArchive,
  onStar 
}) => {
  const { colorMode } = useColorMode();
  const [isHovered, setIsHovered] = useState(false);
  const toast = useToast();
  
  // Simulated blockchain metadata for chat rooms
  const [blockchainData] = useState({
    consensusLevel: Math.floor(Math.random() * 30) + 70, // 70-100%
    txHash: `0x${Array.from({length: 20}, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
    verificationLevel: ['basic', 'enhanced', 'maximum'][Math.floor(Math.random() * 3)],
    peers: Math.floor(Math.random() * 5) + 2,
    channelType: Math.random() > 0.5 ? 'shard' : 'main',
    networkLatency: Math.floor(Math.random() * 200) + 10, // 10-210ms
  });
  
  // Room preferences
  const [isMuted, setIsMuted] = useState(false);
  const [isStarred, setIsStarred] = useState(room.isStarred || false);
  
  // Dialog states
  const { 
    isOpen: isDetailsOpen, 
    onOpen: onOpenDetails, 
    onClose: onCloseDetails 
  } = useDisclosure();
  
  const {
    isOpen: isDeleteAlertOpen,
    onOpen: onOpenDeleteAlert,
    onClose: onCloseDeleteAlert
  } = useDisclosure();
  
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  
  // Calculate time since last activity
  const getTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return 'Unknown time';
    }
  };
  
  const lastActivity = room.lastActivity 
    ? getTimeAgo(room.lastActivity) 
    : getTimeAgo(room.createdAt);
  
  // Get encryption badge color based on type
  const getEncryptionBadgeColor = () => {
    if (!room.encryptionType) return 'gray';
    
    switch (room.encryptionType) {
      case 'maximum': return 'green';
      case 'high': return 'teal';
      case 'standard':
      default: return 'blue';
    }
  };
  
  // Get verification level badge color
  const getVerificationBadgeColor = () => {
    switch (blockchainData.verificationLevel) {
      case 'maximum': return 'green';
      case 'enhanced': return 'teal';
      case 'basic':
      default: return 'blue';
    }
  };
  
  // Handle delete room
  const handleDelete = async () => {
    if (onDelete) {
      try {
        await onDelete(room.id);
        toast({
          title: "Chat room deleted",
          status: "success",
          duration: 3000,
        });
      } catch (error) {
        toast({
          title: "Failed to delete chat room",
          description: "An error occurred while deleting the chat room.",
          status: "error",
          duration: 5000,
        });
      } finally {
        onCloseDeleteAlert();
      }
    }
  };
  
  // Handle archive room
  const handleArchive = async () => {
    if (onArchive) {
      try {
        await onArchive(room.id);
        toast({
          title: "Chat room archived",
          status: "success",
          duration: 3000,
        });
      } catch (error) {
        toast({
          title: "Failed to archive chat room",
          status: "error",
          duration: 5000,
        });
      }
    }
  };
  
  // Handle star/unstar room
  const handleStar = async () => {
    setIsStarred(!isStarred);
    if (onStar) {
      try {
        await onStar(room.id);
        toast({
          title: isStarred ? "Chat room unstarred" : "Chat room starred",
          status: "success",
          duration: 2000,
        });
      } catch (error) {
        // Revert star state on failure
        setIsStarred(isStarred);
        toast({
          title: "Failed to update star status",
          status: "error",
          duration: 3000,
        });
      }
    }
  };
  
  // Copy room ID (formatted as a blockchain transaction)
  const copyRoomId = () => {
    navigator.clipboard.writeText(room.id);
    toast({
      title: "Room ID copied",
      description: "The room ID has been copied to clipboard",
      status: "success",
      duration: 2000,
    });
  };
  
  // Get message retention display text
  const getRetentionText = () => {
    if (!room.messageRetention || room.messageRetention === 0) {
      return 'Forever';
    }
    
    if (room.messageRetention === 1) {
      return '1 day';
    }
    
    return `${room.messageRetention} days`;
  };

  
  return (
    <MotionBox
      p={4}
      borderRadius="lg"
      boxShadow="md"
      bg={colorMode === 'dark' ? 'gray.700' : 'white'}
      cursor="pointer"
      onClick={onClick}
      transition="all 0.2s"
      _hover={{
        transform: 'translateY(-4px)',
        boxShadow: 'lg',
        bg: colorMode === 'dark' ? 'gray.600' : 'gray.50',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      position="relative"
      overflow="hidden"
    >
      {/* Background decor - blockchain aesthetic */}
      <Box 
        position="absolute" 
        top={0} 
        left={0} 
        right={0} 
        bottom={0} 
        opacity={0.03} 
        pointerEvents="none" 
        zIndex={0}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Box 
            key={i}
            position="absolute"
            top={`${i * 20}%`}
            right="10%"
            width={`${Math.random() * 40 + 30}%`}
            height="1px"
            bg="purple.500"
          />
        ))}
        
        {Array.from({ length: 3 }).map((_, i) => (
          <Box 
            key={i}
            position="absolute"
            top={`${i * 30 + 10}%`}
            right={`${i * 20}%`}
            width="8px"
            height="8px"
            borderRadius="full"
            bg="purple.500"
            opacity={0.2}
          />
        ))}
      </Box>
      
      {/* Star indicator in corner */}
      {isStarred && (
        <Box 
          position="absolute" 
          top={2} 
          right={2} 
          color="yellow.400"
          zIndex={2}
        >
          <Icon as={FaStar} boxSize={5} />
        </Box>
      )}
      
      {/* Muted indicator in corner */}
      {isMuted && (
        <Box 
          position="absolute" 
          top={isStarred ? 10 : 2} 
          right={2} 
          color="gray.400"
          zIndex={2}
        >
          <Icon as={FaBellSlash} boxSize={4} />
        </Box>
      )}

      <VStack align="stretch" spacing={4} position="relative" zIndex={1}>
        <Flex justify="space-between" align="start">
          <Heading size="md" mb={1} isTruncated>
            {room.name}
          </Heading>
          {room.unreadCount ? (
            <Badge colorScheme="purple" borderRadius="full" px={2}>
              {room.unreadCount}
            </Badge>
          ) : null}
        </Flex>
        
        <Text 
          noOfLines={2} 
          fontSize="sm" 
          color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}
        >
          {room.preview || 'Start a new secure conversation'}
        </Text>
        
        {/* Primary room attributes */}
        <HStack spacing={2} flexWrap="wrap">
          <Tooltip label="Room participants">
            <Badge variant="subtle" colorScheme="blue" display="flex" alignItems="center">
              <FaUsers style={{ marginRight: '4px' }} />
              {room.participants}
            </Badge>
          </Tooltip>
          
          <Tooltip label={`${room.encryptionType || 'Standard'} encryption`}>
            <Badge variant="subtle" colorScheme={getEncryptionBadgeColor()} display="flex" alignItems="center">
              <FaLock style={{ marginRight: '4px' }} />
              {room.encryptionType ? room.encryptionType.charAt(0).toUpperCase() + room.encryptionType.slice(1) : 'Standard'}
            </Badge>
          </Tooltip>
          
          {room.isEphemeral && (
            <Tooltip label="Messages disappear after a period of inactivity">
              <Badge variant="subtle" colorScheme="orange" display="flex" alignItems="center">
                <FaClock style={{ marginRight: '4px' }} />
                Ephemeral
              </Badge>
            </Tooltip>
          )}
          
          {room.useP2P && (
            <Tooltip label="Peer-to-peer direct connection">
              <Badge variant="subtle" colorScheme="purple" display="flex" alignItems="center">
                <FaShieldAlt style={{ marginRight: '4px' }} />
                P2P
              </Badge>
            </Tooltip>
          )}
          
          {blockchainData.channelType === 'shard' && (
            <Tooltip label="Sharded channel for enhanced privacy">
              <Badge variant="subtle" colorScheme="green" display="flex" alignItems="center">
                <FaFingerprint style={{ marginRight: '4px' }} />
                Shard
              </Badge>
            </Tooltip>
          )}
        </HStack>
        
        {/* Blockchain-inspired visual elements */}
        <Box>
          <Flex justify="space-between" align="center" mb={1}>
            <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.500' : 'gray.500'}>
              Consensus Level
            </Text>
            <Text fontSize="xs" fontWeight="medium" color={
              blockchainData.consensusLevel > 90 ? 'green.500' :
              blockchainData.consensusLevel > 80 ? 'yellow.500' : 'orange.500'
            }>
              {blockchainData.consensusLevel}%
            </Text>
          </Flex>
          <Progress 
            value={blockchainData.consensusLevel} 
            size="xs" 
            colorScheme={
              blockchainData.consensusLevel > 90 ? 'green' :
              blockchainData.consensusLevel > 80 ? 'yellow' : 'orange'
            }
            borderRadius="full"
          />
        </Box>
        
        {/* Date and room controls */}
        <Flex justify="space-between" align="center">
          <HStack>
            <Text 
              fontSize="xs" 
              color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}
            >
              {lastActivity}
            </Text>
            
            <Tooltip label={`Network: ${blockchainData.networkLatency}ms`}>
              <Badge 
                size="sm" 
                variant="outline" 
                colorScheme={
                  blockchainData.networkLatency < 50 ? 'green' :
                  blockchainData.networkLatency < 100 ? 'yellow' : 'orange'
                }
              >
                {blockchainData.networkLatency}ms
              </Badge>
            </Tooltip>
          </HStack>
          
          <Menu isLazy>
            <MenuButton
              as={IconButton}
              icon={<FaEllipsisV />}
              variant="ghost"
              size="sm"
              onClick={(e) => e.stopPropagation()}
              opacity={isHovered ? 1 : 0}
              transition="opacity 0.2s"
            />
            <MenuList>
              <MenuItem icon={<FaInfoCircle />} onClick={(e) => {
                e.stopPropagation();
                onOpenDetails();
              }}>
                View Details
              </MenuItem>
              <MenuItem 
                icon={<FaUserPlus />} 
                onClick={(e) => e.stopPropagation()}
              >
                Invite Members
              </MenuItem>
              <MenuItem 
                icon={isStarred ? <FaStar color="yellow.400" /> : <FaStar />} 
                onClick={(e) => {
                  e.stopPropagation();
                  handleStar();
                }}
              >
                {isStarred ? 'Unstar' : 'Star'} Chat
              </MenuItem>
              <MenuItem 
                icon={isMuted ? <FaRegBell /> : <FaBellSlash />} 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
              >
                {isMuted ? 'Unmute' : 'Mute'} Notifications
              </MenuItem>
              <Divider />
              <MenuItem 
                icon={<FaArchive />} 
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchive();
                }}
              >
                Archive Chat
              </MenuItem>
              <MenuItem 
                icon={<FaTrash />} 
                color="red.500"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDeleteAlert();
                }}
              >
                Delete Chat
              </MenuItem>
            </MenuList>
          </Menu>
        </Flex>
      </VStack>
      
      {/* Chat details modal */}
      <Modal isOpen={isDetailsOpen} onClose={onCloseDetails} size="lg">
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg={colorMode === 'dark' ? 'gray.800' : 'white'}>
          <ModalHeader>Chat Room Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Flex justify="space-between" align="center">
                <Heading size="md">{room.name}</Heading>
                <HStack>
                  {room.useP2P && (
                    <Badge colorScheme="purple" variant="solid">P2P</Badge>
                  )}
                  {room.isEphemeral && (
                    <Badge colorScheme="orange" variant="solid">Ephemeral</Badge>
                  )}
                </HStack>
              </Flex>
              
              <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
                {room.preview || 'Start a new secure conversation with end-to-end encryption.'}
              </Text>
              
              <Divider />
              
              <Heading size="sm">Security Details</Heading>
              
              <SimpleGrid columns={2} spacing={4}>
                <VStack align="start">
                  <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    Encryption Type
                  </Text>
                  <Badge colorScheme={getEncryptionBadgeColor()}>
                    {room.encryptionType 
                      ? room.encryptionType.charAt(0).toUpperCase() + room.encryptionType.slice(1) 
                      : 'Standard'}
                  </Badge>
                </VStack>
                
                <VStack align="start">
                  <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    Verification Level
                  </Text>
                  <Badge colorScheme={getVerificationBadgeColor()}>
                    {blockchainData.verificationLevel.charAt(0).toUpperCase() + blockchainData.verificationLevel.slice(1)}
                  </Badge>
                </VStack>
                
                <VStack align="start">
                  <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    Message Retention
                  </Text>
                  <Badge colorScheme={
                    !room.messageRetention || room.messageRetention === 0 ? 'green' :
                    room.messageRetention <= 7 ? 'yellow' : 'red'
                  }>
                    {getRetentionText()}
                  </Badge>
                </VStack>
                
                <VStack align="start">
                  <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    Connection Type
                  </Text>
                  <Badge colorScheme={room.useP2P ? 'purple' : 'blue'}>
                    {room.useP2P ? 'Peer-to-Peer' : 'Server Relayed'}
                  </Badge>
                </VStack>
              </SimpleGrid>
              
              <Divider />
              
              <Heading size="sm">Blockchain Metadata</Heading>
              
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <HStack>
                  <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    Channel ID:
                  </Text>
                  <Text fontSize="sm" fontFamily="mono" isTruncated>
                    {room.id.substring(0, 8)}...{room.id.substring(room.id.length - 8)}
                  </Text>
                  <IconButton
                    aria-label="Copy Room ID"
                    icon={<FaCopy />}
                    size="xs"
                    variant="ghost"
                    onClick={copyRoomId}
                  />
                </HStack>
                
                <HStack>
                  <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    Channel Type:
                  </Text>
                  <Badge colorScheme={blockchainData.channelType === 'shard' ? 'green' : 'blue'}>
                    {blockchainData.channelType.charAt(0).toUpperCase() + blockchainData.channelType.slice(1)}
                  </Badge>
                </HStack>
                
                <HStack>
                  <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    Consensus:
                  </Text>
                  <Badge colorScheme={
                    blockchainData.consensusLevel > 90 ? 'green' :
                    blockchainData.consensusLevel > 80 ? 'yellow' : 'orange'
                  }>
                    {blockchainData.consensusLevel}%
                  </Badge>
                </HStack>
                
                <HStack>
                  <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    Peers:
                  </Text>
                  <Badge colorScheme="blue">
                    {blockchainData.peers}
                  </Badge>
                </HStack>
                
                <HStack>
                  <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    Network Latency:
                  </Text>
                  <Badge colorScheme={
                    blockchainData.networkLatency < 50 ? 'green' :
                    blockchainData.networkLatency < 100 ? 'yellow' : 'orange'
                  }>
                    {blockchainData.networkLatency}ms
                  </Badge>
                </HStack>
                
                <HStack>
                  <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    Created:
                  </Text>
                  <Text fontSize="sm">
                    {new Date(room.createdAt).toLocaleString()}
                  </Text>
                </HStack>
              </SimpleGrid>
              
              <Divider />
              
              <VStack spacing={3} align="stretch">
                <Heading size="sm">Participants ({room.participants})</Heading>
                <Button 
                  leftIcon={<FaUserPlus />} 
                  size="sm" 
                  colorScheme="purple" 
                  variant="outline"
                  w="fit-content"
                >
                  Invite New Participants
                </Button>
              </VStack>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onCloseDetails}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Delete confirmation dialog */}
      <AlertDialog
        isOpen={isDeleteAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={onCloseDeleteAlert}
      >
        <AlertDialogOverlay>
          <AlertDialogContent bg={colorMode === 'dark' ? 'gray.800' : 'white'}>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Chat Room
            </AlertDialogHeader>

            <AlertDialogBody>
              <VStack align="stretch" spacing={4}>
                <Text>
                  Are you sure you want to delete "{room.name}"? This action cannot be undone.
                </Text>
                <Box py={2} px={4} bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'} borderRadius="md">
                  <Text fontSize="sm" fontWeight="medium">
                    <Icon as={FaExclamationTriangle} color="orange.500" mr={2} />
                    All messages and encryption keys will be permanently removed
                  </Text>
                </Box>
              </VStack>
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onCloseDeleteAlert}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDelete} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </MotionBox>
  );
};
