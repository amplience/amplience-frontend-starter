/**
 * Branded 404 (QL-37). Reached when a route calls `notFound()` — including
 * the content-fetch path, where a `ContentClientError` of kind 'not-found'
 * means the page item doesn't exist in the hub — and for any URL with no
 * route. A Server Component: no client JavaScript.
 */

import type { Metadata } from 'next'

import { HeroBlock } from '@amplience/quadratic-components/hero-block'

export const metadata: Metadata = {
  title: 'Page not found',
}

export default function NotFound() {
  return (
    <main data-page>
      <HeroBlock
        title="Page not found 🙈"
        subtitle="There's no content at this address — the page may have been moved, unpublished, or never existed."
        ctas={[
          {
            href: '/',
            label: 'Back to the home page',
          },
        ]}
        minHeight={400}
        verticalPosition="center"
      />
    </main>
  )
}
