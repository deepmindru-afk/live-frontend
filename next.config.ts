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
};

export default nextConfig;
