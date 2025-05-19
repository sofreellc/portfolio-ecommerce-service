import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  generateEtags: true,
  // Always generate new build IDs on build to ensure cache invalidation
  generateBuildId: async () => {
    // This ensures a new build ID on each build
    return `build-${Date.now()}`;
  },
  // Configure header forwarding
  headers: async () => [
    // Set far-future cache headers for static assets (JavaScript, CSS, fonts, etc.)
    {
      source: '/_next/static/:path*',
      headers: [
        {
          key: 'Cache-Control',
          // Immutable tells browsers to never revalidate even when using Refresh
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
    // Set cache headers for Next.js data files - also use build-based caching
    {
      source: '/_next/data/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
    // Set cache headers for images - also use content-based hashing
    {
      source: '/_next/image/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
    // Set no-cache for HTML pages (this is the most important for quick updates)
    {
      source: '/:path*',
      has: [
        {
          type: 'header',
          key: 'Accept',
          value: '.*text/html.*',
        },
      ],
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=0, must-revalidate, no-cache',
        },
        {
          key: 'Pragma',
          value: 'no-cache',
        },
      ],
    },
  ],
};

export default nextConfig;