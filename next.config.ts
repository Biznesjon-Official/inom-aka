import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { formats: ['image/webp'] },
  compress: true,
  poweredByHeader: false,
  async rewrites() {
    return [
      // Serve uploaded files via API route (Next.js doesn't serve runtime public/ files in production)
      { source: '/uploads/:filename', destination: '/api/uploads/:filename' },
    ]
  },
};

export default nextConfig;
