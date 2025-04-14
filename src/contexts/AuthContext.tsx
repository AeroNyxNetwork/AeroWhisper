import React, { createContext, useState, useEffect, useContext } from 'react';
import { Keypair } from '@solana/web3.js';
import * as bs58 from 'bs58';
import { generateKeyPair } from '../utils/crypto';

interface User {
  id: string;
  publicKey: string;
  displayName?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  logout: () => Promise<void>;
  generateNewKeypair: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isConnecting: false,
  connect: async () => {},
  disconnect: async () => {},
  logout: async () => {},
  generateNewKeypair: async () => {},
  updateProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  
  useEffect(() => {
    // Check for existing authentication
    const checkAuth = async () => {
      try {
        // Check if we have a stored keypair
        const storedKeypair = localStorage.getItem('aero-keypair');
        if (storedKeypair) {
          const keypair = JSON.parse(storedKeypair);
          
          // Create a user object from the keypair
          const user: User = {
            id: keypair.publicKey,
            publicKey: keypair.publicKey,
            displayName: localStorage.getItem('aero-display-name') || `User_${keypair.publicKey.substring(0, 6)}`,
          };
          
          setUser(user);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        // Clear any invalid data
        localStorage.removeItem('aero-keypair');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  // Connect with a wallet
  const connect = async () => {
    setIsConnecting(true);
    try {
      // In a real implementation, we would connect to a Solana wallet here
      // For now, we'll just generate a keypair
      
      // Simulate wallet connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const keypair = generateKeyPair();
      
      // Save the keypair
      localStorage.setItem('aero-keypair', JSON.stringify(keypair));
      
      // Create user profile
      const user: User = {
        id: keypair.publicKey,
        publicKey: keypair.publicKey,
        displayName: `User_${keypair.publicKey.substring(0, 6)}`,
      };
      
      setUser(user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Connection error:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };
  
  // Generate a new keypair (without wallet)
  const generateNewKeypair = async () => {
    try {
      const keypair = generateKeyPair();
      
      // Save the keypair
      localStorage.setItem('aero-keypair', JSON.stringify(keypair));
      
      // Create user profile
      const user: User = {
        id: keypair.publicKey,
        publicKey: keypair.publicKey,
        displayName: `User_${keypair.publicKey.substring(0, 6)}`,
      };
      
      setUser(user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Keypair generation error:', error);
      throw error;
    }
  };
  
  // Disconnect wallet
  const disconnect = async () => {
    try {
      // In a real implementation, disconnect from wallet
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('aero-keypair');
    } catch (error) {
      console.error('Disconnect error:', error);
      throw error;
    }
  };
  
  // Logout (same as disconnect for now)
  const logout = async () => {
    await disconnect();
  };
  
  // Update user profile
  const updateProfile = async (data: Partial<User>) => {
    if (!user) return;
    
    const updatedUser = { ...user, ...data };
    setUser(updatedUser);
    
    // Save display name if provided
    if (data.displayName) {
      localStorage.setItem('aero-display-name', data.displayName);
    }
  };
  
  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        isConnecting,
        connect,
        disconnect,
        logout,
        generateNewKeypair,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
