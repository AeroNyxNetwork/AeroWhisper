// src/components/settings/EncryptionDiagnostics.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  HStack,
  Icon,
  Badge,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Divider,
  Spinner,
  Progress,
  Code,
  useColorMode,
} from '@chakra-ui/react';
import {
  FaCheck,
  FaTimes,
  FaExclamationTriangle,
  FaSync,
  FaBug,
  FaWrench,
  FaQuestionCircle,
} from 'react-icons/fa';
import { isAesGcmSupported } from '../../utils/cryptoUtils';
import { testEncryptionFormat, findCompatibleEncryptionFormat } from '../../utils/testCrypto';

interface EncryptionDiagnosticsProps {
  onFixIssue: (fixType: string) => void;
}

export const EncryptionDiagnostics: React.FC<EncryptionDiagnosticsProps> = ({ onFixIssue }) => {
  const { colorMode } = useColorMode();
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [aesGcmSupported, setAesGcmSupported] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0);
  const [compatibilityResults, setCompatibilityResults] = useState<any>(null);

  // Check for AES-GCM support on component mount
  useEffect(() => {
    const checkSupport = async () => {
      const supported = await isAesGcmSupported();
      setAesGcmSupported(supported);
    };
    
    checkSupport();
  }, []);

  // Run diagnostic tests to identify encryption issues
  const runDiagnostics = async () => {
    setIsRunningTests(true);
    setProgress(0);
    setTestResults(null);
    
    try {
      // Step 1: Check for AES-GCM support
      setProgress(10);
      const aesGcmSupport = await isAesGcmSupported();
      
      // Step 2: Test both field names for compatibility
      setProgress(30);
      const fieldTest1 = await testEncryptionFormat({ test: "Testing with 'encryption' field" }, 'encryption');
      
      setProgress(50);
      const fieldTest2 = await testEncryptionFormat({ test: "Testing with 'encryption_algorithm' field" }, 'encryption_algorithm');
      
      // Step 3: Test key sizes
      setProgress(70);
      
      // Find best field format
      setProgress(90);
      const compatResults = await findCompatibleEncryptionFormat();
      setCompatibilityResults(compatResults);
      
      // Compile results
      setTestResults({
        aesGcmSupport,
        fieldTest1,
        fieldTest2,
        compatibility: compatResults
      });
      
      setProgress(100);
    } catch (error) {
      console.error('Error running diagnostics:', error);
      setTestResults({
        error: true,
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsRunningTests(false);
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
        <HStack justify="space-between">
          <Heading size="md" display="flex" alignItems="center">
            <Icon as={FaBug} mr={2} color="purple.500" /> 
            Encryption Diagnostics
          </Heading>
          <Button
            leftIcon={<Icon as={FaSync} />}
            colorScheme="purple"
            size="sm"
            isLoading={isRunningTests}
            loadingText="Running Tests"
            onClick={runDiagnostics}
          >
            Run Diagnostics
          </Button>
        </HStack>
        
        <Text>
          This tool helps diagnose encryption compatibility issues with your browser and our server.
          If you're experiencing connection problems, run the tests to identify potential fixes.
        </Text>
        
        {/* AES-GCM Support Status */}
        <Box
          bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
          p={4}
          borderRadius="md"
        >
          <HStack>
            <Heading size="sm">AES-GCM Support:</Heading>
            {aesGcmSupported === null ? (
              <Spinner size="sm" />
            ) : aesGcmSupported ? (
              <Badge colorScheme="green" display="flex" alignItems="center">
                <Icon as={FaCheck} mr={1} /> Supported
              </Badge>
            ) : (
              <Badge colorScheme="red" display="flex" alignItems="center">
                <Icon as={FaTimes} mr={1} /> Not Supported
              </Badge>
            )}
          </HStack>
          
          {aesGcmSupported === false && (
            <Alert status="warning" mt={2} size="sm">
              <AlertIcon />
              <Box>
                <AlertTitle fontSize="sm">Browser Compatibility Issue</AlertTitle>
                <AlertDescription fontSize="xs">
                  Your browser doesn't fully support AES-GCM encryption.
                  Consider using a more modern browser like Chrome, Firefox, or Safari.
                </AlertDescription>
              </Box>
            </Alert>
          )}
        </Box>
        
        {/* Diagnostic Results */}
        {isRunningTests && (
          <Box>
            <Text mb={2}>Running encryption tests...</Text>
            <Progress value={progress} colorScheme="purple" hasStripe isAnimated />
          </Box>
        )}
        
        {testResults && !testResults.error && (
          <VStack spacing={4} align="stretch">
            <Heading size="sm">Diagnostic Results:</Heading>
            
            <Box
              bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
              p={4}
              borderRadius="md"
            >
              <VStack align="start" spacing={3}>
                <HStack>
                  <Text fontWeight="medium">Using 'encryption' field:</Text>
                  {testResults.fieldTest1.success ? (
                    <Badge colorScheme="green" display="flex" alignItems="center">
                      <Icon as={FaCheck} mr={1} /> Working
                    </Badge>
                  ) : (
                    <Badge colorScheme="red" display="flex" alignItems="center">
                      <Icon as={FaTimes} mr={1} /> Not Working
                    </Badge>
                  )}
                </HStack>
                
                <HStack>
                  <Text fontWeight="medium">Using 'encryption_algorithm' field:</Text>
                  {testResults.fieldTest2.success ? (
                    <Badge colorScheme="green" display="flex" alignItems="center">
                      <Icon as={FaCheck} mr={1} /> Working
                    </Badge>
                  ) : (
                    <Badge colorScheme="red" display="flex" alignItems="center">
                      <Icon as={FaTimes} mr={1} /> Not Working
                    </Badge>
                  )}
                </HStack>
                
                <Divider />
                
                <Box>
                  <Text fontWeight="medium">Recommended Settings:</Text>
                  <HStack mt={2}>
                    <Badge colorScheme="purple">
                      {testResults.compatibility.recommendedField}
                    </Badge>
                    
                    {testResults.compatibility.recommendedField !== 'unknown' && (
                      <Button
                        size="xs"
                        leftIcon={<Icon as={FaWrench} />}
                        colorScheme="blue"
                        onClick={() => 
                          onFixIssue(testResults.compatibility.recommendedField === 'encryption_algorithm' 
                            ? 'use_encryption_algorithm_field' 
                            : 'use_encryption_field')
                        }
                      >
                        Apply Fix
                      </Button>
                    )}
                  </HStack>
                </Box>
              </VStack>
            </Box>
            
            {!testResults.fieldTest1.success && !testResults.fieldTest2.success && (
              <Alert status="error">
                <AlertIcon />
                <Box>
                  <AlertTitle>Encryption Tests Failed</AlertTitle>
                  <AlertDescription>
                    All encryption tests failed. This might indicate an issue with your browser's
                    Web Crypto API implementation. Try a different browser or check our troubleshooting guide.
                  </AlertDescription>
                  <Button
                    mt={2}
                    size="sm"
                    colorScheme="red"
                    onClick={() => onFixIssue('unknown_error')}
                  >
                    Apply Emergency Fix
                  </Button>
                </Box>
              </Alert>
            )}
            
            {/* Key size tests would go here */}
            <Box>
              <Heading size="sm" mb={2}>Other Potential Fixes:</Heading>
              <Button
                size="sm"
                leftIcon={<Icon as={FaWrench} />}
                colorScheme="teal"
                mr={2}
                onClick={() => onFixIssue('check_key_length')}
              >
                Toggle Key Size (256/128 bits)
              </Button>
            </Box>
          </VStack>
        )}
        
        {testResults && testResults.error && (
          <Alert status="error">
            <AlertIcon />
            <Box>
              <AlertTitle>Error Running Tests</AlertTitle>
              <AlertDescription>
                {testResults.message}
              </AlertDescription>
            </Box>
          </Alert>
        )}
        
        {!isRunningTests && !testResults && (
          <Box textAlign="center" py={4}>
            <Icon as={FaQuestionCircle} boxSize={12} color="gray.400" mb={3} />
            <Text>Press "Run Diagnostics" to test encryption compatibility</Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
};
