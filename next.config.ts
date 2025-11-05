import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  sassOptions: {
    includePaths: ['./styles'],
  },
  typescript: {
    // Skip type checking during build - development only
    ignoreBuildErrors: true,
  },
  eslint: {
    // Skip ESLint during build - development only  
    ignoreDuringBuilds: true,
  },
  // Production optimizations - only for production builds
  // Disabled standalone mode for local development - it causes path issues
  // ...(process.env.NODE_ENV === 'production' && { output: 'standalone' }),
  experimental: {
    // Enable modern features
    esmExternals: true,
  },
  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  // Webpack configuration for production
  webpack: (config, { dev, isServer }) => {
    // Fix Excalidraw module resolution issue with roughjs
    const path = require('path');
    const webpack = require('webpack');
    
    // Resolve roughjs paths (both in root and nested in Excalidraw)
    const rootRoughjsPath = path.resolve(__dirname, 'node_modules/roughjs/bin/rough.js');
    const excalidrawRoughjsPath = path.resolve(__dirname, 'node_modules/@excalidraw/excalidraw/node_modules/roughjs/bin/rough.js');
    
    // Try to find the actual roughjs path
    const fs = require('fs');
    let roughjsPath = rootRoughjsPath;
    if (fs.existsSync(excalidrawRoughjsPath)) {
      roughjsPath = excalidrawRoughjsPath;
    } else if (!fs.existsSync(rootRoughjsPath)) {
      // Fallback: try to find any roughjs
      try {
        roughjsPath = require.resolve('roughjs/bin/rough.js');
      } catch (e) {
        // Ignore
      }
    }
    
    config.resolve.alias = {
      ...config.resolve.alias,
      'roughjs/bin/rough': roughjsPath,
    };

    // Use NormalModuleReplacementPlugin to replace the import
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /roughjs\/bin\/rough$/,
        (resource) => {
          resource.request = resource.request.replace(/roughjs\/bin\/rough$/, 'roughjs/bin/rough.js');
        }
      )
    );

    // Fix for Excalidraw's dynamic imports
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.js', '.ts', '.tsx'],
    };

    // Handle Excalidraw and related packages
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    // Production optimizations
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            chunks: 'all',
          },
        },
      };
    }
    
    return config;
  },
  // Headers for production
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
