// src/components/settings/EncryptionDiagnostics.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Code,
  Divider,
  Flex,
  Heading,
  Icon,
  Text,
  VStack,
  Badge,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useColorMode,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from '@chakra-ui/react';
import { FaLock, FaCheckCircle, FaTimesCircle, FaInfoCircle, FaBug, FaWrench } from 'react-icons/fa';
import { testEncryptionFormat, findCompatibleEncryptionFormat } from '../../utils/testCrypto';
import { isAesGcmSupported } from '../../utils/cryptoUtils';

interface EncryptionDiagnosticsProps {
  onFixIssue?: (fixType: string) => void;
}

/**
 * Encryption Diagnostics Component
 * 
 * Helps diagnose encryption issues by running tests and providing information
 * about the current browser's encryption capabilities
 */
export const EncryptionDiagnostics: React.FC<EncryptionDiagnosticsProps> = ({ onFixIssue }) => {
  const { colorMode } = useColorMode();
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [aesGcmSupported, setAesGcmSupported] = useState<boolean | null>(null);
  const [recommendedFix, setRecommendedFix] = useState<string | null>(null);
  
  useEffect(() => {
    // Check AES-GCM support on mount
    setAesGcmSupported(isAesGcmSupported());
  }, []);
  
  const runTests = async () => {
    setIsRunningTests(true);
    setTestResults(null);
    
    try {
      // Test both encryption field formats
      const formatResults = await findCompatibleEncryptionFormat();
      
      setTestResults({
        aesGcmSupport: isAesGcmSupported(),
        formatTests: formatResults,
        timestamp: new Date().toISOString(),
      });
      
      // Determine if a fix is recommended
      if (!formatResults.encryptionField && formatResults.encryptionAlgorithmField) {
        setRecommendedFix('use_encryption_algorithm_field');
      } else if (formatResults.encryptionField && !formatResults.encryptionAlgorithmField) {
        setRecommendedFix('use_encryption_field');
      } else if (!formatResults.encryptionField && !formatResults.encryptionAlgorithmField) {
        setRecommendedFix('check_key_length');
      } else {
        setRecommendedFix(null);
      }
    } catch (error) {
      console.error('Error running encryption tests:', error);
      setTestResults({
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      setRecommendedFix('unknown_error');
    } finally {
      setIsRunningTests(false);
    }
  };
  
  const applyFix = () => {
    if (onFixIssue && recommendedFix) {
      onFixIssue(recommendedFix);
    }
  };
  
  return (
    <Box
      p={6}
      borderRadius="lg"
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      boxShadow="md"
      w="100%"
    >
      <VStack spacing={6} align="stretch">
        <Flex align="center">
          <Icon as={FaLock} color="purple.500" boxSize={6} mr={3} />
          <Heading size="md">Encryption Diagnostics</Heading>
        </Flex>
        
        <Alert status={aesGcmSupported ? 'info' : 'warning'} borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle>AES-GCM Support</AlertTitle>
            <AlertDescription>
              {aesGcmSupported 
                ? "Your browser supports AES-GCM encryption, which is required for secure messaging." 
                : "Your browser may not fully support AES-GCM encryption. This could cause communication issues."}
            </AlertDescription>
          </Box>
        </Alert>
        
        <Divider />
        
        <Box>
          <Heading size="sm" mb={4}>Encryption System Status</Heading>
          
          <Flex direction="column" gap={2}>
            <Flex align="center">
              <Icon 
                as={aesGcmSupported ? FaCheckCircle : FaTimesCircle} 
                color={aesGcmSupported ? "green.500" : "red.500"} 
                mr={2} 
              />
              <Text>Web Crypto API with AES-GCM</Text>
              <Badge ml={2} colorScheme={aesGcmSupported ? "green" : "red"}>
                {aesGcmSupported ? "Available" : "Not Available"}
              </Badge>
            </Flex>
            
            <Flex align="center">
              <Icon 
                as={testResults?.formatTests?.encryptionField ? FaCheckCircle : 
                    (testResults === null ? FaInfoCircle : FaTimesCircle)} 
                color={testResults?.formatTests?.encryptionField ? "green.500" : 
                      (testResults === null ? "gray.500" : "red.500")} 
                mr={2} 
              />
              <Text>Encryption using 'encryption' field</Text>
              <Badge ml={2} colorScheme={testResults?.formatTests?.encryptionField ? "green" : 
                         (testResults === null ? "gray" : "red")}>
                {testResults?.formatTests?.encryptionField ? "Works" : 
                 (testResults === null ? "Not Tested" : "Failed")}
              </Badge>
            </Flex>
            
            <Flex align="center">
              <Icon 
                as={testResults?.formatTests?.encryptionAlgorithmField ? FaCheckCircle : 
                    (testResults === null ? FaInfoCircle : FaTimesCircle)} 
                color={testResults?.formatTests?.encryptionAlgorithmField ? "green.500" : 
                      (testResults === null ? "gray.500" : "red.500")} 
                mr={2} 
              />
              <Text>Encryption using 'encryption_algorithm' field</Text>
              <Badge ml={2} colorScheme={testResults?.formatTests?.encryptionAlgorithmField ? "green" : 
                         (testResults === null ? "gray" : "red")}>
                {testResults?.formatTests?.encryptionAlgorithmField ? "Works" : 
                 (testResults === null ? "Not Tested" : "Failed")}
              </Badge>
            </Flex>
            
            {testResults && testResults.formatTests && (
              <Flex align="center" mt={2}>
                <Icon as={FaInfoCircle} color="blue.500" mr={2} />
                <Text>Recommended field name:</Text>
                <Badge ml={2} colorScheme="blue">
                  {testResults.formatTests.recommendedField !== 'unknown' ? 
                    testResults.formatTests.recommendedField : 'None working'}
                </Badge>
              </Flex>
            )}
          </Flex>
        </Box>
        
        {testResults && testResults.error && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Test Error</AlertTitle>
              <AlertDescription>{testResults.error}</AlertDescription>
            </Box>
          </Alert>
        )}
        
        {recommendedFix && (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            <Box flex="1">
              <AlertTitle>Potential Fix Available</AlertTitle>
              <AlertDescription>
                {recommendedFix === 'use_encryption_algorithm_field' && 
                  "The server may be expecting 'encryption_algorithm' instead of 'encryption' in data packets."}
                {recommendedFix === 'use_encryption_field' && 
                  "The server may be expecting 'encryption' instead of 'encryption_algorithm' in data packets."}
                {recommendedFix === 'check_key_length' && 
                  "There may be an issue with the encryption key length or format."}
                {recommendedFix === 'unknown_error' && 
                  "An unknown encryption issue was detected. Try refreshing the page or checking your connection."}
              </AlertDescription>
            </Box>
            <Button 
              ml={2}
              colorScheme="orange"
              leftIcon={<FaWrench />}
              onClick={applyFix}
              size="sm"
            >
              Apply Fix
            </Button>
          </Alert>
        )}
        
        {testResults && (
          <Accordion allowToggle>
            <AccordionItem border="none">
              <AccordionButton px={0}>
                <Box flex="1" textAlign="left">
                  <Text fontWeight="medium" color={colorMode === 'dark' ? 'blue.300' : 'blue.600'}>
                    <Icon as={FaBug} mr={2} />
                    View Detailed Test Results
                  </Text>
                </Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel pb={4} px={0}>
                <Box 
                  bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'} 
                  p={3} 
                  borderRadius="md"
                  overflowX="auto"
                >
                  <Code display="block" whiteSpace="pre" p={2}>
                    {JSON.stringify(testResults, null, 2)}
                  </Code>
                </Box>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        )}
        
        <Divider />
        
        <Flex justify="space-between">
          <Button
            leftIcon={<FaInfoCircle />}
            colorScheme="blue"
            variant="outline"
            onClick={() => window.open('https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt#aes-gcm', '_blank')}
          >
            AES-GCM Info
          </Button>
          
          <Button
            colorScheme="purple"
            onClick={runTests}
            isLoading={isRunningTests}
            loadingText="Running Tests"
            leftIcon={<FaBug />}
          >
            Run Encryption Tests
          </Button>
        </Flex>
      </VStack>
    </Box>
  );
};
