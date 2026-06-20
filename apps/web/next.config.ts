import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Linting runs workspace-wide via `just lint` (root eslint flat config).
  // Next 16 removed the built-in `eslint` config key; build-time linting is no longer wired here.
  transpilePackages: ['@stringer/core', '@stringer/pipeline'],
};

export default nextConfig;
