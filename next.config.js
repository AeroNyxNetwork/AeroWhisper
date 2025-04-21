/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  
  // Environment variables with fallbacks
  env: {
    NEXT_PUBLIC_AERONYX_SERVER_URL: process.env.AERONYX_SERVER_URL || 'wss://p2p.aeronyx.network:8080',
    NEXT_PUBLIC_USE_MOCK_SERVER: process.env.NEXT_PUBLIC_USE_MOCK_SERVER || 'false',
    NEXT_PUBLIC_BUILD_VERSION: process.env.BUILD_VERSION || '0.1.0',
  },
  
  // Enable SWC minify for faster builds
  swcMinify: true,
  
  // Performance optimizations
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
    
    // Enable React optimizations with emotion
    emotion: true,
  },
  
  // Image optimization settings
  images: {
    formats: ['image/avif', 'image/webp'],
    domains: ['aeronyx.network'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.aeronyx.network',
        pathname: '/images/**',
      },
    ],
  },
  
  // Configure webpack polyfills for crypto, stream, etc.
  webpack: (config, { isServer, dev }) => {
    // Only apply these polyfills on the client side
    if (!isServer) {
      config.resolve.fallback = { 
        ...config.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer/'),
        util: require.resolve('util/'),
        assert: require.resolve('assert/'),
      };
      
      // Add buffer to the providePlugin to avoid runtime errors
      const webpack = require('webpack');
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        })
      );
    }
    
    // Optimize SVG handling
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    
    // Optimize chunk loading
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor chunk for third party libraries
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
            priority: 20,
          },
          // Common chunk for frequently used components
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'async',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
        },
      };
    }
    
    return config;
  },
  
  // Add static HTML export options
  output: 'standalone',
  
  // Configure trailing slashes for better URL handling
  trailingSlash: true,
  
  // Explicitly configure dynamic routes for static exports
  async exportPathMap() {
    return {
      '/': { page: '/' },
      '/dashboard': { page: '/dashboard' },
      '/auth/connect-wallet': { page: '/auth/connect-wallet' },
      '/settings': { page: '/settings' },
      '/404': { page: '/404' }
    };
  },
  
  // Configure headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  
  // Experimental features - enabled selectively
  experimental: {
    // Enable modern JavaScript features
    esmExternals: true,
    // Optimize font loading
    optimizeFonts: true,
    // Enable scroll restoration for maintaining scroll position
    scrollRestoration: true,
  },
  
  // Power of 10 incremental builds to improve performance
  poweredByHeader: false,
  
  // Configure redirects for legacy URLs or better UX
  async redirects() {
    return [
      {
        source: '/chat',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
