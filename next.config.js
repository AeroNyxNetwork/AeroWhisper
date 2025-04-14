/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_AERONYX_SERVER_URL: process.env.NEXT_PUBLIC_AERONYX_SERVER_URL || 'wss://aeronyx-server.example.com',
    NEXT_PUBLIC_USE_MOCK_SERVER: process.env.NEXT_PUBLIC_USE_MOCK_SERVER || 'true',
  },
  webpack: (config, { isServer }) => {
    // Handle crypto, buffer, etc. for client-side
    if (!isServer) {
      config.resolve.fallback = { 
        ...config.resolve.fallback,
        crypto: false,
        stream: false,
        buffer: false,
        util: false,
        assert: false,
      };
    }
    return config;
  },
  // Ensure pages are properly exported
  trailingSlash: true,
  // Explicitly configure dynamic routes
  exportPathMap: async function () {
    return {
      '/': { page: '/' },
      '/dashboard': { page: '/dashboard' },
      '/auth/connect-wallet': { page: '/auth/connect-wallet' },
      '/settings': { page: '/settings' },
      '/404': { page: '/404' }
    };
  }
}

module.exports = nextConfig
