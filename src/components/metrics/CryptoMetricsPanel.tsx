// src/components/metrics/CryptoMetricsPanel.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  Badge,
  Divider,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Button,
  Tooltip,
  Icon,
  useColorMode,
  Progress,
  Grid,
  GridItem,
  HStack,
  VStack,
} from '@chakra-ui/react';
import { 
  FaKey, 
  FaLock, 
  FaShieldAlt, 
  FaExchangeAlt, 
  FaClock, 
  FaBolt, 
  FaFingerprint, 
  FaSyncAlt, 
  FaChartLine, 
  FaServer, 
  FaUserSecret, 
  FaNetworkWired,
  FaRegChartBar,
  FaCheckCircle,
  FaInfoCircle,
  FaCubes,
} from 'react-icons/fa';

interface CryptoMetricsPanelProps {
  chatId: string;
  encryptionType?: 'standard' | 'high' | 'maximum';
  isP2P?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

// Simulated cryptographic metrics for the component
interface CryptoMetrics {
  keyExchanges: number;
  messagesEncrypted: number;
  messageDecrypted: number;
  avgEncryptionTime: number; // in ms
  avgDecryptionTime: number; // in ms
  keyRotations: number;
  lastKeyRotation: Date;
  consensusLevel: number; // percentage
  verifiedSignatures: number;
  keyStrength: number; // bits
  forwardSecrecy: boolean;
  metadataProtection: 'standard' | 'enhanced' | 'maximum';
  p2pLatency: number; // in ms
  shardCount: number;
  blockHeight: number;
}

export const CryptoMetricsPanel: React.FC<CryptoMetricsPanelProps> = ({
  chatId,
  encryptionType = 'high',
  isP2P = false,
  isExpanded = false,
  onToggleExpand,
}) => {
  const { colorMode } = useColorMode();
  const [metrics, setMetrics] = useState<CryptoMetrics>({
    keyExchanges: 0,
    messagesEncrypted: 0,
    messageDecrypted: 0,
    avgEncryptionTime: 0,
    avgDecryptionTime: 0,
    keyRotations: 0,
    lastKeyRotation: new Date(),
    consensusLevel: 0,
    verifiedSignatures: 0,
    keyStrength: 0,
    forwardSecrecy: false,
    metadataProtection: 'standard',
    p2pLatency: 0,
    shardCount: 0,
    blockHeight: 0,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);
  
  // Fetch initial metrics on component mount
  useEffect(() => {
    fetchMetrics();
    
    // Set up interval to update metrics periodically
    const intervalId = setInterval(() => {
      updateRandomMetrics();
    }, 10000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Simulate fetching metrics from the server
  const fetchMetrics = () => {
    setIsRefreshing(true);
    
    // Simulate network delay
    setTimeout(() => {
      // Generate random metrics based on encryption type and p2p status
      const keyStrength = encryptionType === 'standard' ? 256 : 
                         encryptionType === 'high' ? 384 : 512;
                         
      const consensusLevel = Math.floor(Math.random() * 10) + 90; // 90-99%
      
      const metadataProtection = encryptionType === 'standard' ? 'standard' : 
                                encryptionType === 'high' ? 'enhanced' : 'maximum';
      
      const p2pLatency = isP2P ? Math.floor(Math.random() * 50) + 10 : 0; // 10-60ms if P2P
      
      // Random message counts based on a fictional chat history
      const messagesEncrypted = Math.floor(Math.random() * 500) + 100;
      const messageDecrypted = Math.floor(Math.random() * messagesEncrypted);
      
      setMetrics({
        keyExchanges: Math.floor(Math.random() * 20) + 5,
        messagesEncrypted,
        messageDecrypted,
        avgEncryptionTime: Math.floor(Math.random() * 15) + 5, // 5-20ms
        avgDecryptionTime: Math.floor(Math.random() * 12) + 3, // 3-15ms
        keyRotations: Math.floor(Math.random() * 10),
        lastKeyRotation: new Date(Date.now() - Math.floor(Math.random() * 86400000)), // Within last 24h
        consensusLevel,
        verifiedSignatures: Math.floor(Math.random() * 100) + 50,
        keyStrength,
        forwardSecrecy: encryptionType !== 'standard',
        metadataProtection,
        p2pLatency,
        shardCount: Math.floor(Math.random() * 5) + 1,
        blockHeight: Math.floor(Math.random() * 10000) + 90000,
      });
      
      setIsRefreshing(false);
    }, 600);
  };
  
  // Simulate updating random metrics to create a "live" effect
  const updateRandomMetrics = () => {
    setMetrics(prev => {
      // Occasionally increment key exchanges
      const keyExchanges = Math.random() > 0.7 ? prev.keyExchanges + 1 : prev.keyExchanges;
      
      // Frequently increment messages
      const messagesEncrypted = prev.messagesEncrypted + (Math.random() > 0.3 ? 1 : 0);
      const messageDecrypted = prev.messageDecrypted + (Math.random() > 0.3 ? 1 : 0);
      
      // Occasionally increment block height
      const blockHeight = Math.random() > 0.5 ? prev.blockHeight + 1 : prev.blockHeight;
      
      // Vary encryption/decryption times slightly
      const avgEncryptionTime = Math.max(1, prev.avgEncryptionTime + (Math.random() - 0.5));
      const avgDecryptionTime = Math.max(1, prev.avgDecryptionTime + (Math.random() - 0.5));
      
      // Occasionally vary consensus level slightly
      const consensusLevel = Math.min(100, Math.max(90, prev.consensusLevel + (Math.random() - 0.5)));
      
      return {
        ...prev,
        keyExchanges,
        messagesEncrypted,
        messageDecrypted,
        avgEncryptionTime,
        avgDecryptionTime,
        consensusLevel,
        blockHeight,
      };
    });
  };
  
  // Manually refresh metrics
  const refreshMetrics = () => {
    fetchMetrics();
  };
  
  // Format timestamp for last key rotation
  const formatLastRotation = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    }
    
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }
    
    return date.toLocaleString();
  };
  
  // Get encryption algorithm name
  const getEncryptionAlgorithm = () => {
    switch (encryptionType) {
      case 'standard': return 'AES-256-GCM';
      case 'high': return 'ChaCha20-Poly1305';
      case 'maximum': return 'Dual-Layer Encryption';
    }
  };
  
  // Get appropriate colors for metrics
  const getPerformanceColor = (time: number) => {
    if (time < 10) return 'green';
    if (time < 20) return 'yellow';
    return 'orange';
  };
  
  return (
    <Box
      p={4}
      borderRadius="lg"
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      boxShadow="md"
      position="relative"
      overflow="hidden"
    >
      {/* Header */}
      <Flex justify="space-between" align="center" mb={4}>
        <HStack>
          <Icon as={FaKey} color="purple.500" boxSize={5} />
          <Text fontWeight="bold" fontSize="lg">Encryption Metrics</Text>
          <Badge colorScheme={
            encryptionType === 'maximum' ? 'green' :
            encryptionType === 'high' ? 'teal' : 'blue'
          }>
            {encryptionType.charAt(0).toUpperCase() + encryptionType.slice(1)}
          </Badge>
        </HStack>
        
        <HStack>
          <Button
            size="xs"
            leftIcon={<FaSyncAlt />}
            onClick={refreshMetrics}
            isLoading={isRefreshing}
            variant="outline"
            colorScheme="purple"
          >
            Refresh
          </Button>
          
          {onToggleExpand && (
            <Button
              size="xs"
              onClick={onToggleExpand}
              variant="ghost"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          )}
        </HStack>
      </Flex>
      
      {/* Algorithm & Status */}
      <Flex 
        mb={4} 
        p={3} 
        borderRadius="md" 
        bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
        justify="space-between"
        align="center"
      >
        <HStack>
          <Icon as={FaLock} color="green.500" />
          <Text>{getEncryptionAlgorithm()}</Text>
        </HStack>
        
        <HStack>
          {isP2P && (
            <Badge colorScheme="purple">P2P Secured</Badge>
          )}
          
          <Badge colorScheme="green">Active</Badge>
        </HStack>
      </Flex>
      
      {/* Primary Metrics */}
      <Grid templateColumns="repeat(3, 1fr)" gap={4} mb={4}>
        <Stat>
          <StatLabel>Messages Encrypted</StatLabel>
          <StatNumber>{metrics.messagesEncrypted}</StatNumber>
          {metrics.messagesEncrypted > 0 && (
            <StatHelpText>
              <StatArrow type="increase" />
              Growing
            </StatHelpText>
          )}
        </Stat>
        
        <Stat>
          <StatLabel>Avg. Encryption</StatLabel>
          <Flex align="center">
            <StatNumber>{metrics.avgEncryptionTime.toFixed(1)}</StatNumber>
            <Text ml={1}>ms</Text>
          </Flex>
          <Badge colorScheme={getPerformanceColor(metrics.avgEncryptionTime)} mt={1}>
            {metrics.avgEncryptionTime < 8 ? 'Fast' : metrics.avgEncryptionTime < 15 ? 'Good' : 'Normal'}
          </Badge>
        </Stat>
        
        <Stat>
          <StatLabel>Key Strength</StatLabel>
          <Flex align="center">
            <StatNumber>{metrics.keyStrength}</StatNumber>
            <Text ml={1}>bits</Text>
          </Flex>
          <Badge colorScheme={
            metrics.keyStrength >= 512 ? 'green' : 
            metrics.keyStrength >= 384 ? 'teal' : 'blue'
          } mt={1}>
            {metrics.keyStrength >= 512 ? 'Maximum' : metrics.keyStrength >= 384 ? 'High' : 'Standard'}
          </Badge>
        </Stat>
      </Grid>
      
      {/* Consensus & Verification */}
      <Box mb={4}>
        <Flex justify="space-between" align="center" mb={1}>
          <HStack>
            <Icon as={FaFingerprint} color="blue.500" boxSize={3} />
            <Text fontSize="sm">Verification & Consensus</Text>
          </HStack>
          <Text fontSize="sm" fontWeight="medium">{metrics.consensusLevel.toFixed(1)}%</Text>
        </Flex>
        <Progress 
          value={metrics.consensusLevel} 
          size="sm" 
          colorScheme={
            metrics.consensusLevel >= 97 ? 'green' : 
            metrics.consensusLevel >= 93 ? 'teal' : 'blue'
          } 
          borderRadius="full"
        />
      </Box>
      
      <Button 
        variant="link" 
        size="sm" 
        onClick={() => setShowAdvancedMetrics(!showAdvancedMetrics)}
        mb={2}
      >
        {showAdvancedMetrics ? 'Hide Advanced Metrics' : 'Show Advanced Metrics'}
      </Button>
      
      {/* Advanced Metrics */}
      {showAdvancedMetrics && (
        <>
          <Divider mb={4} />
          
          <Grid templateColumns="repeat(3, 1fr)" gap={4} mb={4}>
            <VStack align="start">
              <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>Key Exchanges</Text>
              <Text fontWeight="medium">{metrics.keyExchanges}</Text>
            </VStack>
            
            <VStack align="start">
              <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>Key Rotations</Text>
              <Text fontWeight="medium">{metrics.keyRotations}</Text>
            </VStack>
            
            <VStack align="start">
              <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>Last Rotation</Text>
              <Text fontWeight="medium">{formatLastRotation(metrics.lastKeyRotation)}</Text>
            </VStack>
            
            <VStack align="start">
              <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>Verified Signatures</Text>
              <Text fontWeight="medium">{metrics.verifiedSignatures}</Text>
            </VStack>
            
            <VStack align="start">
              <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>Forward Secrecy</Text>
              <Badge colorScheme={metrics.forwardSecrecy ? 'green' : 'gray'}>
                {metrics.forwardSecrecy ? 'Enabled' : 'Disabled'}
              </Badge>
            </VStack>
            
            <VStack align="start">
              <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>Metadata Protection</Text>
              <Badge colorScheme={
                metrics.metadataProtection === 'maximum' ? 'green' :
                metrics.metadataProtection === 'enhanced' ? 'teal' : 'blue'
              }>
                {metrics.metadataProtection.charAt(0).toUpperCase() + metrics.metadataProtection.slice(1)}
              </Badge>
            </VStack>
          </Grid>
          
          {isP2P && (
            <Box 
              p={3} 
              borderRadius="md" 
              bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
              mb={4}
            >
              <Flex justify="space-between" align="center" mb={2}>
                <HStack>
                  <Icon as={FaNetworkWired} color="purple.500" boxSize={4} />
                  <Text fontWeight="medium">P2P Connection</Text>
                </HStack>
                <Badge colorScheme="green">Connected</Badge>
              </Flex>
              
              <Grid templateColumns="repeat(3, 1fr)" gap={4}>
                <VStack align="start">
                  <HStack>
                    <Icon as={FaBolt} color="orange.500" boxSize={3} />
                    <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>Latency</Text>
                  </HStack>
                  <Text fontWeight="medium">{metrics.p2pLatency} ms</Text>
                </VStack>
                
                <VStack align="start">
                  <HStack>
                    <Icon as={FaCubes} color="teal.500" boxSize={3} />
                    <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>Shards</Text>
                  </HStack>
                  <Text fontWeight="medium">{metrics.shardCount}</Text>
                </VStack>
                
                <VStack align="start">
                  <HStack>
                    <Icon as={FaChartLine} color="blue.500" boxSize={3} />
                    <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>Block Height</Text>
                  </HStack>
                  <Text fontWeight="medium">{metrics.blockHeight.toLocaleString()}</Text>
                </VStack>
              </Grid>
            </Box>
          )}
          
          <HStack spacing={1} justify="center">
            <Icon as={FaInfoCircle} boxSize={3} color={colorMode === 'dark' ? 'gray.400' : 'gray.500'} />
            <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
              All encryption operations occur locally on your device
            </Text>
          </HStack>
        </>
      )}
    </Box>
  );
};
