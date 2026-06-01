import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import './globals.css'
import '@amplience/quadratic-theme/tokens.css'

export const metadata: Metadata = {
  title: 'Quadratic Lite',
  description: 'Open-source accelerator for the Amplience Quadratic demo platform.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-brand={process.env['NEXT_PUBLIC_BRAND'] ?? 'default'}>
      <body>{children}</body>
    </html>
  )
}
