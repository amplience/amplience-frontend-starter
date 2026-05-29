/**
 * Home page — POC wiring (QL-23).
 *
 * Server Component that fetches the home content via the mock ContentClient
 * and renders it in the simplest possible way. The actual recursive
 * renderer (ADR-0010 / QL-17) is a separate ticket; this page just proves
 * content flows from the port through to the DOM.
 *
 * When the SDK adapter lands (QL-43), the only change here is the import
 * line — the port surface stays identical.
 */

import { Link } from '@amplience/quadratic-components/link'
import { Typography } from '@amplience/quadratic-components/typography'
import { makeMockContentClient } from '@amplience/quadratic-content/mock'

type HomeBody = {
  title: string
  description: string
}

const client = makeMockContentClient()

export default async function HomePage() {
  const home = await client.getByKey<HomeBody>('home', { depth: 'all' })

  return (
    <main>
      <Typography as="h1" variant="h1">
        {home.title}
      </Typography>
      <Typography variant="body">{home.description}</Typography>

      {/* Typography atom smoke — QL-24. Remove once Storybook lands. */}
      <section aria-label="Typography scale (QL-24)">
        <Typography as="h2" variant="h2">
          Heading 2
        </Typography>
        <Typography as="h3" variant="h3">
          Heading 3
        </Typography>
        <Typography as="h4" variant="h4">
          Heading 4
        </Typography>
        <Typography as="h5" variant="h5">
          Heading 5
        </Typography>
        <Typography as="h6" variant="h6">
          Heading 6
        </Typography>
        <Typography variant="body">
          Body — the quick brown fox jumps over the lazy dog, with an{' '}
          <Link href="/docs">internal link</Link> and an{' '}
          <Link href="https://example.com">external link</Link>.
        </Typography>
        <Typography variant="caption">Caption — supplementary text at small size.</Typography>
        <Typography as="p" variant="h2">
          Variant/element decoupled: h2 style on a &lt;p&gt;
        </Typography>
      </section>

      <details>
        <summary>Resolved content tree (debug)</summary>
        <pre>{JSON.stringify(home, null, 2)}</pre>
      </details>
    </main>
  )
}
