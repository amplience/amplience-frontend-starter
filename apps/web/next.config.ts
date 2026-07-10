import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source (no build step) — Next.js
  // needs the explicit nod to compile them in the same pass as apps/web.
  // Add new workspace packages here as they're consumed.
  transpilePackages: ['@amplience/quadratic-content', '@amplience/quadratic-components'],

  images: {
    remotePatterns: [
      // Allows images from any https URL to be used in the Next.js Image component.
      // If you wish to restrict this to specific domains, you can replace the wildcard with a specific hostname or pattern.
      // For example, to allow images from "example.com", you would use:
      // { protocol: 'https', hostname: 'example.com' },
      { protocol: 'https', hostname: '**' },
    ],
  },
}

export default nextConfig
