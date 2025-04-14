// src/components/chat/RichMediaPreview.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Flex,
  Icon,
  Image,
  Link,
  Skeleton,
  Text,
  useColorMode,
  VStack,
} from '@chakra-ui/react';
import { 
  FaFilePdf,
  FaFileImage,
  FaFileAlt,
  FaFileVideo,
  FaFileAudio,
  FaFile,
  FaDownload,
  FaLock,
  FaUnlock
} from 'react-icons/fa';

interface RichMediaPreviewProps {
  type: 'image' | 'file' | 'link';
  src?: string;
  filename?: string;
  fileSize?: number;
  mimeType?: string;
  fileUrl?: string;
  linkTitle?: string;
  linkDescription?: string;
  linkImage?: string;
  isEncrypted?: boolean;
  onDownload?: () => void;
}

export const RichMediaPreview: React.FC<RichMediaPreviewProps> = ({
  type,
  src,
  filename,
  fileSize,
  mimeType,
  fileUrl,
  linkTitle,
  linkDescription,
  linkImage,
  isEncrypted = true,
  onDownload
}) => {
  const { colorMode } = useColorMode();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Reset loading state when props change
    setIsLoading(true);
    setHasError(false);
  }, [src, fileUrl, linkImage]);

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get file icon based on mime type
  const getFileIcon = () => {
    if (!mimeType) return FaFile;
    
    if (mimeType.startsWith('image/')) return FaFileImage;
    if (mimeType.startsWith('video/')) return FaFileVideo;
    if (mimeType.startsWith('audio/')) return FaFileAudio;
    if (mimeType === 'application/pdf') return FaFilePdf;
    if (mimeType.startsWith('text/')) return FaFileAlt;
    
    return FaFile;
  };

  // Render different preview types
  const renderPreview = () => {
    switch (type) {
      case 'image':
        return (
          <Box
            borderRadius="md"
            overflow="hidden"
            position="relative"
            maxW="300px"
            maxH="200px"
          >
            <Skeleton isLoaded={!isLoading} fadeDuration={1}>
              <Image
                src={src}
                alt={filename || 'Image'}
                maxW="300px"
                maxH="200px"
                objectFit="cover"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                }}
                fallback={
                  <Flex
                    align="center"
                    justify="center"
                    bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
                    p={4}
                    borderRadius="md"
                    width="100%"
                    height="150px"
                  >
                    <Icon as={FaFileImage} boxSize={8} opacity={0.6} />
                    <Text ml={2}>Image preview unavailable</Text>
                  </Flex>
                }
              />
            </Skeleton>
            
            {isEncrypted && (
              <Flex
                position="absolute"
                bottom={2}
                right={2}
                bg={colorMode === 'dark' ? 'blackAlpha.700' : 'whiteAlpha.800'}
                borderRadius="md"
                px={2}
                py={1}
                align="center"
              >
                <Icon as={FaLock} boxSize={3} color="purple.500" mr={1} />
                <Text fontSize="xs">End-to-end encrypted</Text>
              </Flex>
            )}
          </Box>
        );
        
      case 'file':
        return (
          <Flex
            bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
            p={3}
            borderRadius="lg"
            align="center"
            maxW="300px"
          >
            <Box
              bg={colorMode === 'dark' ? 'gray.600' : 'white'}
              p={3}
              borderRadius="md"
              mr={3}
            >
              <Icon 
                as={getFileIcon()} 
                boxSize={6} 
                color={colorMode === 'dark' ? 'purple.300' : 'purple.500'} 
              />
            </Box>
            
            <VStack align="start" spacing={0} flex="1">
              <Text fontWeight="medium" fontSize="sm" noOfLines={1}>
                {filename || 'File'}
              </Text>
              <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                {formatFileSize(fileSize)}
              </Text>
              <Flex align="center" mt={1}>
                <Icon 
                  as={isEncrypted ? FaLock : FaUnlock} 
                  boxSize={2.5} 
                  color={isEncrypted ? 'purple.500' : 'orange.500'} 
                  mr={1} 
                />
                <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                  {isEncrypted ? 'Encrypted' : 'Unencrypted'}
                </Text>
              </Flex>
            </VStack>
            
            <Button
              size="sm"
              variant="ghost"
              colorScheme="purple"
              onClick={onDownload}
              leftIcon={<FaDownload />}
            >
              Save
            </Button>
          </Flex>
        );
        
      case 'link':
        return (
          <Link
            href={fileUrl}
            isExternal
            _hover={{ textDecoration: 'none' }}
          >
            <Flex
              bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
              borderRadius="lg"
              overflow="hidden"
              direction="column"
              maxW="300px"
            >
              {linkImage && (
                <Skeleton isLoaded={!isLoading} height={isLoading ? "100px" : "auto"}>
                  <Image
                    src={linkImage}
                    alt={linkTitle || 'Link preview'}
                    width="100%"
                    height="100px"
                    objectFit="cover"
                    onLoad={() => setIsLoading(false)}
                    onError={() => {
                      setIsLoading(false);
                      setHasError(true);
                    }}
                  />
                </Skeleton>
              )}
              
              <Box p={3}>
                <Text fontWeight="bold" fontSize="sm" mb={1} noOfLines={1}>
                  {linkTitle || fileUrl}
                </Text>
                {linkDescription && (
                  <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'} noOfLines={2}>
                    {linkDescription}
                  </Text>
                )}
                <Text fontSize="xs" color={colorMode === 'dark' ? 'gray.500' : 'gray.500'} mt={1} noOfLines={1}>
                  {new URL(fileUrl || '').hostname}
                </Text>
              </Box>
            </Flex>
          </Link>
        );
        
      default:
        return null;
    }
  };

  return renderPreview();
};
