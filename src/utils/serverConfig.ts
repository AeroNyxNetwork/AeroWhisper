// src/utils/serverConfig.ts
/**
 * Utility for managing server connection configuration
 */

// Get the WebSocket server URL from environment or localStorage override
export const getServerUrl = (): string => {
  if (typeof window !== 'undefined') {
    // Check if there's a localStorage override
    const localStorageOverride = localStorage.getItem('aeronyx-server-url');
    if (localStorageOverride) {
      return localStorageOverride;
    }
  }
  
  // Fallback to environment variable or default
  return process.env.NEXT_PUBLIC_AERONYX_SERVER_URL || 'wss://aeronyx-server.example.com';
};

// Set a temporary server URL override in localStorage
export const setServerUrlOverride = (url: string): void => {
  if (typeof window !== 'undefined') {
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      // Add protocol prefix if missing
      url = `wss://${url}`;
    }
    localStorage.setItem('aeronyx-server-url', url);
    console.log(`Server URL override set to: ${url}`);
  }
};

// Clear any server URL override
export const clearServerUrlOverride = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('aeronyx-server-url');
    console.log('Server URL override cleared');
  }
};

// Test the server connection
export const testServerConnection = async (url?: string): Promise<{success: boolean, message: string}> => {
  const serverUrl = url || getServerUrl();
  
  try {
    // Try to connect with a timeout
    return await new Promise((resolve) => {
      const ws = new WebSocket(serverUrl);
      
      // Set timeout for connection
      const timeout = setTimeout(() => {
        ws.close();
        resolve({
          success: false,
          message: 'Connection timed out. Check server URL and ensure server is running.'
        });
      }, 5000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve({
          success: true,
          message: 'Successfully connected to server!'
        });
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        console.error('WebSocket connection error:', error);
        resolve({
          success: false,
          message: 'Failed to connect. This may be due to a self-signed certificate. Try visiting the server URL in your browser first to accept the certificate.'
        });
      };
    });
  } catch (error) {
    console.error('Error testing server connection:', error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

// Helper to check if using the mock server
export const isUsingMockServer = (): boolean => {
  return process.env.NEXT_PUBLIC_USE_MOCK_SERVER === 'true';
};
