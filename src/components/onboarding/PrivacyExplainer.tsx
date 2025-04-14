// src/components/onboarding/PrivacyExplainer.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Grid,
  Heading,
  Text,
  VStack,
  Circle,
  useColorMode,
  Fade,
  useTheme,
} from '@chakra-ui/react';
import { FaLock, FaExchangeAlt, FaShieldAlt, FaUserSecret } from 'react-icons/fa';
import { motion } from 'framer-motion';

interface PrivacyExplainerProps {
  onNext: () => void;
}

const MotionBox = motion(Box);
const MotionCircle = motion(Circle);

export const PrivacyExplainer: React.FC<PrivacyExplainerProps> = ({ onNext }) => {
  const { colorMode } = useColorMode();
  const theme = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  
  // Auto-advance through steps
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentStep < 3) {
        setCurrentStep(currentStep + 1);
      } else {
        // After last step, wait and then call onNext
        setTimeout(onNext, 1000);
      }
    }, 3500);
    
    return () => clearTimeout(timer);
  }, [currentStep, onNext]);
  
  const steps = [
    {
      title: "End-to-End Encryption",
      description: "Your messages are encrypted on your device before being sent. Only the intended recipients can decrypt them.",
      icon: FaLock,
      color: "purple.500",
    },
    {
      title: "Secure Key Exchange",
      description: "We use Solana keypairs to securely exchange encryption keys without any third party having access.",
      icon: FaExchangeAlt,
      color: "blue.500",
    },
    {
      title: "Peer-to-Peer Connection",
      description: "When possible, your messages travel directly to recipients without passing through any servers.",
      icon: FaShieldAlt,
      color: "green.500",
    },
    {
      title: "Zero Knowledge Design",
      description: "We can't read your messages, track your conversations, or share your data because we simply don't have access to it.",
      icon: FaUserSecret,
      color: "orange.500",
    }
  ];

  const currentStepData = steps[currentStep];

  // Animation for message exchange
  const messageDotVariants = {
    start: { x: -150, opacity: 0 },
    middle: { x: 0, opacity: 1 },
    end: { x: 150, opacity: 0 }
  };

  return (
    <VStack spacing={12} textAlign="center" width="100%" maxW="800px" mx="auto" p={6}>
      <Heading
        size="xl"
        mb={8}
        bgGradient="linear(to-r, purple.500, blue.500)"
        bgClip="text"
      >
        How AeroNyx Protects Your Privacy
      </Heading>
      
      <Fade in={true} key={currentStep}>
        <Grid
          templateColumns="1fr"
          gap={8}
          p={6}
          borderRadius="xl"
          bg={colorMode === 'dark' ? 'gray.800' : 'white'}
          boxShadow="xl"
          width="100%"
        >
          <VStack spacing={6}>
            <Circle
              size="80px"
              bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
              color={currentStepData.color}
            >
              <Box as={currentStepData.icon} size="40px" />
            </Circle>
            
            <Heading size="lg">{currentStepData.title}</Heading>
            <Text fontSize="lg">{currentStepData.description}</Text>
            
            {/* Visual encryption demo for step 1 */}
            {currentStep === 0 && (
              <Box position="relative" h="60px" w="100%">
                <Flex justify="space-between" w="100%" position="relative">
                  <Circle size="50px" bg={colorMode === 'dark' ? 'gray.700' : 'gray.200'} />
                  <Circle size="50px" bg={colorMode === 'dark' ? 'gray.700' : 'gray.200'} />
                </Flex>
                
                <MotionBox
                  position="absolute"
                  top="15px"
                  left="50%"
                  width="20px"
                  height="20px"
                  borderRadius="full"
                  bg="purple.500"
                  initial="start"
                  animate="end"
                  variants={messageDotVariants}
                  transition={{ duration: 2.5, ease: "easeInOut" }}
                />
                
                <Box
                  position="absolute"
                  top="60px"
                  left="0"
                  right="0"
                  textAlign="center"
                >
                  <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    Encrypted Message
                  </Text>
                </Box>
              </Box>
            )}
            
            {/* Visual key exchange demo for step 2 */}
            {currentStep === 1 && (
              <Box position="relative" h="60px" w="100%">
                <Flex justify="space-between" w="100%" position="relative">
                  <MotionCircle
                    size="50px"
                    bg={colorMode === 'dark' ? 'blue.800' : 'blue.100'}
                    border="2px solid"
                    borderColor="blue.500"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <MotionCircle
                    size="50px"
                    bg={colorMode === 'dark' ? 'blue.800' : 'blue.100'}
                    border="2px solid"
                    borderColor="blue.500"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                  />
                </Flex>
                
                <Box
                  position="absolute"
                  top="60px"
                  left="0"
                  right="0"
                  textAlign="center"
                >
                  <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    Solana Keypair Authentication
                  </Text>
                </Box>
              </Box>
            )}
            
            {/* Visual P2P connection demo for step 3 */}
            {currentStep === 2 && (
              <Box position="relative" h="60px" w="100%">
                <Flex justify="space-between" w="100%" align="center" position="relative">
                  <Circle size="50px" bg={colorMode === 'dark' ? 'gray.700' : 'gray.200'} />
                  
                  <MotionBox
                    w="60%"
                    h="2px"
                    bg={colorMode === 'dark' ? 'green.500' : 'green.400'}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  
                  <Circle size="50px" bg={colorMode === 'dark' ? 'gray.700' : 'gray.200'} />
                </Flex>
                
                <Box
                  position="absolute"
                  top="60px"
                  left="0"
                  right="0"
                  textAlign="center"
                >
                  <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    Direct Peer Connection
                  </Text>
                </Box>
              </Box>
            )}
            
            {/* Visual zero knowledge demo for step 4 */}
            {currentStep === 3 && (
              <Box position="relative" h="60px" w="100%">
                <Flex justify="center" align="center" h="100%">
                  <MotionCircle
                    size="50px"
                    bg={colorMode === 'dark' ? 'orange.800' : 'orange.100'}
                    animate={{ boxShadow: [
                      "0 0 0 rgba(251, 211, 141, 0)",
                      "0 0 20px rgba(251, 211, 141, 0.7)",
                      "0 0 0 rgba(251, 211, 141, 0)",
                    ]}}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Box as={FaUserSecret} size="25px" color="orange.500" />
                  </MotionCircle>
                </Flex>
                
                <Box
                  position="absolute"
                  top="60px"
                  left="0"
                  right="0"
                  textAlign="center"
                >
                  <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    Your Data Remains Private
                  </Text>
                </Box>
              </Box>
            )}
          </VStack>
        </Grid>
      </Fade>
      
      {/* Progress dots */}
      <Flex justify="center" mt={6}>
        {steps.map((_, index) => (
          <Box
            key={index}
            w="10px"
            h="10px"
            borderRadius="full"
            mx={1}
            bg={index === currentStep ? 
              (colorMode === 'dark' ? 'purple.500' : 'purple.500') : 
              (colorMode === 'dark' ? 'gray.600' : 'gray.300')
            }
            transition="background 0.3s ease"
          />
        ))}
      </Flex>
    </VStack>
  );
};
