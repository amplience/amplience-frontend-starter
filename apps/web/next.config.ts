import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source (no build step) — Next.js
  // needs the explicit nod to compile them in the same pass as apps/web.
  // Add new workspace packages here as they're consumed.
  transpilePackages: ['@amplience/quadratic-content', '@amplience/quadratic-components'],
}

export default nextConfig
