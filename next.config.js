/** @type {import('next').NextConfig} */
const withBundleAnalyzer = process.env.ANALYZE === 'true' 
  ? require('@next/bundle-analyzer')({}) 
  : (config) => config;

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Optimized for Docker deployment
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
    unoptimized: process.env.NODE_ENV !== 'production',
  },
  experimental: {
    scrollRestoration: true,
  },
  env: {
    AERONYX_SERVER_URL: process.env.AERONYX_SERVER_URL || 'wss://aeronyx-server.example.com',
    BUILD_VERSION: process.env.BUILD_VERSION || '0.1.0',
  },
  // Enable SWC minification for faster builds
  swcMinify: true,
}

module.exports = withBundleAnalyzer(nextConfig);
