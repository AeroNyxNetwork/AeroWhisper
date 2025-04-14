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
        crypto: 'crypto-browserify',
        stream: 'stream-browserify',
        buffer: 'buffer/',
        // Add other polyfills if needed
        util: 'util/',
        assert: 'assert/',
        fs: false,
        net: false,
        tls: false,
        path: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig
