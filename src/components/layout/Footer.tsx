// src/components/layout/Footer.tsx
import React from 'react';
import { Box, Flex, Text, Link, useColorMode, HStack, Icon } from '@chakra-ui/react';
import { FaGithub, FaShieldAlt } from 'react-icons/fa';

export const Footer: React.FC = () => {
  const { colorMode } = useColorMode();
  
  return (
    <Box
      as="footer"
      py={6}
      px={6}
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      borderTop="1px solid"
      borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
    >
      <Flex 
        direction={{ base: 'column', md: 'row' }}
        align={{ base: 'center', md: 'center' }}
        justify="space-between"
        maxW="1200px"
        mx="auto"
      >
        <Flex 
          direction={{ base: 'column', md: 'row' }}
          align="center"
          mb={{ base: 4, md: 0 }}
        >
          <HStack mr={2} mb={{ base: 2, md: 0 }}>
            <Icon as={FaShieldAlt} color="purple.500" boxSize={4} />
            <Text fontWeight="bold" bgGradient="linear(to-r, purple.500, blue.500)" bgClip="text">
              AeroNyx
            </Text>
          </HStack>
          <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
            Secure, end-to-end encrypted messaging
          </Text>
        </Flex>
        
        <HStack spacing={4}>
          <Link 
            href="#" 
            isExternal
            fontSize="sm"
            color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}
            _hover={{
              color: colorMode === 'dark' ? 'white' : 'gray.800',
              textDecoration: 'none',
            }}
          >
            Privacy Policy
          </Link>
          
          <Link 
            href="#" 
            isExternal
            fontSize="sm"
            color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}
            _hover={{
              color: colorMode === 'dark' ? 'white' : 'gray.800',
              textDecoration: 'none',
            }}
          >
            Terms of Service
          </Link>
          
          <Link 
            href="https://github.com" 
            isExternal
            fontSize="sm"
            display="flex"
            alignItems="center"
            color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}
            _hover={{
              color: colorMode === 'dark' ? 'white' : 'gray.800',
              textDecoration: 'none',
            }}
          >
            <Icon as={FaGithub} mr={1} />
            <Text>GitHub</Text>
          </Link>
        </HStack>
      </Flex>
      
      <Text 
        mt={4} 
        fontSize="xs" 
        textAlign="center"
        color={colorMode === 'dark' ? 'gray.500' : 'gray.400'}
      >
        &copy; {new Date().getFullYear()} AeroNyx. All rights reserved.
      </Text>
    </Box>
  );
};
