/**
 * Home page — POC wiring (QL-23).
 *
 * Server Component that fetches home content via the mock ContentClient and
 * renders it directly. The actual recursive renderer (ADR-0010 / QL-17) is a
 * separate ticket; this page wires up the Hero molecule (QL-29) to prove
 * content flows through to the DOM.
 *
 * When the SDK adapter lands (QL-43), the only change here is the import
 * line — the port surface stays identical.
 */

import { Container } from '@amplience/quadratic-components/container'
import { Divider } from '@amplience/quadratic-components/divider'
import { Hero } from '@amplience/quadratic-components/hero'
import type { HeroProps } from '@amplience/quadratic-components/hero'
import { Stack } from '@amplience/quadratic-components/stack'
import { Typography } from '@amplience/quadratic-components/typography'
import { makeMockContentClient } from '@amplience/quadratic-content/mock'

type HeroBody = Omit<HeroProps, 'className'>

const client = makeMockContentClient()
export default async function HomePage() {
  const hero = await client.getByKey<HeroBody>('home/hero', { depth: 'all' })

  return (
    <>
      <Hero {...hero} />

      <main style={{ padding: 'var(--site-gutter) 0' }}>
        <Container gutter>
          <Stack>
            <Typography variant="h2">Content tree (debug)</Typography>
            <Divider />
            <details>
              <summary>Resolved content tree</summary>
              <pre>{JSON.stringify(hero, null, 2)}</pre>
            </details>
          </Stack>
        </Container>
      </main>
    </>
  )
}
