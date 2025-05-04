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
  Skeleton
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
  FaNetworkWired,
  FaSortAmountDown,
  FaSortAmountUp,
  FaFilter,
  FaHistory,
  FaSyncAlt,
  FaArchive,
  FaStar,
  FaCheck
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { EnhancedChatRoomCard } from '../components/chat/EnhancedChatRoomCard';
import { EnhancedCreateChatModal } from '../components/modals/EnhancedCreateChatModal';
import { WalletConnectionCard } from '../components/wallet/WalletConnectionCard';
import NetworkStatsDashboard from '../components/dashboard/NetworkStatsDashboard';
import { useAuth } from '../contexts/AuthContext';
import { useChatRooms } from '../hooks/useChatRooms';

// Motion components for animations
const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

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
  const [activeTab, setActiveTab] = useState(0);
  
  // UI States
  const [showNetworkStats, setShowNetworkStats] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/connect-wallet');
    }
  }, [isAuthenticated, router]);

  // Handle refresh rooms
  const handleRefreshRooms = async () => {
    setIsRefreshing(true);
    try {
      await refreshRooms();
      toast({
        title: 'Rooms refreshed',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: 'Failed to refresh rooms',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle create chat - opens modal
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
  const getFilteredRooms = () => {
    return chatRooms.filter(room => {
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
  };
  
  // Sort filtered rooms
  const getSortedRooms = () => {
    const filteredRooms = getFilteredRooms();
    
    return [...filteredRooms].sort((a, b) => {
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
  };

  if (!isAuthenticated) {
    return null;
  }
  
  const filteredSortedRooms = getSortedRooms();

  return (
    <Layout>
      <Box p={{ base: 4, md: 8 }}>
        {/* Header */}
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
              Your secure end-to-end encrypted messaging platform
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
                <MenuItem icon={<FaWallet />} onClick={() => router.push('/settings?tab=3')}>
                  Wallet Settings
                </MenuItem>
                <MenuItem icon={<FaKey />} onClick={() => router.push('/settings?tab=0')}>
                  Encryption Settings
                </MenuItem>
                <MenuItem icon={<FaNetworkWired />} onClick={() => setShowNetworkStats(!showNetworkStats)}>
                  {showNetworkStats ? 'Hide' : 'Show'} Network Status
                </MenuItem>
                <Divider />
                <MenuItem icon={<FaSyncAlt />} onClick={handleRefreshRooms} isDisabled={isRefreshing}>
                  Refresh Rooms
                </MenuItem>
                <MenuItem icon={<FaArchive />}>
                  View Archived Chats
                </MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </MotionFlex>
        
        {/* Main content grid */}
        <Grid templateColumns={{ base: '1fr', xl: '3fr 1fr' }} gap={6}>
          <Box>
            {/* Network Stats Dashboard (collapsible) */}
            {showNetworkStats && (
              <MotionBox
                mb={6}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.5 }}
              >
                <NetworkStatsDashboard />
              </MotionBox>
            )}
            
            {/* Feature highlights */}
            <MotionBox
              mb={8}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
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
                      Military-grade ChaCha20-Poly1305 encryption protects your messages
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
                    <Icon as={FaUsers} w={10} h={10} color="purple.500" mb={4} />
                    <Heading fontSize="xl" mb={4}>Peer-to-Peer Messaging</Heading>
                    <Text color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                      Direct device-to-device communication without server intermediaries
                    </Text>
                  </Flex>
                </Box>
              </SimpleGrid>
            </MotionBox>
            
            {/* Chat Rooms Section */}
            <Box mb={6}>
              <Tabs 
                variant="soft-rounded" 
                colorScheme="purple" 
                isLazy
                index={activeTab}
                onChange={(index) => setActiveTab(index)}
              >
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
                    <Menu>
                      <MenuButton
                        as={Button}
                        rightIcon={<FaFilter />}
                        variant="outline"
                        size="md"
                      >
                        Filter
                      </MenuButton>
                      <MenuList>
                        <MenuItem 
                          onClick={() => setFilterType('all')}
                          icon={filterType === 'all' ? <FaCheck /> : undefined}
                        >
                          All Chats
                        </MenuItem>
                        <MenuItem 
                          onClick={() => setFilterType('p2p')}
                          icon={filterType === 'p2p' ? <FaCheck /> : undefined}
                        >
                          P2P Only
                        </MenuItem>
                        <MenuItem 
                          onClick={() => setFilterType('encrypted')}
                          icon={filterType === 'encrypted' ? <FaCheck /> : undefined}
                        >
                          High Encryption
                        </MenuItem>
                        <MenuItem 
                          onClick={() => setFilterType('ephemeral')}
                          icon={filterType === 'ephemeral' ? <FaCheck /> : undefined}
                        >
                          Ephemeral
                        </MenuItem>
                        <MenuItem 
                          onClick={() => setFilterType('starred')}
                          icon={filterType === 'starred' ? <FaCheck /> : undefined}
                        >
                          Starred
                        </MenuItem>
                      </MenuList>
                    </Menu>
                    
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
                    ) : filteredSortedRooms.length > 0 ? (
                      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
                        <AnimatePresence>
                          {filteredSortedRooms.map((room) => (
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
                  
                  {/* Other tabs - P2P Encrypted, Ephemeral, Starred, Archived */}
                  {/* These would follow a similar pattern to the All Chats panel */}
                  <TabPanel px={0}>
                    {/* P2P Encrypted tab content */}
                    <ChatRoomsList 
                      rooms={chatRooms.filter(room => room.useP2P)}
                      loading={loading}
                      onJoinChat={handleJoinChat}
                      onDeleteRoom={handleDeleteRoom}
                      onArchiveRoom={handleArchiveRoom}
                      onStarRoom={handleStarRoom}
                      emptyMessage="No P2P encrypted chats found"
                      emptyIcon={FaShieldAlt}
                    />
                  </TabPanel>
                  
                  <TabPanel px={0}>
                    {/* Ephemeral tab content */}
                    <ChatRoomsList 
                      rooms={chatRooms.filter(room => room.isEphemeral)}
                      loading={loading}
                      onJoinChat={handleJoinChat}
                      onDeleteRoom={handleDeleteRoom}
                      onArchiveRoom={handleArchiveRoom}
                      onStarRoom={handleStarRoom}
                      emptyMessage="No ephemeral chats found"
                      emptyIcon={FaHistory}
                    />
                  </TabPanel>
                  
                  <TabPanel px={0}>
                    {/* Starred tab content */}
                    <ChatRoomsList 
                      rooms={chatRooms.filter(room => room.isStarred)}
                      loading={loading}
                      onJoinChat={handleJoinChat}
                      onDeleteRoom={handleDeleteRoom}
                      onArchiveRoom={handleArchiveRoom}
                      onStarRoom={handleStarRoom}
                      emptyMessage="No starred chats found"
                      emptyIcon={FaStar}
                    />
                  </TabPanel>
                  
                  <TabPanel px={0}>
                    {/* Archived tab content */}
                    <ChatRoomsList 
                      rooms={chatRooms.filter(room => room.isArchived)}
                      loading={loading}
                      onJoinChat={handleJoinChat}
                      onDeleteRoom={handleDeleteRoom}
                      onArchiveRoom={handleArchiveRoom}
                      onStarRoom={handleStarRoom}
                      emptyMessage="No archived chats found"
                      emptyIcon={FaArchive}
                    />
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </Box>
          </Box>
          
          {/* Sidebar */}
          <VStack spacing={6} align="stretch">
            <WalletConnectionCard />
          </VStack>
        </Grid>
      </Box>

      <EnhancedCreateChatModal isOpen={isOpen} onClose={onClose} />
    </Layout>
  );
};

// Helper component for chat room lists
interface ChatRoomsListProps {
  rooms: any[];
  loading: boolean;
  onJoinChat: (id: string) => void;
  onDeleteRoom: (id: string) => Promise<void>;
  onArchiveRoom: (id: string) => Promise<void>;
  onStarRoom: (id: string) => Promise<void>;
  emptyMessage: string;
  emptyIcon: React.ComponentType;
}

const ChatRoomsList: React.FC<ChatRoomsListProps> = ({ 
  rooms, 
  loading, 
  onJoinChat, 
  onDeleteRoom, 
  onArchiveRoom, 
  onStarRoom,
  emptyMessage,
  emptyIcon
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
          <Icon as={emptyIcon} boxSize={10} opacity={0.5} />
          <Text>{emptyMessage}</Text>
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

export default Dashboard;
