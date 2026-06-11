import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@stringer/core', '@stringer/pipeline'],
  eslint: {
    // Linting runs workspace-wide via `just lint` (root eslint flat config).
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
