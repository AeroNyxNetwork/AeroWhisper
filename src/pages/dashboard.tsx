// src/pages/dashboard.tsx
import React, { useEffect, useState, useCallback } from 'react';
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
  Skeleton,
  useMediaQuery,
  IconButton,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  Collapse,
  Link,
  useBreakpointValue,
  Stack,
  Container,
  Circle
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
  FaCheck,
  FaEllipsisV,
  FaInfoCircle,
  FaTimes,
  FaLayerGroup,
  FaChevronRight,
  FaBars
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { EnhancedChatRoomCard } from '../components/chat/EnhancedChatRoomCard';
import { EnhancedCreateChatModal } from '../components/modals/EnhancedCreateChatModal';
import { WalletConnectionCard } from '../components/wallet/WalletConnectionCard';
import NetworkStatsDashboard from '../components/dashboard/NetworkStatsDashboard';
import { useAuth } from '../contexts/AuthContext';
import { useChatRooms } from '../hooks/useChatRooms';
import { NotificationToggle } from '../components/common/NotificationToggle';

// Motion components for animations
const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

// Connection Certificate Alert Component
const ConnectionCertificateAlert = () => {
  const [isVisible, setIsVisible] = useState(true);
  const { colorMode } = useColorMode();
  const isMobile = useBreakpointValue({ base: true, md: false });

  if (!isVisible) return null;

  return (
    <Flex
      direction="column"
      p={isMobile ? 3 : 4}
      bg={colorMode === 'dark' ? 'yellow.800' : 'yellow.50'}
      borderRadius="md"
      borderWidth="1px"
      borderColor={colorMode === 'dark' ? 'yellow.700' : 'yellow.200'}
      mb={isMobile ? 3 : 6}
      position="relative"
      boxShadow="sm"
      maxW="100%"
      overflow="hidden"
    >
      <Flex align="center" mb={2}>
        <Icon as={FaInfoCircle} color={colorMode === 'dark' ? 'yellow.200' : 'yellow.500'} mr={2} />
        <Text fontWeight="bold" fontSize={isMobile ? "sm" : "md"}>Connection Certificate Notice</Text>
        <IconButton 
          icon={<FaTimes />} 
          size="sm" 
          aria-label="Close alert" 
          variant="ghost"
          position="absolute"
          right={1}
          top={1}
          onClick={() => setIsVisible(false)}
        />
      </Flex>
      <Text fontSize={isMobile ? "xs" : "sm"} mb={3}>
        If you experience connection issues, you may need to visit the server URL in your browser first to accept its security certificate.
      </Text>
      <Link 
        href="https://p2p.aeronyx.network:8080" 
        isExternal 
        color={colorMode === 'dark' ? 'yellow.200' : 'yellow.700'}
        fontWeight="medium"
        fontSize={isMobile ? "xs" : "sm"}
        wordBreak={isMobile ? "break-all" : "normal"}
      >
        Visit https://p2p.aeronyx.network:8080
      </Link>
    </Flex>
  );
};

// Feature Card Component
const FeatureCard = ({ icon, title, description }) => {
  const { colorMode } = useColorMode();
  const isMobile = useBreakpointValue({ base: true, md: false });
  
  return (
    <Box 
      p={isMobile ? 3 : 5} 
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
      height="100%"
    >
      <Flex direction="column" align="center" textAlign="center" h="100%">
        <Icon as={icon} w={isMobile ? 6 : { base: 8, md: 10 }} h={isMobile ? 6 : { base: 8, md: 10 }} color="purple.500" mb={3} />
        <Heading fontSize={isMobile ? "md" : { base: "lg", md: "xl" }} mb={isMobile ? 2 : { base: 2, md: 4 }}>
          {title}
        </Heading>
        <Text color={colorMode === 'dark' ? 'gray.400' : 'gray.500'} fontSize={isMobile ? "2xs" : { base: "xs", md: "sm" }}>
          {description}
        </Text>
      </Flex>
    </Box>
  );
};

// Mobile Action Button
const MobileActionButton = ({ icon, label, onClick, colorScheme = "gray" }) => {
  return (
    <VStack spacing={1} align="center" onClick={onClick} cursor="pointer" flex="1">
      <Circle size="40px" bg={`${colorScheme}.500`} color="white">
        <Icon as={icon} />
      </Circle>
      <Text fontSize="xs" textAlign="center" fontWeight="medium">
        {label}
      </Text>
    </VStack>
  );
};

const Dashboard = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { colorMode } = useColorMode();
  const router = useRouter();
  const toast = useToast();
  const { user, isAuthenticated, logout } = useAuth();
  const { chatRooms, loading, error, refreshRooms, deleteRoom, archiveRoom, starRoom } = useChatRooms();
  
  // Responsive design hooks
  const isMobile = useBreakpointValue({ base: true, sm: true, md: false });
  const isTablet = useBreakpointValue({ base: true, lg: false });
  const isSmallMobile = useBreakpointValue({ base: true, sm: false });
  
  // Filter drawer state (for mobile)
  const { 
    isOpen: isFilterDrawerOpen, 
    onOpen: onFilterDrawerOpen, 
    onClose: onFilterDrawerClose 
  } = useDisclosure();
  
  // Filter and sort options
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'p2p' | 'encrypted' | 'ephemeral' | 'starred'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'activity'>('activity');
  const [activeTab, setActiveTab] = useState(0);
  
  // UI States
  const [showNetworkStats, setShowNetworkStats] = useState(!isMobile);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFeatureHighlights, setShowFeatureHighlights] = useState(!isTablet);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/connect-wallet');
    }
  }, [isAuthenticated, router]);
  
  // Hide network stats on mobile by default
  useEffect(() => {
    setShowNetworkStats(!isMobile);
  }, [isMobile]);

  // Handle refresh rooms
  const handleRefreshRooms = async () => {
    setIsRefreshing(true);
    try {
      await refreshRooms();
      toast({
        title: 'Rooms refreshed',
        status: 'success',
        duration: 2000,
        isClosable: true,
        position: isMobile ? "bottom" : "top-right"
      });
    } catch (error) {
      toast({
        title: 'Failed to refresh rooms',
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: isMobile ? "bottom" : "top-right"
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
        isClosable: true,
        position: isMobile ? "bottom" : "top-right"
      });
    } catch (error) {
      toast({
        title: "Failed to delete chat room",
        status: "error",
        duration: 3000,
        isClosable: true,
        position: isMobile ? "bottom" : "top-right"
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
        isClosable: true,
        position: isMobile ? "bottom" : "top-right"
      });
    } catch (error) {
      toast({
        title: "Failed to archive chat room",
        status: "error",
        duration: 3000,
        isClosable: true,
        position: isMobile ? "bottom" : "top-right"
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
        isClosable: true,
        position: isMobile ? "bottom" : "top-right"
      });
    }
  };
  
  // Handle filter selection with automatic drawer close on mobile
  const handleFilterSelect = useCallback((type: 'all' | 'p2p' | 'encrypted' | 'ephemeral' | 'starred') => {
    setFilterType(type);
    if (isMobile) {
      onFilterDrawerClose();
    }
  }, [isMobile, onFilterDrawerClose]);
  
  // Handle sort selection with automatic drawer close on mobile
  const handleSortSelect = useCallback((sort: 'newest' | 'oldest' | 'activity') => {
    setSortOrder(sort);
    if (isMobile) {
      onFilterDrawerClose();
    }
  }, [isMobile, onFilterDrawerClose]);
  
  // Filter chatRooms based on search query and filter type
  const getFilteredRooms = useCallback(() => {
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
  }, [chatRooms, searchQuery, filterType]);
  
  // Sort filtered rooms
  const getSortedRooms = useCallback(() => {
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
  }, [getFilteredRooms, sortOrder]);

  if (!isAuthenticated) {
    return null;
  }
  
  const filteredSortedRooms = getSortedRooms();

  return (
    <Layout>
      <Box px={{ base: 2, sm: 3, md: 6, lg: 8 }} py={{ base: 2, md: 6 }}>
        {/* Mobile-optimized Connection Certificate Alert */}
        <ConnectionCertificateAlert />
        
        {/* Header Section - Fully Responsive */}
        <MotionFlex 
          direction={{ base: 'column', lg: 'row' }}
          justify="space-between" 
          align={{ base: 'flex-start', lg: 'center' }}
          mb={{ base: 3, md: 6 }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Box mb={{ base: 2, lg: 0 }}>
            <Heading 
              size={isMobile ? "md" : "lg"} 
              mb={1}
              fontSize={{ base: "xl", md: "2xl", lg: "3xl" }}
            >
              Welcome to AeroNyx
            </Heading>
            <Text 
              color={colorMode === 'dark' ? 'gray.400' : 'gray.600'} 
              fontSize={{ base: "xs", sm: "sm", md: "md" }}
              noOfLines={isMobile ? 2 : 1}
            >
              Your secure end-to-end encrypted messaging platform
            </Text>
          </Box>
          
          {/* Dynamic button stack based on screen size */}
          {isMobile ? (
            <Flex w="100%" justify="space-between" mt={2}>
              <Button 
                leftIcon={<FaPlus />} 
                colorScheme="purple" 
                onClick={handleCreateChat}
                size="sm"
                flex={1}
                mr={2}
              >
                New Chat
              </Button>
              <HStack spacing={1}>
                <NotificationToggle isCompact size="sm" />
                <IconButton
                  icon={<FaEllipsisV />}
                  aria-label="More options"
                  variant="ghost"
                  size="sm"
                  onClick={onFilterDrawerOpen}
                />
              </HStack>
            </Flex>
          ) : (
            <HStack spacing={{ base: 2, md: 4 }}>
              <NotificationToggle isCompact />
              <Button 
                leftIcon={<FaPlus />} 
                colorScheme="purple" 
                onClick={handleCreateChat}
                size={isMobile ? "sm" : "md"}
                px={{ base: 3, md: 6 }}
                py={{ base: 4, md: 5 }}
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
                  as={IconButton}
                  aria-label="Options"
                  icon={<FaEllipsisV />}
                  variant="ghost"
                  size={isMobile ? "sm" : "md"}
                />
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
                  {isTablet && (
                    <MenuItem icon={showFeatureHighlights ? <FaTimes /> : <FaShieldAlt />} onClick={() => setShowFeatureHighlights(!showFeatureHighlights)}>
                      {showFeatureHighlights ? 'Hide' : 'Show'} Features
                    </MenuItem>
                  )}
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
          )}
        </MotionFlex>
        
        {/* Mobile Quick Action Buttons - Only on small mobile */}
        {isSmallMobile && (
          <Flex justify="space-between" px={1} py={3} mb={3}>
            <MobileActionButton 
              icon={FaSyncAlt} 
              label="Refresh" 
              onClick={handleRefreshRooms} 
              colorScheme="blue"
            />
            <MobileActionButton 
              icon={FaFilter} 
              label="Filter" 
              onClick={onFilterDrawerOpen} 
              colorScheme="teal"
            />
            <MobileActionButton 
              icon={FaNetworkWired} 
              label="Network" 
              onClick={() => setShowNetworkStats(!showNetworkStats)} 
              colorScheme="purple"
            />
            <MobileActionButton 
              icon={FaShieldAlt} 
              label="Features" 
              onClick={() => setShowFeatureHighlights(!showFeatureHighlights)} 
              colorScheme="orange"
            />
          </Flex>
        )}
        
        {/* Main content grid - adaptive layout for mobile */}
        <Grid 
          templateColumns={{ base: '1fr', xl: '3fr 1fr' }} 
          gap={{ base: 3, md: 6 }}
          templateAreas={{
            base: `"main" "sidebar"`,
            xl: `"main sidebar"`
          }}
        >
          <Box gridArea="main">
            {/* Network Stats Dashboard (collapsible) */}
            <Collapse in={showNetworkStats} animateOpacity>
              <MotionBox
                mb={{ base: 3, md: 6 }}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <NetworkStatsDashboard />
              </MotionBox>
            </Collapse>
            
            {/* Feature highlights - collapsible on mobile/tablet */}
            <Collapse in={showFeatureHighlights} animateOpacity>
              <MotionBox
                mb={{ base: 3, md: 6 }}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={{ base: 2, md: 6 }}>
                  <FeatureCard 
                    icon={FaKey} 
                    title="E2E Encryption" 
                    description="Military-grade ChaCha20-Poly1305 encryption protects your messages"
                  />
                  <FeatureCard 
                    icon={FaShieldAlt} 
                    title="Decentralized" 
                    description="Messages are encrypted locally with distributed consensus verification"
                  />
                  <FeatureCard 
                    icon={FaUsers} 
                    title="P2P Messaging" 
                    description="Direct device-to-device communication without server intermediaries"
                  />
                </SimpleGrid>
              </MotionBox>
            </Collapse>
            
            {/* Chat Rooms Section - Optimized for mobile */}
            <Box mb={6}>
              <Tabs 
                variant="soft-rounded" 
                colorScheme="purple" 
                isLazy
                index={activeTab}
                onChange={(index) => setActiveTab(index)}
                size={isMobile ? "sm" : "md"}
              >
                <TabList 
                  mb={3} 
                  overflowX="auto" 
                  py={2} 
                  whiteSpace="nowrap"
                  css={{
                    // Custom scrollbar styling
                    '&::-webkit-scrollbar': {
                      height: '4px',
                    },
                    '&::-webkit-scrollbar-track': {
                      background: colorMode === 'dark' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: colorMode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                      borderRadius: '4px',
                    },
                  }}
                >
                  <Tab fontSize={isMobile ? "xs" : "md"} px={isMobile ? 2 : 4}>All Chats</Tab>
                  <Tab fontSize={isMobile ? "xs" : "md"} px={isMobile ? 2 : 4}>P2P</Tab>
                  <Tab fontSize={isMobile ? "xs" : "md"} px={isMobile ? 2 : 4}>Ephemeral</Tab>
                  <Tab fontSize={isMobile ? "xs" : "md"} px={isMobile ? 2 : 4}>Starred</Tab>
                  <Tab fontSize={isMobile ? "xs" : "md"} px={isMobile ? 2 : 4}>Archived</Tab>
                </TabList>
                
                {/* Mobile-optimized search input */}
                <Box mb={{ base: 3, md: 4 }}>
                  <InputGroup size={isMobile ? "sm" : "md"}>
                    <InputLeftElement pointerEvents="none">
                      <FaSearch color="gray.300" />
                    </InputLeftElement>
                    <Input 
                      placeholder="Search chats..." 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)}
                      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                      borderRadius="full"
                      fontSize={isMobile ? "sm" : "md"}
                    />
                  </InputGroup>
                </Box>
                
                {/* Filter controls for desktop */}
                {!isMobile && (
                  <Flex mb={4} justify="flex-end">
                    <HStack spacing={2}>
                      <Menu>
                        <MenuButton
                          as={Button}
                          rightIcon={<FaFilter />}
                          variant="outline"
                          size="sm"
                        >
                          {filterType === 'all' ? 'All' : filterType}
                        </MenuButton>
                        <MenuList>
                          <MenuItem 
                            onClick={() => handleFilterSelect('all')}
                            icon={filterType === 'all' ? <FaCheck /> : undefined}
                          >
                            All Chats
                          </MenuItem>
                          <MenuItem 
                            onClick={() => handleFilterSelect('p2p')}
                            icon={filterType === 'p2p' ? <FaCheck /> : undefined}
                          >
                            P2P Only
                          </MenuItem>
                          <MenuItem 
                            onClick={() => handleFilterSelect('encrypted')}
                            icon={filterType === 'encrypted' ? <FaCheck /> : undefined}
                          >
                            High Encryption
                          </MenuItem>
                          <MenuItem 
                            onClick={() => handleFilterSelect('ephemeral')}
                            icon={filterType === 'ephemeral' ? <FaCheck /> : undefined}
                          >
                            Ephemeral
                          </MenuItem>
                          <MenuItem 
                            onClick={() => handleFilterSelect('starred')}
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
                          size="sm"
                        >
                          {sortOrder}
                        </MenuButton>
                        <MenuList>
                          <MenuItem 
                            icon={<FaSortAmountDown />} 
                            onClick={() => handleSortSelect('newest')}
                            fontWeight={sortOrder === 'newest' ? 'bold' : 'normal'}
                          >
                            Newest First
                          </MenuItem>
                          <MenuItem 
                            icon={<FaSortAmountUp />} 
                            onClick={() => handleSortSelect('oldest')}
                            fontWeight={sortOrder === 'oldest' ? 'bold' : 'normal'}
                          >
                            Oldest First
                          </MenuItem>
                          <MenuItem 
                            icon={<FaHistory />} 
                            onClick={() => handleSortSelect('activity')}
                            fontWeight={sortOrder === 'activity' ? 'bold' : 'normal'}
                          >
                            Recent Activity
                          </MenuItem>
                        </MenuList>
                      </Menu>
                    </HStack>
                  </Flex>
                )}
                
                {/* Mobile Filter Drawer - Enhanced for usability */}
                <Drawer
                  isOpen={isFilterDrawerOpen}
                  placement="bottom"
                  onClose={onFilterDrawerClose}
                  size="md"
                >
                  <DrawerOverlay />
                  <DrawerContent borderTopRadius="xl">
                    <DrawerCloseButton />
                    <DrawerHeader borderBottomWidth="1px">Filter & Sort</DrawerHeader>
                    <DrawerBody py={4}>
                      <VStack spacing={6} align="stretch">
                        <Box>
                          <Text fontWeight="bold" mb={2}>Filter by Type</Text>
                          <SimpleGrid columns={2} spacing={3}>
                            {[
                              { value: 'all', label: 'All Chats' },
                              { value: 'p2p', label: 'P2P Only' },
                              { value: 'encrypted', label: 'High Encryption' },
                              { value: 'ephemeral', label: 'Ephemeral' },
                              { value: 'starred', label: 'Starred' }
                            ].map(option => (
                              <Button 
                                key={option.value} 
                                colorScheme={filterType === option.value ? 'purple' : 'gray'} 
                                variant={filterType === option.value ? 'solid' : 'outline'}
                                size="sm"
                                onClick={() => handleFilterSelect(option.value as any)}
                              >
                                {option.label}
                              </Button>
                            ))}
                          </SimpleGrid>
                        </Box>
                        
                        <Divider />
                        
                        <Box>
                          <Text fontWeight="bold" mb={2}>Sort By</Text>
                          <SimpleGrid columns={3} spacing={3}>
                            {[
                              { value: 'newest', label: 'Newest', icon: FaSortAmountDown },
                              { value: 'oldest', label: 'Oldest', icon: FaSortAmountUp },
                              { value: 'activity', label: 'Activity', icon: FaHistory }
                            ].map(option => (
                              <Button 
                                key={option.value} 
                                colorScheme={sortOrder === option.value ? 'purple' : 'gray'} 
                                variant={sortOrder === option.value ? 'solid' : 'outline'}
                                size="sm"
                                leftIcon={<Icon as={option.icon} />}
                                onClick={() => handleSortSelect(option.value as any)}
                              >
                                {option.label}
                              </Button>
                            ))}
                          </SimpleGrid>
                        </Box>
                        
                        <Button 
                          colorScheme="purple" 
                          onClick={onFilterDrawerClose}
                          mt={2}
                        >
                          Apply Filters
                        </Button>
                      </VStack>
                    </DrawerBody>
                  </DrawerContent>
                </Drawer>
                
                <TabPanels>
                  {/* All Chats Panel */}
                  <TabPanel px={0}>
                    {loading ? (
                      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={{ base: 3, md: 6 }}>
                        {[1, 2, 3, ...(isMobile ? [] : [4, 5, 6])].map((_, i) => (
                          <Skeleton key={i} height="200px" borderRadius="lg" />
                        ))}
                      </SimpleGrid>
                    ) : filteredSortedRooms.length > 0 ? (
                      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={{ base: 3, md: 6 }}>
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
                        p={{ base: 4, md: 10 }}
                        textAlign="center"
                        borderRadius="lg"
                        bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                      >
                        <VStack spacing={4}>
                          <Icon as={FaRegComments} boxSize={{ base: 6, md: 10 }} opacity={0.5} />
                          <Text mb={4} fontSize={{ base: "xs", md: "md" }}>
                            {searchQuery 
                              ? `No chat rooms found matching "${searchQuery}"` 
                              : "You don't have any active chats yet"}
                          </Text>
                          <Button
                            colorScheme="purple"
                            onClick={handleCreateChat}
                            size={isMobile ? "sm" : "md"}
                          >
                            Create Your First Chat
                          </Button>
                        </VStack>
                      </MotionBox>
                    )}
                  </TabPanel>
                  
                  {/* Other tabs - P2P Encrypted, Ephemeral, Starred, Archived */}
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
                      isMobile={isMobile}
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
                      isMobile={isMobile}
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
                      isMobile={isMobile}
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
                      isMobile={isMobile}
                    />
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </Box>
          </Box>
          
          {/* Sidebar - Only shown on Desktop or at bottom on mobile if needed */}
          {(!isMobile || !isTablet) && (
            <Box 
              gridArea="sidebar"
              display={{ base: isTablet && !isMobile ? 'none' : 'block', xl: 'block' }}
            >
              <VStack spacing={4} align="stretch">
                <WalletConnectionCard />
                
                {/* Additional sidebar widgets could go here */}
              </VStack>
            </Box>
          )}
        </Grid>
        
        {/* Mobile-only fixed action button for creating new chat */}
        {isMobile && (
          <Box 
            position="fixed" 
            bottom={4} 
            right={4} 
            zIndex={20}
          >
            <Button
              colorScheme="purple"
              boxShadow="lg"
              borderRadius="full"
              width="50px"
              height="50px"
              p={0}
              onClick={handleCreateChat}
            >
              <FaPlus />
            </Button>
          </Box>
        )}
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
  isMobile?: boolean;
}

const ChatRoomsList: React.FC<ChatRoomsListProps> = ({ 
  rooms, 
  loading, 
  onJoinChat, 
  onDeleteRoom, 
  onArchiveRoom, 
  onStarRoom,
  emptyMessage,
  emptyIcon,
  isMobile = false
}) => {
  const { colorMode } = useColorMode();
  
  if (loading) {
    return (
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={{ base: 3, md: 6 }}>
        {[1, 2, 3].map((_, i) => (
          <Skeleton key={i} height="200px" borderRadius="lg" />
        ))}
      </SimpleGrid>
    );
  }
  
  if (rooms.length === 0) {
    return (
      <Box 
        p={isMobile ? 5 : 10} 
        textAlign="center" 
        borderRadius="lg" 
        bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
      >
        <VStack spacing={4}>
          <Icon as={emptyIcon} boxSize={isMobile ? 6 : 10} opacity={0.5} />
          <Text fontSize={isMobile ? "xs" : "md"}>{emptyMessage}</Text>
        </VStack>
      </Box>
    );
  }
  
  return (
    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={{ base: 3, md: 6 }}>
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
