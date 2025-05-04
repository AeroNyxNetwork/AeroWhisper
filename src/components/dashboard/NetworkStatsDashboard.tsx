import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Flex,
  Grid,
  GridItem,
  Heading,
  Text,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Progress,
  Icon,
  Badge,
  HStack,
  Button,
  useColorMode
} from '@chakra-ui/react';
import {
  FaNetworkWired,
  FaUsers,
  FaLock,
  FaBolt,
  FaShieldAlt,
  FaClock,
  FaExchangeAlt,
  FaChartLine,
  FaServer,
  FaFingerprint,
  FaKey,
  FaSync,
  FaGlobe,
  FaBroadcastTower,
  FaPuzzlePiece,
  FaLink
} from 'react-icons/fa';

interface ActiveNode {
  id: number;
  x: number;
  y: number;
  size: number;
  pulseSpeed: number;
  color: string;
}
// Network Statistics Dashboard with blockchain aesthetics
const NetworkStatsDashboard = () => {
  const { colorMode } = useColorMode();
  const [stats, setStats] = useState({
    activeNodes: 42,
    messagesThroughput: 128,
    encryptionStrength: 96,
    averageLatency: 42, // ms
    participantCount: 217,
    totalMessages: 8731,
    consensusRatio: 97.8, // %
    cpuUtilization: 38, // %
    shardCount: 7,
    cryptoOperations: 3821,
    peakBandwidth: 2.4, // MB/s
    uptime: 99.98 // %
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // List of changing nodes to animate
  const [activeNodeIds, setActiveNodeIds] = useState<ActiveNode[]>([]);
  
  // Update stats every 5 seconds to simulate real-time data
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        activeNodes: Math.max(30, Math.min(60, prev.activeNodes + (Math.random() > 0.5 ? 1 : -1))),
        messagesThroughput: Math.max(80, Math.min(250, prev.messagesThroughput + Math.floor(Math.random() * 10) - 5)),
        averageLatency: Math.max(10, Math.min(100, prev.averageLatency + Math.floor(Math.random() * 6) - 3)),
        consensusRatio: Math.max(90, Math.min(100, prev.consensusRatio + (Math.random() * 0.4) - 0.2)),
        cpuUtilization: Math.max(20, Math.min(80, prev.cpuUtilization + Math.floor(Math.random() * 4) - 2)),
        cryptoOperations: prev.cryptoOperations + Math.floor(Math.random() * 10),
      }));
    }, 5000);
    
    // Cleanup on unmount
    return () => clearInterval(interval);
  }, []);
  
  // Refresh stats manually
  const refreshStats = () => {
    setIsRefreshing(true);
    
    // Simulate request delay
    setTimeout(() => {
      setStats(prev => ({
        ...prev,
        activeNodes: Math.floor(Math.random() * 20) + 35,
        messagesThroughput: Math.floor(Math.random() * 100) + 80,
        encryptionStrength: Math.max(90, Math.min(100, prev.encryptionStrength + (Math.random() * 2) - 1)),
        averageLatency: Math.floor(Math.random() * 40) + 20,
        participantCount: prev.participantCount + Math.floor(Math.random() * 5),
        consensusRatio: Math.max(90, Math.min(100, 95 + (Math.random() * 5))),
        cpuUtilization: Math.floor(Math.random() * 30) + 20,
      }));
      setIsRefreshing(false);
    }, 1000);
  };
  
  // Generate random active nodes for visualization
  useEffect(() => {
    const generateRandomNodes = () => {
      const nodeCount = stats.activeNodes;
      const newActiveNodes = [];
      
      for (let i = 0; i < nodeCount; i++) {
        newActiveNodes.push({
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 3 + 2,
          pulseSpeed: Math.random() * 2 + 1,
          color: Math.random() > 0.7 ? 'purple.500' : 
                Math.random() > 0.5 ? 'teal.500' : 'blue.500'
        });
      }
      
      setActiveNodeIds(newActiveNodes);
    };
    
    generateRandomNodes();
    
    // Update nodes periodically
    const interval = setInterval(generateRandomNodes, 30000);
    return () => clearInterval(interval);
  }, [stats.activeNodes]);
  
  // Format numbers with commas
  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  
  // Get color based on value comparison to thresholds
  const getHealthColor = (value: number, lowThreshold: number, mediumThreshold: number) => {
    if (value >= mediumThreshold) return 'green';
    if (value >= lowThreshold) return 'yellow';
    return 'red';
  };
  
  // Get latency color (inverse - lower is better)
  const getLatencyColor = (value: number) => {
    if (value <= 40) return 'green';
    if (value <= 80) return 'yellow';
    return 'red';
  };
  
  // Get CPU utilization color (inverse - lower is better for resources)
  const getCPUColor = (value: number) => {
    if (value <= 40) return 'green';
    if (value <= 70) return 'yellow';
    return 'red';
  };
  
  return (
    <Box 
      p={5} 
      borderRadius="lg" 
      bg={colorMode === 'dark' ? 'gray.800' : 'white'} 
      boxShadow="md"
      position="relative"
      overflow="hidden"
    >
      {/* Header with refresh */}
      <Flex justify="space-between" align="center" mb={6}>
        <HStack spacing={3}>
          <Icon as={FaNetworkWired} boxSize={6} color="purple.500" />
          <Heading size="md">Network Health & Statistics</Heading>
        </HStack>
        
        <Button
          size="sm"
          leftIcon={<FaSync />}
          onClick={refreshStats}
          isLoading={isRefreshing}
          loadingText="Refreshing"
          colorScheme="purple"
          variant="outline"
        >
          Refresh
        </Button>
      </Flex>
      
      {/* Background decoration */}
      <Box 
        position="absolute" 
        top={0} 
        right={0} 
        bottom={0} 
        width="30%" 
        bgGradient={`linear(to-l, ${colorMode === 'dark' ? 'gray.800' : 'white'}, transparent)`}
        opacity={0.8}
        zIndex={1}
        pointerEvents="none"
      />
      
      {/* Network Node Visualization */}
      <Box 
        position="relative" 
        height="100px" 
        mb={6}
        border="1px dashed" 
        borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.300'}
        borderRadius="md"
        overflow="hidden"
      >
        {/* Background graph lines */}
        {Array.from({ length: 10 }).map((_, i) => (
          <Box 
            key={`h-line-${i}`}
            position="absolute"
            left={0}
            right={0}
            top={`${i * 10}%`}
            height="1px"
            bg={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
            zIndex={0}
          />
        ))}
        
        {Array.from({ length: 10 }).map((_, i) => (
          <Box 
            key={`v-line-${i}`}
            position="absolute"
            top={0}
            bottom={0}
            left={`${i * 10}%`}
            width="1px"
            bg={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
            zIndex={0}
          />
        ))}
        
        {/* Nodes visualization */}
        {activeNodeIds.map((node) => (
          <Box
            key={`node-${node.id}`}
            position="absolute"
            top={`${node.y}%`}
            left={`${node.x}%`}
            width={`${node.size}px`}
            height={`${node.size}px`}
            borderRadius="full"
            bg={node.color}
            zIndex={2}
            sx={{
              animation: `pulse ${node.pulseSpeed}s infinite alternate`,
              '@keyframes pulse': {
                '0%': {
                  transform: 'scale(1)',
                  boxShadow: '0 0 0 0 rgba(157, 0, 255, 0.7)'
                },
                '100%': {
                  transform: 'scale(1.2)',
                  boxShadow: '0 0 0 10px rgba(157, 0, 255, 0)'
                }
              }
            }}
          />
        ))}
        
        {/* Connection lines between random nodes */}
        {activeNodeIds.slice(0, Math.min(activeNodeIds.length, 20)).map((node, index) => {
          const targetIndex = (index + Math.floor(Math.random() * 5) + 1) % activeNodeIds.length;
          const targetNode = activeNodeIds[targetIndex];
          
          if (!targetNode) return null;
          
          return (
            <Box
              key={`conn-${node.id}-${targetNode.id}`}
              position="absolute"
              top="0"
              left="0"
              width="100%"
              height="100%"
              zIndex={1}
              sx={{
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: `${node.y}%`,
                  left: `${node.x}%`,
                  width: `${Math.sqrt(Math.pow(targetNode.x - node.x, 2) + Math.pow(targetNode.y - node.y, 2))}%`,
                  height: '1px',
                  background: colorMode === 'dark' ? 'rgba(129, 86, 255, 0.4)' : 'rgba(128, 90, 213, 0.2)',
                  transformOrigin: '0 0',
                  transform: `rotate(${Math.atan2(targetNode.y - node.y, targetNode.x - node.x) * 180 / Math.PI}deg)`,
                }
              }}
            />
          );
        })}
        
        {/* Network stats labels */}
        <Flex 
          position="absolute" 
          bottom={2} 
          left={3} 
          zIndex={3}
          bg={colorMode === 'dark' ? 'rgba(45, 55, 72, 0.7)' : 'rgba(255, 255, 255, 0.7)'}
          backdropFilter="blur(4px)"
          borderRadius="md"
          px={2}
          py={1}
        >
          <Badge colorScheme="purple" mr={2}>{stats.activeNodes} Nodes</Badge>
          <Badge colorScheme="blue">{stats.shardCount} Shards</Badge>
        </Flex>
      </Box>
      
      {/* Main Stats Grid */}
      <Grid 
        templateColumns="repeat(12, 1fr)" 
        gap={4}
        position="relative"
        zIndex={2}
      >
        {/* Encryption Strength */}
        <GridItem colSpan={{ base: 12, sm: 6, md: 3 }}>
          <Stat>
            <StatLabel display="flex" alignItems="center">
              <Icon as={FaLock} mr={2} color="green.500" />
              Encryption Strength
            </StatLabel>
            <Flex align="center" mt={1}>
              <StatNumber mr={2}>{stats.encryptionStrength}%</StatNumber>
              <Badge colorScheme={getHealthColor(stats.encryptionStrength, 80, 95)}>
                {stats.encryptionStrength > 95 ? 'Maximum' : stats.encryptionStrength > 90 ? 'Strong' : 'Good'}
              </Badge>
            </Flex>
            <Progress 
              value={stats.encryptionStrength} 
              colorScheme={getHealthColor(stats.encryptionStrength, 80, 95)} 
              size="sm" 
              mt={2} 
            />
          </Stat>
        </GridItem>
        
        {/* Network Latency */}
        <GridItem colSpan={{ base: 12, sm: 6, md: 3 }}>
          <Stat>
            <StatLabel display="flex" alignItems="center">
              <Icon as={FaBolt} mr={2} color="orange.500" />
              Avg. Latency
            </StatLabel>
            <Flex align="center" mt={1}>
              <StatNumber mr={2}>{stats.averageLatency} ms</StatNumber>
              <Badge colorScheme={getLatencyColor(stats.averageLatency)}>
                {stats.averageLatency < 30 ? 'Excellent' : stats.averageLatency < 60 ? 'Good' : 'Fair'}
              </Badge>
            </Flex>
            <Progress 
              value={100 - (stats.averageLatency / 2)} 
              colorScheme={getLatencyColor(stats.averageLatency)} 
              size="sm" 
              mt={2} 
            />
          </Stat>
        </GridItem>
        
        {/* Message Throughput */}
        <GridItem colSpan={{ base: 12, sm: 6, md: 3 }}>
          <Stat>
            <StatLabel display="flex" alignItems="center">
              <Icon as={FaExchangeAlt} mr={2} color="blue.500" />
              Messages / Min
            </StatLabel>
            <Flex align="center" mt={1}>
              <StatNumber mr={2}>{stats.messagesThroughput}</StatNumber>
              <Badge colorScheme={getHealthColor(stats.messagesThroughput, 50, 100)}>
                {stats.messagesThroughput > 150 ? 'High Volume' : stats.messagesThroughput > 80 ? 'Normal' : 'Low'}
              </Badge>
            </Flex>
            <StatHelpText>
              Total: {formatNumber(stats.totalMessages)}
            </StatHelpText>
          </Stat>
        </GridItem>
        
        {/* Consensus Ratio */}
        <GridItem colSpan={{ base: 12, sm: 6, md: 3 }}>
          <Stat>
            <StatLabel display="flex" alignItems="center">
              <Icon as={FaFingerprint} mr={2} color="purple.500" />
              Consensus Level
            </StatLabel>
            <Flex align="center" mt={1}>
              <StatNumber mr={2}>{stats.consensusRatio.toFixed(1)}%</StatNumber>
              <Badge colorScheme={getHealthColor(stats.consensusRatio, 90, 95)}>
                {stats.consensusRatio > 99 ? 'Perfect' : stats.consensusRatio > 95 ? 'Excellent' : 'Good'}
              </Badge>
            </Flex>
            <Progress 
              value={stats.consensusRatio} 
              colorScheme={getHealthColor(stats.consensusRatio, 90, 95)} 
              size="sm" 
              mt={2} 
            />
          </Stat>
        </GridItem>
        
        {/* Second row stats */}
        <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
          <Flex 
            p={3} 
            borderRadius="md" 
            bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
            align="center"
          >
            <Icon as={FaUsers} boxSize={5} color="blue.500" mr={3} />
            <Box>
              <Text fontSize="sm" fontWeight="medium">Active Participants</Text>
              <Text fontSize="xl" fontWeight="bold">{formatNumber(stats.participantCount)}</Text>
            </Box>
          </Flex>
        </GridItem>
        
        <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
          <Flex 
            p={3} 
            borderRadius="md" 
            bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
            align="center"
          >
            <Icon as={FaServer} boxSize={5} color="green.500" mr={3} />
            <Box>
              <Text fontSize="sm" fontWeight="medium">CPU Utilization</Text>
              <Flex align="center">
                <Text fontSize="xl" fontWeight="bold" mr={2}>{stats.cpuUtilization}%</Text>
                <Badge colorScheme={getCPUColor(stats.cpuUtilization)}>
                  {stats.cpuUtilization < 30 ? 'Low' : stats.cpuUtilization < 60 ? 'Moderate' : 'High'}
                </Badge>
              </Flex>
            </Box>
          </Flex>
        </GridItem>
        
        <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
          <Flex 
            p={3} 
            borderRadius="md" 
            bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
            align="center"
          >
            <Icon as={FaKey} boxSize={5} color="orange.500" mr={3} />
            <Box>
              <Text fontSize="sm" fontWeight="medium">Crypto Operations</Text>
              <Text fontSize="xl" fontWeight="bold">{formatNumber(stats.cryptoOperations)}</Text>
            </Box>
          </Flex>
        </GridItem>
        
        {/* Third row stats - Uptime & additional metrics */}
        <GridItem colSpan={{ base: 12, md: 6 }}>
          <Flex 
            p={4} 
            borderRadius="md" 
            borderWidth="1px"
            borderColor={colorMode === 'dark' ? 'purple.800' : 'purple.100'}
            bg={colorMode === 'dark' ? 'transparent' : 'white'}
            direction="column"
          >
            <Flex align="center" mb={3}>
              <Icon as={FaChartLine} boxSize={5} color="purple.500" mr={2} />
              <Text fontWeight="medium">Network Health</Text>
            </Flex>
            
            <Grid templateColumns="repeat(2, 1fr)" gap={4}>
              <GridItem>
                <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>Uptime</Text>
                <Flex align="center">
                  <Text fontWeight="bold">{stats.uptime}%</Text>
                  <Icon as={FaShieldAlt} color="green.500" ml={2} boxSize={3} />
                </Flex>
              </GridItem>
              
              <GridItem>
                <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>Peak Bandwidth</Text>
                <Text fontWeight="bold">{stats.peakBandwidth} MB/s</Text>
              </GridItem>
              
              <GridItem>
                <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>Shard Count</Text>
                <Text fontWeight="bold">{stats.shardCount}</Text>
              </GridItem>
              
              <GridItem>
                <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>Network Version</Text>
                <Text fontWeight="bold">v0.9.7-beta</Text>
              </GridItem>
            </Grid>
          </Flex>
        </GridItem>
        
        <GridItem colSpan={{ base: 12, md: 6 }}>
          <Flex 
            height="100%"
            p={4} 
            borderRadius="md" 
            borderWidth="1px"
            borderColor={colorMode === 'dark' ? 'blue.800' : 'blue.100'}
            bg={colorMode === 'dark' ? 'transparent' : 'white'}
            direction="column"
            justify="space-between"
          >
            <Flex align="center" mb={3}>
              <Icon as={FaLink} boxSize={5} color="blue.500" mr={2} />
              <Text fontWeight="medium">Connection Status</Text>
            </Flex>
            
            <Grid templateColumns="repeat(2, 1fr)" gap={4}>
              <GridItem>
                <HStack>
                  <Box 
                    w="8px" 
                    h="8px" 
                    borderRadius="full" 
                    bg="green.500" 
                    boxShadow="0 0 6px #48BB78"
                  />
                  <Text fontSize="sm">P2P Connected</Text>
                </HStack>
              </GridItem>
              
              <GridItem>
                <HStack>
                  <Box 
                    w="8px" 
                    h="8px" 
                    borderRadius="full" 
                    bg="purple.500" 
                    boxShadow="0 0 6px #805AD5"
                  />
                  <Text fontSize="sm">Sharded</Text>
                </HStack>
              </GridItem>
              
              <GridItem>
                <HStack>
                  <Box 
                    w="8px" 
                    h="8px" 
                    borderRadius="full" 
                    bg="blue.500" 
                    boxShadow="0 0 6px #3182CE"
                  />
                  <Text fontSize="sm">End-to-End Encrypted</Text>
                </HStack>
              </GridItem>
              
              <GridItem>
                <HStack>
                  <Box 
                    w="8px" 
                    h="8px" 
                    borderRadius="full" 
                    bg="green.500" 
                    boxShadow="0 0 6px #48BB78"
                  />
                  <Text fontSize="sm">Forward Secrecy</Text>
                </HStack>
              </GridItem>
            </Grid>
            
            <HStack mt={3} justify="flex-end">
              <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                Last Updated: {new Date().toLocaleTimeString()}
              </Text>
              <Badge colorScheme="green">Healthy</Badge>
            </HStack>
          </Flex>
        </GridItem>
      </Grid>
    </Box>
  );
};

export default NetworkStatsDashboard;
