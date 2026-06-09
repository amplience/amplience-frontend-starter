import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source (no build step) — Next.js
  // needs the explicit nod to compile them in the same pass as apps/web.
  // Add new workspace packages here as they're consumed.
  transpilePackages: ['@amplience/quadratic-content', '@amplience/quadratic-components'],

  images: {
    remotePatterns: [
      // picsum.photos — used for placeholder images in stories and fixtures.
      // Seeded URLs (e.g. /seed/ql-hero/800/600) return consistent images
      // across reloads, which is important for visual regression snapshots.
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
}

export default nextConfig
