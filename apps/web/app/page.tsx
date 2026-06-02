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

import { Fragment } from 'react'

import { Container } from '@amplience/quadratic-components/container'
import { Divider } from '@amplience/quadratic-components/divider'
import { Stack } from '@amplience/quadratic-components/stack'
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
    <>
      <header style={{ background: 'var(--color-gray-200)', padding: 'var(--site-gutter) 0' }}>
        <Container gutter>
          <Stack>
            <Typography variant="h1">{home.title}</Typography>
            <Typography>{home.description}</Typography>
          </Stack>
        </Container>
      </header>

      <main style={{ padding: 'var(--site-gutter) 0' }}>
        <Container gutter>
          <Stack>
            <Typography variant="h2">Content tree (debug)</Typography>
            <Divider />
            <details>
              <summary>Resolved content tree</summary>
              <pre>{JSON.stringify(home, null, 2)}</pre>
            </details>
          </Stack>
        </Container>
      </main>
    </>
  )
}
