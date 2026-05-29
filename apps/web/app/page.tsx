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

import { makeMockContentClient } from '@amplience/quadratic-content/mock'

interface HomeBody {
  title: string
  description: string
}

const client = makeMockContentClient()

export default async function HomePage() {
  const home = await client.getByKey<HomeBody>('home', { depth: 'all' })

  return (
    <main>
      <h1>{home.title}</h1>
      <p>{home.description}</p>
      <details>
        <summary>Resolved content tree (debug)</summary>
        <pre>{JSON.stringify(home, null, 2)}</pre>
      </details>
    </main>
  )
}
