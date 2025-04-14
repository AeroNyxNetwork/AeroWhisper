// src/components/chat/FileTransfer.tsx
import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Flex,
  FormLabel,
  Icon,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Progress,
  Text,
  useColorMode,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { 
  FaFile, 
  FaFileImage, 
  FaFileAlt, 
  FaFilePdf, 
  FaFileArchive,
  FaFileCode,
  FaLock,
  FaUpload
} from 'react-icons/fa';

interface FileTransferProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (file: File, encryptionEnabled: boolean) => Promise<void>;
  chatId: string;
}

export const FileTransfer: React.FC<FileTransferProps> = ({
  isOpen,
  onClose,
  onFileSelect,
  chatId
}) => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Size limit check (20 MB)
      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 20 MB",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const getFileIcon = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    if (file.type.startsWith('image/')) return FaFileImage;
    if (file.type.startsWith('text/')) return FaFileAlt;
    if (file.type === 'application/pdf') return FaFilePdf;
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return FaFileArchive;
    if (['js', 'html', 'css', 'py', 'java', 'ts', 'tsx', 'jsx', 'c', 'cpp', 'php'].includes(ext || '')) return FaFileCode;
    
    return FaFile;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    
    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        const newProgress = prev + (10 * Math.random());
        return newProgress > 95 ? 95 : newProgress;
      });
    }, 200);
    
    try {
      await onFileSelect(selectedFile, encryptionEnabled);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      toast({
        title: "File uploaded successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      // Reset and close after a short delay
      setTimeout(() => {
        setSelectedFile(null);
        setUploadProgress(0);
        setIsUploading(false);
        onClose();
      }, 1000);
    } catch (error) {
      clearInterval(progressInterval);
      
      toast({
        title: "Upload failed",
        description: "Could not upload the file. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      
      setUploadProgress(0);
      setIsUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay backdropFilter="blur(5px)" />
      <ModalContent
        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
        borderRadius="xl"
        boxShadow="xl"
      >
        <ModalHeader>Send Encrypted File</ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={6}>
            <Box
              w="100%"
              h="150px"
              border="2px dashed"
              borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.300'}
              borderRadius="lg"
              display="flex"
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              onClick={() => fileInputRef.current?.click()}
              _hover={{
                borderColor: colorMode === 'dark' ? 'purple.400' : 'purple.500',
              }}
              position="relative"
              overflow="hidden"
            >
              <Input
                type="file"
                ref={fileInputRef}
                hidden
                onChange={handleFileChange}
                disabled={isUploading}
              />
              
              {selectedFile ? (
                <Flex direction="column" align="center" p={4}>
                  <Icon as={getFileIcon(selectedFile)} boxSize={10} color="purple.500" mb={2} />
                  <Text fontWeight="medium" noOfLines={1} maxW="90%">
                    {selectedFile.name}
                  </Text>
                  <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    {formatFileSize(selectedFile.size)}
                  </Text>
                </Flex>
              ) : (
                <Flex direction="column" align="center">
                  <Icon as={FaUpload} boxSize={8} color={colorMode === 'dark' ? 'gray.400' : 'gray.500'} mb={2} />
                  <Text fontWeight="medium">Click to select a file</Text>
                  <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}>
                    or drag and drop here
                  </Text>
                </Flex>
              )}
            </Box>
            
            {isUploading && (
              <Box w="100%">
                <Progress 
                  value={uploadProgress} 
                  colorScheme="purple" 
                  borderRadius="full"
                  size="sm"
                  hasStripe={uploadProgress < 100}
                  isAnimated={uploadProgress < 100}
                />
                <Text fontSize="sm" textAlign="center" mt={1}>
                  {uploadProgress < 100 
                    ? `Uploading... ${Math.round(uploadProgress)}%` 
                    : "Upload complete!"}
                </Text>
              </Box>
            )}
            
            <Flex 
              align="center" 
              w="100%" 
              p={3} 
              bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
              borderRadius="md"
            >
              <Icon as={FaLock} color="purple.500" boxSize={5} mr={3} />
              <Box flex="1">
                <Text fontWeight="medium">End-to-End Encryption</Text>
                <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
                  Files are encrypted before upload for maximum privacy
                </Text>
              </Box>
              <FormLabel htmlFor="encryption-toggle" mb="0">
                <Input
                  id="encryption-toggle"
                  type="checkbox"
                  checked={encryptionEnabled}
                  onChange={() => setEncryptionEnabled(!encryptionEnabled)}
                  hidden
                />
                <Box
                  w="40px"
                  h="20px"
                  borderRadius="full"
                  bg={encryptionEnabled ? 'purple.500' : colorMode === 'dark' ? 'gray.600' : 'gray.300'}
                  position="relative"
                  transition="all 0.2s"
                  cursor="pointer"
                >
                  <Box
                    position="absolute"
                    top="2px"
                    left={encryptionEnabled ? "calc(100% - 18px)" : "2px"}
                    w="16px"
                    h="16px"
                    borderRadius="full"
                    bg="white"
                    transition="all 0.2s"
                  />
                </Box>
              </FormLabel>
            </Flex>
          </VStack>
        </ModalBody>
        
        <ModalFooter>
          <Button variant="outline" mr={3} onClick={onClose} isDisabled={isUploading}>
            Cancel
          </Button>
          <Button
            colorScheme="purple"
            onClick={handleUpload}
            isDisabled={!selectedFile || isUploading}
            isLoading={isUploading}
            loadingText="Encrypting & Uploading"
          >
            Send File
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
