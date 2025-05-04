// src/pages/dashboard.tsx
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { 
  Box, 
  Grid, 
  Heading, 
  Button, 
  Text, 
  useColorMode,
  useDisclosure, 
  SimpleGrid, 
  Icon, 
  Flex,
  VStack,
  HStack,
  Badge,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Tabs,
  TabList,
  TabPanels,
  Tab, 
  TabPanel,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Divider,
  useToast,
  Avatar,
  AvatarGroup,
  Tooltip,
  Skeleton,
  Progress,
  Tag,
  TagLabel,
  TagLeftIcon,
  Select
} from '@chakra-ui/react';
import { 
  FaPlus, 
  FaKey, 
  FaShieldAlt, 
  FaUsers, 
  FaRegComments, 
  FaSearch,
  FaBell,
  FaCog,
  FaWallet,
  FaEthereum,
  FaStar,
  FaNetworkWired,
  FaChartLine,
  FaCubes,
  FaBitcoin,
  FaFilter,
  FaSortAmountDown,
  FaSortAmountUp,
  FaServer,
  FaGlobe,
  FaPowerOff,
  FaLock,
  FaExchangeAlt,
  FaHashtag,
  FaArchive,
  FaUserSecret,
  FaFingerprint,
  FaRandom,
  FaHistory,
  FaSyncAlt
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { CreateChatModal } from '../components/modals/CreateChatModal';
import { useAuth } from '../contexts/AuthContext';
import { useChatRooms } from '../hooks/useChatRooms';
import { EnhancedChatRoomCard } from '../components/chat/EnhancedChatRoomCard';

// Motion components for animations
const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

// Network stats for web3-inspired visualization
interface NetworkStats {
  totalRooms: number;
  activeUsers: number;
  messagesPerMin: number;
  encryptionStrength: number;
  averageLatency: number;
  consensusLevel: number;
  networkNodes: number;
  channelCapacity: number;
}

// Node visualization component
const NetworkNodesVisual: React.FC<{nodesCount: number}> = ({ nodesCount }) => {
  const { colorMode } = useColorMode();
  const nodes = Array.from({ length: Math.min(nodesCount, 12) });
  
  return (
    <Box position="relative" h="100px" w="100%">
      {nodes.map((_, i) => (
        <MotionBox
          key={i}
          position="absolute"
          top={`${Math.random() * 70}%`}
          left={`${Math.random() * 90}%`}
          width="8px"
          height="8px"
          borderRadius="full"
          bg="purple.500"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.7, 1, 0.7]
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2
          }}
        />
      ))}
      
      {nodes.map((_, i) => (
        <React.Fragment key={`line-${i}`}>
          {i < nodes.length - 1 && (
            <Box 
              position="absolute"
              top={`${30 + Math.random() * 40}%`}
              left={`${10 + (i * 80 / nodes.length)}%`}
              width={`${Math.random() * 20 + 10}%`}
              height="1px"
              bg={colorMode === 'dark' ? 'purple.800' : 'purple.200'}
              zIndex={0}
            />
          )}
        </React.Fragment>
      ))}
    </Box>
  );
};

const Dashboard = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { colorMode } = useColorMode();
  const router = useRouter();
  const toast = useToast();
  const { user, isAuthenticated, logout } = useAuth();
  const { chatRooms, loading, error, refreshRooms, deleteRoom, archiveRoom, starRoom } = useChatRooms();
  
  // Filter and sort options
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'p2p' | 'encrypted' | 'ephemeral' | 'starred'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'activity'>('activity');
  
  // Network stats state (simulated)
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    totalRooms: 0,
    activeUsers: 0,
    messagesPerMin: 0,
    encryptionStrength: 0,
    averageLatency: 0,
    consensusLevel: 0,
    networkNodes: 0,
    channelCapacity: 0
  });
  
  // Animated metrics for visualization
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  
  // Update network stats periodically to simulate real-time data
  useEffect(() => {
    // Initial stats based partly on real data
    setNetworkStats({
      totalRooms: chatRooms.length + Math.floor(Math.random() * 10) + 5,
      activeUsers: Math.floor(Math.random() * 50) + 20,
      messagesPerMin: Math.floor(Math.random() * 100) + 10,
      encryptionStrength: Math.floor(Math.random() * 20) + 80, // 80-100%
      averageLatency: Math.floor(Math.random() * 50) + 20, // 20-70ms
      consensusLevel: Math.floor(Math.random() * 10) + 90, // 90-100%
      networkNodes: Math.floor(Math.random() * 15) + 5, // 5-20 nodes
      channelCapacity: Math.floor(Math.random() * 500) + 500 // 500-1000 capacity
    });
    
    // Simulate real-time stats updates
    const interval = setInterval(() => {
      setNetworkStats(prev => ({
        ...prev,
        activeUsers: Math.max(10, prev.activeUsers + (Math.random() > 0.5 ? 1 : -1)),
        messagesPerMin: Math.max(5, prev.messagesPerMin + Math.floor(Math.random() * 5) - 2),
        averageLatency: Math.max(10, Math.min(100, prev.averageLatency + Math.floor(Math.random() * 5) - 2)),
        consensusLevel: Math.max(80, Math.min(100, prev.consensusLevel + (Math.random() > 0.7 ? 1 : -1))),
      }));
    }, 5000);
    
    return () => clearInterval(interval);
  }, [chatRooms.length]);
  
  // Handle refresh stats animation
  const refreshNetworkStats = () => {
    setIsRefreshingStats(true);
    setTimeout(() => {
      setNetworkStats(prev => ({
        ...prev,
        activeUsers: Math.floor(Math.random() * 50) + 20,
        messagesPerMin: Math.floor(Math.random() * 100) + 10,
        averageLatency: Math.floor(Math.random() * 50) + 20,
        consensusLevel: Math.floor(Math.random() * 10) + 90,
      }));
      setIsRefreshingStats(false);
    }, 1000);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/connect-wallet');
    }
  }, [isAuthenticated, router]);

  // Create chat handler - opens modal
  const handleCreateChat = () => {
    onOpen();
  };

  // Navigate to selected chat room
  const handleJoinChat = (id: string) => {
    router.push(`/chat/${id}`);
  };
  
  // Delete room handler
  const handleDeleteRoom = async (roomId: string) => {
    try {
      await deleteRoom(roomId);
      refreshRooms();
      toast({
        title: "Chat room deleted",
        status: "success",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Failed to delete chat room",
        status: "error",
        duration: 3000,
      });
    }
  };
  
  // Archive room handler
  const handleArchiveRoom = async (roomId: string) => {
    try {
      await archiveRoom(roomId);
      refreshRooms();
      toast({
        title: "Chat room archived",
        status: "success",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Failed to archive chat room",
        status: "error",
        duration: 3000,
      });
    }
  };
  
  // Star room handler
  const handleStarRoom = async (roomId: string) => {
    try {
      await starRoom(roomId);
      refreshRooms();
    } catch (error) {
      toast({
        title: "Failed to update star status",
        status: "error",
        duration: 3000,
      });
    }
  };
  
  // Filter chatRooms based on search query and filter type
  const filteredChatRooms = chatRooms.filter(room => {
    // Search filter
    if (searchQuery && !room.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Type filter
    switch (filterType) {
      case 'p2p':
        return room.useP2P;
      case 'encrypted':
        return room.encryptionType === 'high' || room.encryptionType === 'maximum';
      case 'ephemeral':
        return room.isEphemeral;
      case 'starred':
        return room.isStarred;
      default:
        return true;
    }
  });
  
  // Sort filtered rooms
  const sortedRooms = [...filteredChatRooms].sort((a, b) => {
    switch (sortOrder) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'activity':
        // Default to most recent activity
        const aDate = a.lastActivity ? new Date(a.lastActivity).getTime() : new Date(a.createdAt).getTime();
        const bDate = b.lastActivity ? new Date(b.lastActivity).getTime() : new Date(b.createdAt).getTime();
        return bDate - aDate;
    }
  });

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Layout>
      <Box p={6}>
        {/* Header & Analytics Dashboard */}
        <MotionFlex 
          direction={{ base: 'column', lg: 'row' }}
          justify="space-between" 
          align={{ base: 'flex-start', lg: 'center' }}
          mb={6}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Box mb={{ base: 4, lg: 0 }}>
            <Heading size="lg" mb={1}>
              Welcome to AeroNyx
            </Heading>
            <Text color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
              Your decentralized secure messaging platform
            </Text>
          </Box>
          
          <HStack spacing={4}>
            <Button 
              leftIcon={<FaPlus />} 
              colorScheme="purple" 
              onClick={handleCreateChat}
              size="md"
              px={6}
              py={5}
              boxShadow="md"
              _hover={{
                transform: 'translateY(-2px)',
                boxShadow: 'lg'
              }}
              transition="all 0.2s"
            >
              Create New Chat
            </Button>
            
            <Menu>
              <MenuButton
                as={Button}
                rightIcon={<FaCog />}
                variant="ghost"
              >
                Actions
              </MenuButton>
              <MenuList>
                <MenuItem icon={<FaWallet />}>Connect Wallet</MenuItem>
                <MenuItem icon={<FaKey />}>Encryption Settings</MenuItem>
                <MenuItem icon={<FaNetworkWired />}>Network Status</MenuItem>
                <Divider />
                <MenuItem icon={<FaArchive />}>View Archived Chats</MenuItem>
                <MenuItem icon={<FaHistory />}>Chat History</MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </MotionFlex>
        
        {/* Network Status Dashboard (Web3 Inspired) */}
        <MotionBox
          mb={8}
          p={6}
          borderRadius="lg"
          bg={colorMode === 'dark' ? 'gray.800' : 'white'}
          boxShadow="md"
          overflow="hidden"
          position="relative"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {/* Background design elements */}
          <Box 
            position="absolute" 
            top={0} 
            right={0} 
            bottom={0} 
            width="30%" 
            bgGradient={`linear(to-l, ${colorMode === 'dark' ? 'gray.800' : 'white'}, transparent)`}
            opacity={0.8}
            zIndex={1}
          />
          
          <Flex 
            direction={{ base: 'column', lg: 'row' }}
            justify="space-between"
            align="center"
            mb={6}
            zIndex={2}
            position="relative"
          >
            <HStack spacing={4} mb={{ base: 4, lg: 0 }}>
              <Icon as={FaNetworkWired} boxSize={6} color="purple.500" />
              <Heading size="md">Network Status</Heading>
            </HStack>
            
            <HStack>
              <Badge 
                colorScheme={networkStats.consensusLevel > 95 ? 'green' : 'yellow'}
                px={2}
                py={1}
                borderRadius="full"
              >
                Consensus: {networkStats.consensusLevel}%
              </Badge>
              
              <Badge 
                colorScheme={networkStats.encryptionStrength > 90 ? 'green' : 'blue'}
                px={2}
                py={1}
                borderRadius="full"
              >
                Encryption: {networkStats.encryptionStrength}%
              </Badge>
              
              <Button 
                size="sm" 
                leftIcon={<FaSyncAlt />} 
                variant="ghost"
                isLoading={isRefreshingStats}
                onClick={refreshNetworkStats}
                colorScheme="purple"
              >
                Refresh
              </Button>
            </HStack>
          </Flex>
          
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={6} mb={8}>
            <Stat>
              <StatLabel>Total Rooms</StatLabel>
              <StatNumber>{networkStats.totalRooms}</StatNumber>
              <StatHelpText>
                <Icon as={FaRegComments} mr={1} />
                Active Channels
              </StatHelpText>
            </Stat>
            
            <Stat>
              <StatLabel>Active Users</StatLabel>
              <StatNumber>{networkStats.activeUsers}</StatNumber>
              <StatHelpText>
                <Icon as={FaUsers} mr={1} />
                Online
              </StatHelpText>
            </Stat>
            
            <Stat>
              <StatLabel>Messages/min</StatLabel>
              <StatNumber>{networkStats.messagesPerMin}</StatNumber>
              <StatHelpText>
                <Icon as={FaExchangeAlt} mr={1} />
                Throughput
              </StatHelpText>
            </Stat>
            
            <Stat>
              <StatLabel>Avg. Latency</StatLabel>
              <StatNumber>{networkStats.averageLatency}ms</StatNumber>
              <StatHelpText>
                <Icon as={FaBitcoin} mr={1} />
                Network Speed
              </StatHelpText>
            </Stat>
          </SimpleGrid>
          
          <Flex 
            direction={{ base: 'column', lg: 'row' }}
            justify="space-between"
            align={{ base: 'flex-start', lg: 'center' }}
          >
            <Box mb={{ base: 4, lg: 0 }} w={{ base: '100%', lg: '60%' }}>
              <Text fontSize="sm" mb={2}>Network Nodes ({networkStats.networkNodes})</Text>
              <NetworkNodesVisual nodesCount={networkStats.networkNodes} />
            </Box>
            
            <VStack spacing={1} align="stretch" w={{ base: '100%', lg: '35%' }}>
              <Text fontSize="sm" mb={1}>Channel Capacity</Text>
              <Progress 
                value={(networkStats.messagesPerMin / networkStats.channelCapacity) * 100} 
                colorScheme="purple" 
                size="sm" 
                borderRadius="full"
              />
              <Text fontSize="xs" textAlign="right">
                {networkStats.messagesPerMin} / {networkStats.channelCapacity} msg/min
              </Text>
            </VStack>
          </Flex>
        </MotionBox>
        
        {/* Security Features Section */}
        <MotionBox
          mb={8}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
            <Box 
              p={5} 
              shadow="md" 
              borderWidth="1px" 
              borderRadius="lg"
              bg={colorMode === 'dark' ? 'gray.700' : 'white'}
              _hover={{
                transform: 'translateY(-4px)',
                shadow: 'lg',
                borderColor: 'purple.400'
              }}
              transition="all 0.3s"
              cursor="pointer"
            >
              <Flex direction="column" align="center" textAlign="center">
                <Icon as={FaKey} w={10} h={10} color="purple.500" mb={4} />
                <Heading fontSize="xl" mb={4}>End-to-End Encryption</Heading>
                <Text color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                  Military-grade encryption keeps your messages private with ChaCha20-Poly1305 cipher
                </Text>
              </Flex>
            </Box>

            <Box 
              p={5} 
              shadow="md" 
              borderWidth="1px" 
              borderRadius="lg"
              bg={colorMode === 'dark' ? 'gray.700' : 'white'}
              _hover={{
                transform: 'translateY(-4px)',
                shadow: 'lg',
                borderColor: 'purple.400'
              }}
              transition="all 0.3s"
              cursor="pointer"
            >
              <Flex direction="column" align="center" textAlign="center">
                <Icon as={FaShieldAlt} w={10} h={10} color="purple.500" mb={4} />
                <Heading fontSize="xl" mb={4}>Decentralized Security</Heading>
                <Text color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                  Messages are encrypted locally with distributed consensus verification
                </Text>
              </Flex>
            </Box>

            <Box 
              p={5} 
              shadow="md" 
              borderWidth="1px" 
              borderRadius="lg"
              bg={colorMode === 'dark' ? 'gray.700' : 'white'}
              _hover={{
                transform: 'translateY(-4px)',
                shadow: 'lg',
                borderColor: 'purple.400'
              }}
              transition="all 0.3s"
              cursor="pointer"
            >
              <Flex direction="column" align="center" textAlign="center">
                <Icon as={FaFingerprint} w={10} h={10} color="purple.500" mb={4} />
                <Heading fontSize="xl" mb={4}>Forward Secrecy</Heading>
                <Text color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                  Each message uses unique encryption keys that can't be compromised retroactively
                </Text>
              </Flex>
            </Box>
          </SimpleGrid>
        </MotionBox>
        
        {/* Chat Rooms Section */}
        <Box mb={6}>
          <Tabs variant="soft-rounded" colorScheme="purple" isLazy>
            <TabList mb={6} overflowX="auto" py={2}>
              <Tab>All Chats</Tab>
              <Tab>P2P Encrypted</Tab>
              <Tab>Ephemeral</Tab>
              <Tab>Starred</Tab>
              <Tab>Archived</Tab>
            </TabList>
            
            {/* Search and filter controls */}
            <Flex
              mb={6}
              direction={{ base: 'column', md: 'row' }}
              align={{ base: 'stretch', md: 'center' }}
              justify="space-between"
              gap={4}
            >
              <InputGroup maxW={{ base: '100%', md: '400px' }}>
                <InputLeftElement pointerEvents="none">
                  <FaSearch color="gray.300" />
                </InputLeftElement>
                <Input 
                  placeholder="Search chats..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)}
                  bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                  borderRadius="full"
                />
              </InputGroup>
              
              <HStack spacing={4}>
                <Select
                  placeholder="Filter by"
                  size="md"
                  width={{ base: '100%', md: '200px' }}
                  borderRadius="full"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                >
                  <option value="all">All Chats</option>
                  <option value="p2p">P2P Only</option>
                  <option value="encrypted">High Encryption</option>
                  <option value="ephemeral">Ephemeral</option>
                  <option value="starred">Starred</option>
                </Select>
                
                <Menu>
                  <MenuButton
                    as={Button}
                    rightIcon={sortOrder === 'newest' ? <FaSortAmountDown /> : <FaSortAmountUp />}
                    variant="outline"
                    size="md"
                  >
                    Sort
                  </MenuButton>
                  <MenuList>
                    <MenuItem 
                      icon={<FaSortAmountDown />} 
                      onClick={() => setSortOrder('newest')}
                      fontWeight={sortOrder === 'newest' ? 'bold' : 'normal'}
                    >
                      Newest First
                    </MenuItem>
                    <MenuItem 
                      icon={<FaSortAmountUp />} 
                      onClick={() => setSortOrder('oldest')}
                      fontWeight={sortOrder === 'oldest' ? 'bold' : 'normal'}
                    >
                      Oldest First
                    </MenuItem>
                    <MenuItem 
                      icon={<FaHistory />} 
                      onClick={() => setSortOrder('activity')}
                      fontWeight={sortOrder === 'activity' ? 'bold' : 'normal'}
                    >
                      Recent Activity
                    </MenuItem>
                  </MenuList>
                </Menu>
              </HStack>
            </Flex>
            
            <TabPanels>
              {/* All Chats Panel */}
              <TabPanel px={0}>
                {loading ? (
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
                    {[1, 2, 3, 4, 5, 6].map((_, i) => (
                      <Skeleton key={i} height="200px" borderRadius="lg" />
                    ))}
                  </SimpleGrid>
                ) : sortedRooms.length > 0 ? (
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
                    <AnimatePresence>
                      {sortedRooms.map((room) => (
                        <MotionBox
                          key={room.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.3 }}
                        >
                          <EnhancedChatRoomCard
                            room={room}
                            onClick={() => handleJoinChat(room.id)}
                            onDelete={handleDeleteRoom}
                            onArchive={handleArchiveRoom}
                            onStar={handleStarRoom}
                          />
                        </MotionBox>
                      ))}
                    </AnimatePresence>
                  </SimpleGrid>
                ) : (
                  <MotionBox
                    p={10}
                    textAlign="center"
                    borderRadius="lg"
                    bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <VStack spacing={4}>
                      <Icon as={FaRegComments} boxSize={10} opacity={0.5} />
                      <Text mb={4}>
                        {searchQuery 
                          ? `No chat rooms found matching "${searchQuery}"` 
                          : "You don't have any active chats yet"}
                      </Text>
                      <Button
                        colorScheme="purple"
                        onClick={handleCreateChat}
                      >
                        Create Your First Chat
                      </Button>
                    </VStack>
                  </MotionBox>
                )}
              </TabPanel>
              
              {/* Other tabs would be implemented similarly */}
              <TabPanel px={0}>
                <P2PChatsPanel 
                  rooms={chatRooms.filter(room => room.useP2P)}
                  loading={loading}
                  onJoinChat={handleJoinChat}
                  onDeleteRoom={handleDeleteRoom}
                  onArchiveRoom={handleArchiveRoom}
                  onStarRoom={handleStarRoom}
                />
              </TabPanel>
              
              <TabPanel px={0}>
                <EphemeralChatsPanel 
                  rooms={chatRooms.filter(room => room.isEphemeral)}
                  loading={loading}
                  onJoinChat={handleJoinChat}
                  onDeleteRoom={handleDeleteRoom}
                  onArchiveRoom={handleArchiveRoom}
                  onStarRoom={handleStarRoom}
                />
              </TabPanel>
              
              <TabPanel px={0}>
                <StarredChatsPanel 
                  rooms={chatRooms.filter(room => room.isStarred)}
                  loading={loading}
                  onJoinChat={handleJoinChat}
                  onDeleteRoom={handleDeleteRoom}
                  onArchiveRoom={handleArchiveRoom}
                  onStarRoom={handleStarRoom}
                />
              </TabPanel>
              
              <TabPanel px={0}>
                <ArchivedChatsPanel 
                  rooms={chatRooms.filter(room => room.isArchived)}
                  loading={loading}
                  onJoinChat={handleJoinChat}
                  onDeleteRoom={handleDeleteRoom}
                  onStarRoom={handleStarRoom}
                />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Box>

      <CreateChatModal isOpen={isOpen} onClose={onClose} />
    </Layout>
  );
};

// Panel components for different tab views
interface ChatsPanelProps {
  rooms: any[];
  loading: boolean;
  onJoinChat: (id: string) => void;
  onDeleteRoom: (id: string) => Promise<void>;
  onArchiveRoom: (id: string) => Promise<void>;
  onStarRoom: (id: string) => Promise<void>;
}

const P2PChatsPanel: React.FC<ChatsPanelProps> = ({ 
  rooms, loading, onJoinChat, onDeleteRoom, onArchiveRoom, onStarRoom 
}) => {
  const { colorMode } = useColorMode();
  
  if (loading) {
    return (
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
        {[1, 2, 3].map((_, i) => (
          <Skeleton key={i} height="200px" borderRadius="lg" />
        ))}
      </SimpleGrid>
    );
  }
  
  if (rooms.length === 0) {
    return (
      <Box p={10} textAlign="center" borderRadius="lg" bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}>
        <VStack spacing={4}>
          <Icon as={FaShieldAlt} boxSize={10} opacity={0.5} />
          <Text>You don't have any peer-to-peer chats yet</Text>
          <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
            P2P chats offer the highest level of privacy with direct secure connections
          </Text>
        </VStack>
      </Box>
    );
  }
  
  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
      <AnimatePresence>
        {rooms.map((room) => (
          <MotionBox
            key={room.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
          >
            <EnhancedChatRoomCard
              room={room}
              onClick={() => onJoinChat(room.id)}
              onDelete={onDeleteRoom}
              onArchive={onArchiveRoom}
              onStar={onStarRoom}
            />
          </MotionBox>
        ))}
      </AnimatePresence>
    </SimpleGrid>
  );
};

// Other panel components would be similar
const EphemeralChatsPanel: React.FC<ChatsPanelProps> = ({ 
  rooms, loading, onJoinChat, onDeleteRoom, onArchiveRoom, onStarRoom 
}) => {
  const { colorMode } = useColorMode();
  
  if (loading) {
    return <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
      {[1, 2, 3].map((_, i) => (
        <Skeleton key={i} height="200px" borderRadius="lg" />
      ))}
    </SimpleGrid>;
  }
  
  if (rooms.length === 0) {
    return (
      <Box p={10} textAlign="center" borderRadius="lg" bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}>
        <VStack spacing={4}>
          <Icon as={FaClock} boxSize={10} opacity={0.5} />
          <Text>You don't have any ephemeral chats yet</Text>
          <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
            Ephemeral chats automatically delete messages after a set time period
          </Text>
        </VStack>
      </Box>
    );
  }
  
  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
      {rooms.map((room) => (
        <MotionBox
          key={room.id}
          layout
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
        >
          <EnhancedChatRoomCard
            room={room}
            onClick={() => onJoinChat(room.id)}
            onDelete={onDeleteRoom}
            onArchive={onArchiveRoom}
            onStar={onStarRoom}
          />
        </MotionBox>
      ))}
    </SimpleGrid>
  );
};

// Stub implementations for other panels
const StarredChatsPanel: React.FC<ChatsPanelProps> = ({ 
  rooms, loading, onJoinChat, onDeleteRoom, onArchiveRoom, onStarRoom 
}) => {
  const { colorMode } = useColorMode();
  
  if (loading) return <Skeleton height="200px" />;
  
  if (rooms.length === 0) {
    return (
      <Box p={10} textAlign="center" borderRadius="lg" bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}>
        <VStack spacing={4}>
          <Icon as={FaStar} boxSize={10} opacity={0.5} />
          <Text>No starred chats</Text>
        </VStack>
      </Box>
    );
  }
  
  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
      {rooms.map(room => (
        <EnhancedChatRoomCard
          key={room.id}
          room={room}
          onClick={() => onJoinChat(room.id)}
          onDelete={onDeleteRoom}
          onArchive={onArchiveRoom}
          onStar={onStarRoom}
        />
      ))}
    </SimpleGrid>
  );
};

const ArchivedChatsPanel: React.FC<Omit<ChatsPanelProps, 'onArchiveRoom'>> = ({ 
  rooms, loading, onJoinChat, onDeleteRoom, onStarRoom 
}) => {
  const { colorMode } = useColorMode();
  
  if (loading) return <Skeleton height="200px" />;
  
  if (rooms.length === 0) {
    return (
      <Box p={10} textAlign="center" borderRadius="lg" bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}>
        <VStack spacing={4}>
          <Icon as={FaArchive} boxSize={10} opacity={0.5} />
          <Text>No archived chats</Text>
        </VStack>
      </Box>
    );
  }
  
  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
      {rooms.map(room => (
        <EnhancedChatRoomCard
          key={room.id}
          room={room}
          onClick={() => onJoinChat(room.id)}
          onDelete={onDeleteRoom}
          onStar={onStarRoom}
        />
      ))}
    </SimpleGrid>
  );
};

export default Dashboard;
