/**
 * Home page (QL-36).
 *
 * Fetches the home page content item with depth='all' so the full tree —
 * page → slots → components, including nested layout blocks — arrives with
 * all content-link references resolved inline, then hands it to the
 * renderer with this deployment's registry (ADR-0010). Dispatch, recursion,
 * and loud failure all live in `src/renderer`; composition lives in
 * `lib/registry.ts`. This file just connects the two.
 *
 * Head metadata is content-driven too: `generateMetadata` reads the same
 * page item and maps it via `pageMetadataFromSchema`. Fields the content
 * sets override the layout's site-wide `metadata` export; fields it omits
 * fall back to it (Next.js's metadata merge model).
 *
 * When the SDK adapter lands (QL-43), the only change here is swapping
 * `makeMockContentClient` → `makeSdkContentClient` on the import line.
 */

import type { Metadata } from 'next'

import { pageMetadataFromSchema } from '@amplience/quadratic-components/registry'
import type { PageSchema } from '@amplience/quadratic-components/registry'
import { makeMockContentClient } from '@amplience/quadratic-content/mock'

import { registry } from '../lib/registry'
import { renderContent } from '../src/renderer'

const client = makeMockContentClient()

export async function generateMetadata(): Promise<Metadata> {
  // depth: 'root' — metadata lives on the page item itself; no need to
  // resolve the slot tree just for the <head>.
  const page = await client.getByKey<PageSchema>('home', { depth: 'root' })
  // `path` feeds the self-referencing canonical default; it resolves
  // absolute against the layout's metadataBase (SITE_URL).
  return pageMetadataFromSchema(page, { path: '/' })
}

export default async function HomePage() {
  const page = await client.getByKey('home', { depth: 'all' })
  return renderContent(page, registry)
}
