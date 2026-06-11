/**
 * Home page (QL-36, QL-37).
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
 * Content-fetch failures are loud, not blank (QL-37): a missing page is a
 * branded 404 (`notFound()` → app/not-found.tsx); any other
 * `ContentClientError` renders the ContentUnavailable card in place of the
 * tree — server-rendered, like every other failure surface. Only genuinely
 * unexpected errors fall through to app/error.tsx.
 *
 * When the SDK adapter lands (QL-43), the only change here is swapping
 * `makeMockContentClient` → `makeSdkContentClient` on the import line.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { pageMetadataFromSchema } from '@amplience/quadratic-components/registry'
import type { PageSchema } from '@amplience/quadratic-components/registry'
import { isContentClientError } from '@amplience/quadratic-content'
import { makeMockContentClient } from '@amplience/quadratic-content/mock'

import { registry } from '../lib/registry'
import { ContentUnavailableCard, emitContentFailure, renderContent } from '../src/renderer'

const client = makeMockContentClient()

const PAGE_KEY = 'home'

export async function generateMetadata(): Promise<Metadata> {
  try {
    // depth: 'root' — metadata lives on the page item itself; no need to
    // resolve the slot tree just for the <head>.
    const page = await client.getByKey<PageSchema>(PAGE_KEY, { depth: 'root' })
    // `path` feeds the self-referencing canonical default; it resolves
    // absolute against the layout's metadataBase (SITE_URL).
    return pageMetadataFromSchema(page, { path: '/' })
  } catch (error) {
    // The page body owns the visible failure surface — metadata just falls
    // back to the layout's site-wide defaults.
    if (isContentClientError(error)) return {}
    throw error
  }
}

export default async function HomePage() {
  let page: unknown
  try {
    page = await client.getByKey(PAGE_KEY, { depth: 'all' })
  } catch (error) {
    if (!isContentClientError(error)) throw error
    if (error.kind === 'not-found') notFound()
    emitContentFailure(error, PAGE_KEY)
    return <ContentUnavailableCard error={error} resource={PAGE_KEY} />
  }
  return renderContent(page, registry)
}
