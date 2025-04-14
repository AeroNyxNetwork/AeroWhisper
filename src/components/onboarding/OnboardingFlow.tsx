// src/components/onboarding/OnboardingFlow.tsx
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  useColorMode,
  IconButton,
  HStack,
  VStack,
  Progress,
} from '@chakra-ui/react';
import { FaArrowLeft, FaArrowRight, FaTimes } from 'react-icons/fa';
import { PrivacyExplainer } from './PrivacyExplainer';
import { WalletOptions } from './WalletOptions';
import { useAuth } from '../../contexts/AuthContext';

// Define the steps of the onboarding process
enum OnboardingStep {
  WELCOME,
  PRIVACY_EXPLAINER,
  WALLET_CONNECTION,
  COMPLETE
}

export const OnboardingFlow: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(OnboardingStep.WELCOME);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { colorMode } = useColorMode();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  
  // Skip to dashboard if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  // Total number of steps
  const totalSteps = Object.keys(OnboardingStep).length / 2;
  
  // Calculate progress percentage
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const nextStep = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentStep(prev => prev + 1);
      setIsTransitioning(false);
    }, 300);
  };

  const prevStep = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentStep(prev => prev - 1);
      setIsTransitioning(false);
    }, 300);
  };

  const skipOnboarding = () => {
    router.push('/auth/connect-wallet');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case OnboardingStep.WELCOME:
        return (
          <VStack spacing={8} textAlign="center" maxW="600px" mx="auto" p={6}>
            <Heading 
              size="2xl"
              bgGradient="linear(to-r, purple.500, blue.500)"
              bgClip="text"
              letterSpacing="tight"
            >
              Welcome to AeroNyx
            </Heading>
            <Text fontSize="xl" lineHeight="tall">
              Your secure, end-to-end encrypted messaging platform with military-grade privacy protection.
            </Text>
            <Box mt={4}>
              <Button
                size="lg"
                colorScheme="purple"
                onClick={nextStep}
                rightIcon={<FaArrowRight />}
                px={8}
              >
                Get Started
              </Button>
            </Box>
          </VStack>
        );
        
      case OnboardingStep.PRIVACY_EXPLAINER:
        return <PrivacyExplainer onNext={nextStep} />;
        
      case OnboardingStep.WALLET_CONNECTION:
        return <WalletOptions onComplete={() => setCurrentStep(OnboardingStep.COMPLETE)} />;
        
      case OnboardingStep.COMPLETE:
        return (
          <VStack spacing={8} textAlign="center" maxW="600px" mx="auto" p={6}>
            <Heading 
              size="2xl"
              bgGradient="linear(to-r, purple.500, blue.500)"
              bgClip="text"
            >
              You're All Set!
            </Heading>
            <Text fontSize="xl">
              Your secure communication journey begins now. Start creating or joining encrypted chats.
            </Text>
            <Box mt={4}>
              <Button
                size="lg"
                colorScheme="purple"
                onClick={() => router.push('/dashboard')}
                px={8}
              >
                Go to Dashboard
              </Button>
            </Box>
          </VStack>
        );
    }
  };

  return (
    <Box
      minH="100vh"
      w="100%"
      bg={colorMode === 'dark' ? 'gray.900' : 'gray.50'}
      position="relative"
    >
      {/* Skip button */}
      {currentStep !== OnboardingStep.COMPLETE && (
        <IconButton
          aria-label="Skip onboarding"
          icon={<FaTimes />}
          position="absolute"
          top={4}
          right={4}
          variant="ghost"
          onClick={skipOnboarding}
        />
      )}
      
      {/* Progress bar */}
      <Progress
        value={progress}
        size="sm"
        colorScheme="purple"
        bg={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
        position="absolute"
        top={0}
        left={0}
        right={0}
      />
      
      <Flex
        direction="column"
        justify="center"
        align="center"
        minH="calc(100vh - 4px)" // Account for progress bar
        opacity={isTransitioning ? 0.5 : 1}
        transition="opacity 0.3s ease"
      >
        {renderStepContent()}
      </Flex>
      
      {/* Navigation buttons */}
      {currentStep !== OnboardingStep.WELCOME && 
       currentStep !== OnboardingStep.COMPLETE && (
        <HStack
          position="absolute"
          bottom={8}
          left="50%"
          transform="translateX(-50%)"
          spacing={4}
        >
          <Button
            leftIcon={<FaArrowLeft />}
            variant="ghost"
            onClick={prevStep}
          >
            Back
          </Button>
          
          {currentStep !== OnboardingStep.WALLET_CONNECTION && (
            <Button
              rightIcon={<FaArrowRight />}
              colorScheme="purple"
              onClick={nextStep}
            >
              Next
            </Button>
          )}
        </HStack>
      )}
    </Box>
  );
};
