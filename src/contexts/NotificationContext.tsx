// src/contexts/NotificationContext.tsx
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useToast } from '@chakra-ui/react';
import { useAuth } from './AuthContext';

// Notification settings interface
interface NotificationSettings {
  enableNotifications: boolean;
  notificationSound: 'standard' | 'subtle' | 'energetic' | 'none';
  notifyOnAllMessages: boolean;
  notifyOnMentions: boolean;
  notifyOnDirectMessages: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // Format: 'HH:MM'
  quietHoursEnd: string; // Format: 'HH:MM'
  showPreview: boolean;
  vibrate: boolean;
}

// Message type for notifications
interface NotificationMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  chatId: string;
  chatName: string;
  timestamp: string;
  isDirectMessage: boolean;
  hasMention: boolean;
}

interface NotificationContextType {
  settings: NotificationSettings;
  updateSettings: (newSettings: Partial<NotificationSettings>) => void;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
  showNotification: (message: NotificationMessage) => void;
  notificationsSupported: boolean;
  unreadCount: number;
  clearUnread: () => void;
  markChatAsRead: (chatId: string) => void;
  getUnreadCountForChat: (chatId: string) => number;
  mute: (chatId: string, duration?: number) => void;
  unmute: (chatId: string) => void;
  isMuted: (chatId: string) => boolean;
}

// Default notification settings
const defaultSettings: NotificationSettings = {
  enableNotifications: false,
  notificationSound: 'standard',
  notifyOnAllMessages: false,
  notifyOnMentions: true,
  notifyOnDirectMessages: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  showPreview: true,
  vibrate: true,
};

const NotificationContext = createContext<NotificationContextType>({
  settings: defaultSettings,
  updateSettings: () => {},
  hasPermission: false,
  requestPermission: async () => false,
  showNotification: () => {},
  notificationsSupported: false,
  unreadCount: 0,
  clearUnread: () => {},
  markChatAsRead: () => {},
  getUnreadCountForChat: () => 0,
  mute: () => {},
  unmute: () => {},
  isMuted: () => false,
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toast = useToast();
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [hasPermission, setHasPermission] = useState(false);
  const [notificationsSupported, setNotificationsSupported] = useState(false);
  
  // Unread message tracking
  const [unreadMessages, setUnreadMessages] = useState<Record<string, NotificationMessage[]>>({});
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Muted chats with expiry timestamps
  const [mutedChats, setMutedChats] = useState<Record<string, number | null>>({});
  
  // Sound elements for notifications
  const [notificationSounds] = useState({
    standard: new Audio('/sounds/notification-standard.mp3'),
    subtle: new Audio('/sounds/notification-subtle.mp3'),
    energetic: new Audio('/sounds/notification-energetic.mp3')
  });

  // Initialize notification support and load settings
  useEffect(() => {
    const supported = 'Notification' in window;
    setNotificationsSupported(supported);
    
    if (supported) {
      setHasPermission(Notification.permission === 'granted');
      
      // Load saved settings
      try {
        const savedSettings = localStorage.getItem('aero-notification-settings');
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        }
      } catch (error) {
        console.error('Failed to load notification settings:', error);
      }
      
      // Load muted chats
      try {
        const savedMutedChats = localStorage.getItem('aero-muted-chats');
        if (savedMutedChats) {
          const parsedMutedChats: Record<string, number | null> = JSON.parse(savedMutedChats);
          
          // Filter out expired mutes
          const now = Date.now();
          const validMutedChats = Object.entries(parsedMutedChats).reduce((acc, [chatId, expiry]) => {
            if (expiry === null || expiry > now) {
              acc[chatId] = expiry;
            }
            return acc;
          }, {} as Record<string, number | null>);
          
          setMutedChats(validMutedChats);
        }
      } catch (error) {
        console.error('Failed to load muted chats:', error);
      }
    }
  }, []);
  
  // Update unread count whenever unreadMessages changes
  useEffect(() => {
    const total = Object.values(unreadMessages).reduce(
      (sum, messages) => sum + messages.length,
      0
    );
    setUnreadCount(total);
    
    // Update favicon badge if needed
    updateFaviconBadge(total);
    
    // Update document title if there are unread messages
    if (total > 0) {
      document.title = `(${total}) AeroNyx`;
    } else {
      document.title = 'AeroNyx';
    }
  }, [unreadMessages]);
  
  // Helper to update favicon with badge
  const updateFaviconBadge = (count: number) => {
    // This would require a favicon badge library to implement
    // For simplicity, we'll just implement the concept here
    console.log(`Updating favicon badge: ${count}`);
  };

  // Request notification permission
  const requestPermission = async (): Promise<boolean> => {
    if (!notificationsSupported) return false;
    
    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setHasPermission(granted);
      
      if (granted) {
        setSettings(prev => ({ ...prev, enableNotifications: true }));
      }
      
      return granted;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  };

  // Update notification settings
  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      
      // Save to localStorage
      localStorage.setItem('aero-notification-settings', JSON.stringify(updated));
      
      return updated;
    });
  }, []);

  // Check if we're in quiet hours
  const isInQuietHours = useCallback(() => {
    if (!settings.quietHoursEnabled) return false;
    
    try {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTime = currentHours * 60 + currentMinutes;
      
      const [startHours, startMinutes] = settings.quietHoursStart.split(':').map(Number);
      const [endHours, endMinutes] = settings.quietHoursEnd.split(':').map(Number);
      
      const startTime = startHours * 60 + startMinutes;
      const endTime = endHours * 60 + endMinutes;
      
      // Handle cases where quiet hours span midnight
      if (startTime > endTime) {
        return currentTime >= startTime || currentTime <= endTime;
      }
      
      return currentTime >= startTime && currentTime <= endTime;
    } catch (error) {
      console.error('Error calculating quiet hours:', error);
      return false;
    }
  }, [settings.quietHoursEnabled, settings.quietHoursStart, settings.quietHoursEnd]);
  
  // Check if a chat is muted
  const isMuted = useCallback((chatId: string) => {
    const expiry = mutedChats[chatId];
    if (expiry === undefined) return false;
    if (expiry === null) return true; // Muted indefinitely
    return expiry > Date.now();
  }, [mutedChats]);
  
  // Mute a chat
  const mute = useCallback((chatId: string, duration?: number) => {
    setMutedChats(prev => {
      const expiry = duration ? Date.now() + duration : null; // null = indefinite
      const updated = { ...prev, [chatId]: expiry };
      localStorage.setItem('aero-muted-chats', JSON.stringify(updated));
      return updated;
    });
  }, []);
  
  // Unmute a chat
  const unmute = useCallback((chatId: string) => {
    setMutedChats(prev => {
      const updated = { ...prev };
      delete updated[chatId];
      localStorage.setItem('aero-muted-chats', JSON.stringify(updated));
      return updated;
    });
  }, []);
  
  // Play notification sound
  const playSound = useCallback(() => {
    if (settings.notificationSound === 'none') return;
    
    try {
      const soundElement = notificationSounds[settings.notificationSound];
      if (soundElement) {
        soundElement.currentTime = 0;
        soundElement.play().catch(err => console.error("Error playing notification sound:", err));
      }
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }, [settings.notificationSound, notificationSounds]);
  
  // Vibrate device
  const vibrate = useCallback(() => {
    if (!settings.vibrate || !navigator.vibrate) return;
    
    try {
      navigator.vibrate(200);
    } catch (error) {
      console.error('Failed to vibrate device:', error);
    }
  }, [settings.vibrate]);
  
  // Show a notification for a new message
  const showNotification = useCallback((message: NotificationMessage) => {
    // Add to unread messages
    setUnreadMessages(prev => {
      const chatMessages = prev[message.chatId] || [];
      return {
        ...prev,
        [message.chatId]: [...chatMessages, message]
      };
    });
    
    // Check if we should send a notification
    if (!settings.enableNotifications || !hasPermission) return;
    
    // Check quiet hours
    if (isInQuietHours()) return;
    
    // Check if the chat is muted
    if (isMuted(message.chatId)) return;
    
    // Check notification filter settings
    const shouldNotify = settings.notifyOnAllMessages || 
                        (settings.notifyOnDirectMessages && message.isDirectMessage) ||
                        (settings.notifyOnMentions && message.hasMention);
                        
    if (!shouldNotify) return;
    
    // Play sound and vibrate
    playSound();
    vibrate();
    
    // Don't show notification if user is mentioned by themselves or if user is the sender
    if (message.senderId === user?.id) return;
    
    // Create browser notification
    if (notificationsSupported && Notification.permission === 'granted') {
      try {
        const title = message.isDirectMessage ? message.senderName : message.chatName;
        const body = settings.showPreview ? message.content : 'New encrypted message';
        
        const notification = new Notification(title, {
          body,
          icon: '/logo.svg', // Your app logo
          tag: message.chatId, // Group by chat ID
        });
        
        // Handle click on notification
        notification.onclick = () => {
          window.focus();
          // Navigate to chat - would need integration with router
          window.location.href = `/chat/${message.chatId}`;
        };
      } catch (error) {
        console.error('Failed to create notification:', error);
      }
    }
  }, [
    settings, hasPermission, isInQuietHours, isMuted, 
    playSound, vibrate, notificationsSupported, user?.id
  ]);
  
  // Get unread count for a specific chat
  const getUnreadCountForChat = useCallback((chatId: string) => {
    return unreadMessages[chatId]?.length || 0;
  }, [unreadMessages]);
  
  // Mark a chat as read
  const markChatAsRead = useCallback((chatId: string) => {
    setUnreadMessages(prev => {
      const updated = { ...prev };
      delete updated[chatId];
      return updated;
    });
  }, []);
  
  // Clear all unread messages
  const clearUnread = useCallback(() => {
    setUnreadMessages({});
  }, []);
  
  return (
    <NotificationContext.Provider value={{
      settings,
      updateSettings,
      hasPermission,
      requestPermission,
      showNotification,
      notificationsSupported,
      unreadCount,
      clearUnread,
      markChatAsRead,
      getUnreadCountForChat,
      mute,
      unmute,
      isMuted,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
