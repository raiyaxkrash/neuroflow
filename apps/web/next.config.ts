import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@neuroflow/shared', '@neuroflow/ui'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:4000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
