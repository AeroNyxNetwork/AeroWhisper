/** @type {import('next').NextConfig} */
const withBundleAnalyzer = process.env.ANALYZE === 'true' 
  ? require('@next/bundle-analyzer')({}) 
  : (config) => config;

const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Fixes npm packages that depend on `buffer` module
    config.resolve.fallback = {
      ...config.resolve.fallback,
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/'),
    };
    
    return config;
  },
  images: {
    domains: ['aeronyx-server.example.com'],
  },
  experimental: {
    scrollRestoration: true,
  },
  env: {
    AERONYX_SERVER_URL: process.env.AERONYX_SERVER_URL || 'wss://aeronyx-server.example.com',
    BUILD_VERSION: process.env.BUILD_VERSION || '0.1.0',
  },
}

module.exports = withBundleAnalyzer(nextConfig);
