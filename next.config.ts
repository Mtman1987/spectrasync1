
import type {NextConfig} from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['firebase-admin'],

  webpack: (config, { isServer, dev }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
    };
    config.ignoreWarnings = [
      /Critical dependency: the request of a dependency is an expression/,
      /require\.extensions is not supported by webpack/,
    ];
    
    // Prevent Firebase from being bundled during build
    if (isServer && !dev) {
      config.externals = config.externals || [];
      config.externals.push('firebase-admin');
    }
    
    return config;
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    SKIP_ENV_VALIDATION: process.env.SKIP_ENV_VALIDATION,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'static-cdn.jtvnw.net',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
