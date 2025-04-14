// src/components/chat/EnhancedMessage.tsx
import React, { useState } from 'react';
import { 
  Box, 
  Text, 
  Flex, 
  Avatar, 
  useColorMode, 
  Tooltip, 
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Divider,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  ButtonGroup,
  Button,
} from '@chakra-ui/react';
import { 
  FaReply, 
  FaEllipsisV, 
  FaCopy, 
  FaTrash, 
  FaEdit,
  FaForward,
  FaCheck,
  FaCheckDouble,
  FaClock,
  FaBan,
  FaStar,
  FaShare,
  FaLock,
} from 'react-icons/fa';
import { formatDistanceToNow, format } from 'date-fns';
import { motion } from 'framer-motion';
import { MessageType } from '../../types/chat';
import { useAuth } from '../../contexts/AuthContext';
import { MessageReactions } from './MessageReactions';
import { ReadReceipts, MessageStatus } from './ReadReceipts';
import { RichMediaPreview } from './RichMediaPreview';

interface EnhancedMessageProps {
  message: MessageType;
  previousMessage?: MessageType | null;
  showAvatar?: boolean;
  isInThread?: boolean;
  onReply?: (messageId: string) => void;
  onForward?: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onReaction?: (messageId: string, reaction: string) => void;
}

const MotionBox = motion(Box);

export const EnhancedMessage: React.FC<EnhancedMessageProps> = ({
  message,
  previousMessage = null,
  showAvatar = true,
  isInThread = false,
  onReply,
  onForward,
  onEdit,
  onDelete,
  onReaction,
}) => {
  const { colorMode } = useColorMode();
  const { user } = useAuth();
  
  const [showDetails, setShowDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [isHovered, setIsHovered] = useState(false);
  
  // Determine if this is the current user's message
  const isOwnMessage = message.senderId === user?.id;
  
  // Convert timestamp to Date if it's a string or number
  const messageDate = typeof message.timestamp === 'string' || typeof message.timestamp === 'number' 
    ? new Date(message.timestamp) 
    : message.timestamp;
  
  // Calculate relative time (e.g., "5 minutes ago")
  const timeAgo = formatDistanceToNow(messageDate, { addSuffix: true });
  
  // Format exact time (e.g., "3:45 PM")
  const exactTime = format(messageDate, 'h:mm a');
  
  // Format full date for tooltip (e.g., "Monday, January 1, 2023 at 3:45 PM")
  const fullDateTime = format(messageDate, 'EEEE, MMMM d, yyyy \'at\' h:mm a');
  
  // Check if this is a media message
  const hasMedia = message.metaData?.mediaType !== undefined;
  
  // Check if this message should have a time header (if more than 15 minutes from previous)
  const shouldShowTimeHeader = () => {
    if (!previousMessage) return true;
    
    const prevDate = typeof previousMessage.timestamp === 'string' || typeof previousMessage.timestamp === 'number'
      ? new Date(previousMessage.timestamp)
      : previousMessage.timestamp;
    
    // Show header if messages are more than 15 minutes apart
    return messageDate.getTime() - prevDate.getTime() > 15 * 60 * 1000;
  };
  
  // Handle message copy
  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
  };
  
  // Handle reply
  const handleReply = () => {
    if (onReply) onReply(message.id);
  };
  
  // Handle forward
  const handleForward = () => {
    if (onForward) onForward(message.id);
  };
  
  // Handle edit
  const handleEdit = () => {
    if (isOwnMessage && onEdit) {
      setIsEditing(true);
      setEditText(message.content);
    }
  };
  
  // Save edited message
  const handleSaveEdit = () => {
    if (onEdit && editText.trim() !== '') {
      onEdit(message.id);
      setIsEditing(false);
    }
  };
  
  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText(message.content);
  };
  
  // Handle delete
  const handleDelete = () => {
    if (isOwnMessage && onDelete) {
      setIsDeleting(true);
    }
  };
  
  // Confirm delete
  const handleConfirmDelete = () => {
    if (onDelete) {
      onDelete(message.id);
      setIsDeleting(false);
    }
  };
  
  // Cancel delete
  const handleCancelDelete = () => {
    setIsDeleting(false);
  };
  
  // Handle reaction
  const handleReaction = (reaction: string) => {
    if (onReaction) {
      onReaction(message.id, reaction);
    }
  };
  
  // Get message actions menu
  const renderMessageActions = () => (
    <Menu isLazy placement="bottom-end">
      <MenuButton
        as={IconButton}
        icon={<FaEllipsisV />}
        variant="ghost"
        size="sm"
        aria-label="Message options"
        opacity={isHovered ? 0.8 : 0}
        _groupHover={{ opacity: 0.8 }}
        transition="opacity 0.2s"
      />
      <MenuList>
        <MenuItem icon={<FaReply />} onClick={handleReply}>
          Reply
        </MenuItem>
        <MenuItem icon={<FaForward />} onClick={handleForward}>
          Forward
        </MenuItem>
        <MenuItem icon={<FaCopy />} onClick={handleCopy}>
          Copy Text
        </MenuItem>
        {isOwnMessage && (
          <>
            <Divider />
            <MenuItem icon={<FaEdit />} onClick={handleEdit}>
              Edit Message
            </MenuItem>
            <MenuItem icon={<FaTrash />} onClick={handleDelete} color="red.500">
              Delete Message
            </MenuItem>
          </>
        )}
      </MenuList>
    </Menu>
  );
  
  // Render media content if present
  const renderMedia = () => {
    if (!hasMedia) return null;
    
    const mediaType = message.metaData?.mediaType;
    const mediaUrl = message.metaData?.mediaUrl;
    const fileName = message.metaData?.fileName;
    const fileSize = message.metaData?.fileSize;
    const mimeType = message.metaData?.mimeType;
    
    if (mediaType === 'image') {
      return (
        <RichMediaPreview
          type="image"
          src={mediaUrl}
          filename={fileName}
          fileSize={fileSize}
          mimeType={mimeType}
          isEncrypted={message.isEncrypted}
        />
      );
    } else if (mediaType === 'file') {
      return (
        <RichMediaPreview
          type="file"
          fileUrl={mediaUrl}
          filename={fileName}
          fileSize={fileSize}
          mimeType={mimeType}
          isEncrypted={message.isEncrypted}
        />
      );
    } else if (mediaType === 'link') {
      return (
        <RichMediaPreview
          type="link"
          fileUrl={mediaUrl}
          linkTitle={message.metaData?.linkTitle}
          linkDescription={message.metaData?.linkDescription}
          linkImage={message.metaData?.linkImage}
        />
      );
    }
    
    return null;
  };
  
  return (
    <Box mb={4} role="group">
      {/* Time header */}
      {shouldShowTimeHeader() && (
        <Flex justify="center" mb={3}>
          <Text
            fontSize="xs"
            px={2}
            py={1}
            borderRadius="md"
            bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
            color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}
          >
            {format(messageDate, 'EEEE, MMMM d')} • {exactTime}
          </Text>
        </Flex>
      )}
      
      {/* Message sender name (for non-own messages) */}
      {!isOwnMessage && showAvatar && message.senderName && (
        <Text 
          fontSize="xs" 
          ml={12} 
          mb={1}
          color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}
        >
          {message.senderName}
        </Text>
      )}
      
      {/* Main message container */}
      <Flex
        direction="column"
        alignSelf={isOwnMessage ? 'flex-end' : 'flex-start'}
        maxW={{ base: '80%', md: '70%' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Flex align="flex-end">
          {/* Avatar for other's messages */}
          {!isOwnMessage && showAvatar && (
            <Avatar 
              size="sm" 
              name={message.senderName || 'Unknown'} 
              mr={2} 
              bg="purple.500"
            />
          )}
          
          <MotionBox 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            position="relative"
          >
            {/* Message actions menu */}
            <Box
              position="absolute"
              top={-4}
              right={isOwnMessage ? 0 : 'auto'}
              left={isOwnMessage ? 'auto' : 0}
              zIndex={1}
            >
              {renderMessageActions()}
            </Box>
            
            {/* Message bubble */}
            <Box
              bg={isOwnMessage 
                ? (colorMode === 'dark' ? 'purple.600' : 'purple.500') 
                : (colorMode === 'dark' ? 'gray.700' : 'gray.200')
              }
              color={isOwnMessage 
                ? 'white' 
                : (colorMode === 'dark' ? 'white' : 'gray.800')
              }
              px={4}
              py={2}
              borderRadius="lg"
              borderBottomLeftRadius={!isOwnMessage ? 0 : undefined}
              borderBottomRightRadius={isOwnMessage ? 0 : undefined}
              onClick={() => setShowDetails(!showDetails)}
              cursor="pointer"
              _hover={{
                bg: isOwnMessage 
                  ? (colorMode === 'dark' ? 'purple.500' : 'purple.400') 
                  : (colorMode === 'dark' ? 'gray.600' : 'gray.300')
              }}
              position="relative"
            >
              {/* Message content */}
              {isEditing ? (
                <Flex direction="column">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    style={{
                      background: 'transparent',
                      color: 'inherit',
                      border: '1px solid',
                      borderColor: colorMode === 'dark' ? 'gray.600' : 'gray.300',
                      borderRadius: '4px',
                      padding: '8px',
                      width: '100%',
                      minHeight: '60px',
                      resize: 'vertical',
                      marginBottom: '8px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Flex justify="flex-end" gap={2}>
                    <Button size="xs" onClick={handleCancelEdit} variant="ghost">
                      Cancel
                    </Button>
                    <Button size="xs" colorScheme="green" onClick={handleSaveEdit}>
                      Save
                    </Button>
                  </Flex>
                </Flex>
              ) : isDeleting ? (
                <Flex direction="column">
                  <Text mb={2}>Are you sure you want to delete this message?</Text>
                  <Flex justify="flex-end" gap={2}>
                    <Button size="xs" onClick={handleCancelDelete} variant="ghost">
                      Cancel
                    </Button>
                    <Button size="xs" colorScheme="red" onClick={handleConfirmDelete}>
                      Delete
                    </Button>
                  </Flex>
                </Flex>
              ) : (
                <>
                  <Text mb={1}>{message.content}</Text>
                  {renderMedia()}
                </>
              )}
              
              {/* Message metadata */}
              <Flex 
                justify="flex-end" 
                align="center"
                opacity={0.7}
                fontSize="xs"
                mt={1}
              >
                <Tooltip label={fullDateTime}>
                  <Text mr={1}>{timeAgo}</Text>
                </Tooltip>
                
                {/* Read receipt status */}
                {isOwnMessage && (
                  <ReadReceipts 
                    status={message.status || 'sent'}
                    timestamp={messageDate}
                  />
                )}
              </Flex>
              
              {/* Encryption indicator */}
              {message.isEncrypted && (
                <Tooltip label="End-to-end encrypted" placement="top">
                  <Box
                    position="absolute"
                    bottom={1}
                    left={isOwnMessage ? -4 : undefined}
                    right={!isOwnMessage ? -4 : undefined}
                    fontSize="10px"
                  >
                    <Icon as={FaLock} boxSize={2} />
                  </Box>
                </Tooltip>
              )}
            </Box>
          </MotionBox>
          
          {/* Avatar for own messages */}
          {isOwnMessage && showAvatar && (
            <Avatar 
              size="sm" 
              name={user?.displayName || 'Me'} 
              ml={2}
              bg="purple.600"
            />
          )}
        </Flex>
        
        {/* Message details (shown when clicked) */}
        {showDetails && (
          <Box 
            mt={1} 
            fontSize="xs" 
            alignSelf={isOwnMessage ? 'flex-end' : 'flex-start'}
            mx={2}
            px={2}
            py={1}
            bg={colorMode === 'dark' ? 'gray.700' : 'gray.100'}
            borderRadius="md"
          >
            <Text>
              Sent: {messageDate.toLocaleString()}
            </Text>
            {message.metaData && message.metaData.encryptionType && (
              <Text>
                Encryption: {message.metaData.encryptionType}
              </Text>
            )}
            {message.metaData && message.metaData.isP2P && (
              <Text>
                Connection: Peer-to-Peer
              </Text>
            )}
          </Box>
        )}
        
        {/* Message reactions */}
        <MessageReactions
          messageId={message.id}
          existingReactions={message.metaData?.reactions || []}
          onAddReaction={handleReaction}
          isOwnMessage={isOwnMessage}
        />
      </Flex>
    </Box>
  );
};
