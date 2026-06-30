/**
 * The visualization route (QL-43 follow-on; QL-92 registered the URIs).
 *
 * Amplience's content form drives this page: every content type carries a
 * `Localhost (dev)` visualization templated as
 * `/visualization?vse={{vse.domain}}&content={{content.sys.id}}`, so the
 * editor sees the item they're editing rendered through the same registry
 * the site uses. The renderer is type-agnostic (ADR-0010) — a hero, a
 * grid, a slot, or a full page all render; parity with the site comes from
 * the shared registry, not a shared URL.
 *
 * This is a dedicated route rather than `?content=` params on the public
 * catch-all (decided 2026-06-12): reading searchParams would force the
 * public route dynamic sitewide, `vse` handling stays off canonical URLs,
 * and the future dc-visualization-sdk live mode gets a home that never
 * ships in the public bundle.
 *
 * Always dynamic, always fresh: the whole point is "what does this item
 * look like *now*", so the route opts out of caching entirely. Always
 * `noindex`: visualization URLs are editor tooling, not site pages.
 *
 * The content client here is per-request and always SDK-backed — the `vse`
 * param *is* the data source (the VSE serves latest-saved versions), so
 * the deployment's own CONTENT_CLIENT setting doesn't apply. With a
 * staging host set, the SDK routes every request to `https://<vse>`; the
 * hub name is only used to build the CDN hostname that the staging
 * override replaces, so any value satisfies the SDK config when we fall
 * back to the placeholder.
 *
 * Bad input renders an explanatory card rather than a 404 — the audience
 * is an editor looking at a visualization pane, and "what's wrong and what
 * should the URL look like" beats a blank page (ADR-0010's loud-failure
 * stance applied to tooling).
 */

import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { BLOG_ARTICLE_SCHEMA, PAGE_SCHEMA } from '@amplience/quadratic-components/registry'
import { isContentClientError, resolveContentConfig } from '@amplience/quadratic-content'
import { makeSdkContentClient } from '@amplience/quadratic-content/sdk'

import { registry } from '../../lib/registry'
import {
  ContentUnavailableCard,
  emitContentFailure,
  FailureCard,
  renderContent,
} from '../../src/renderer'
import { VisualizationClient } from './VisualizationClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Visualization',
  robots: { index: false, follow: false },
}

const EXPECTED_TEMPLATE = '/visualization?vse={{vse.domain}}&content={{content.sys.id}}'

/** The only host suffix a VSE can have — literal suffix check, no patterns. */
const VSE_SUFFIX = '.staging.bigcontent.io'

/** Characters that would let a host param escape `https://<host>/...`. */
const HOST_BREAKERS = ['/', '?', '#', '@', ':', '\\', ' ']

/**
 * Validate the `vse` param: a bare VSE hostname and nothing else. The value
 * is interpolated into a URL, so anything that could smuggle in a path,
 * port, or credentials is rejected outright.
 */
const isVseHost = (value: string): boolean =>
  value.length > VSE_SUFFIX.length &&
  value.length <= 253 &&
  value.endsWith(VSE_SUFFIX) &&
  HOST_BREAKERS.every((char) => !value.includes(char))

const DELIVERY_ID_CHARS = new Set('0123456789abcdef-')

/** Delivery IDs are UUIDs — 36 chars of hex and dashes. Set lookup, no patterns. */
const isDeliveryId = (value: string): boolean =>
  value.length === 36 && [...value.toLowerCase()].every((char) => DELIVERY_ID_CHARS.has(char))

/** Reject repeated params; return the single value or undefined. */
const single = (value: string | string[] | undefined): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

type RouteProps = {
  searchParams: Promise<{
    vse?: string | string[]
    content?: string | string[]
    isThumbnail?: string | string[]
  }>
}

const misconfigured = (summary: string) => (
  <FailureCard
    failureClass="visualization-misconfigured"
    summary={summary}
    schemaUri={EXPECTED_TEMPLATE}
  />
)

export default async function VisualizationPage({ searchParams }: RouteProps) {
  const params = await searchParams
  const vse = single(params.vse)
  const contentId = single(params.content)
  const isThumbnail = single(params.isThumbnail)

  if (vse === undefined || contentId === undefined) {
    return misconfigured(
      'This visualization needs both a vse and a content parameter — check the visualization URL registered on the content type.',
    )
  }
  if (!isVseHost(vse)) {
    return misconfigured(
      `The vse parameter must be a bare virtual-staging hostname ending in ${VSE_SUFFIX}.`,
    )
  }
  if (!isDeliveryId(contentId)) {
    return misconfigured(
      'The content parameter must be a delivery ID (UUID) — Amplience fills it from {{content.sys.id}}.',
    )
  }

  // Per-request client pinned to this request's VSE. The deployment's
  // resolved hub name rides along when it has one; the staging override
  // makes it cosmetic either way (see module doc).
  const config = resolveContentConfig()
  const client = makeSdkContentClient({
    hubName: config.kind === 'sdk' ? config.hubName : 'visualization',
    stagingHost: vse,
    ...(config.kind === 'sdk' && config.locale !== undefined && { locale: config.locale }),
  })

  let item: unknown
  try {
    item = await client.getById(contentId, { depth: 'all' })
  } catch (error) {
    if (!isContentClientError(error)) throw error
    emitContentFailure(error, contentId)
    return <ContentUnavailableCard error={error} resource={contentId} />
  }

  const isTopLevel = [PAGE_SCHEMA, BLOG_ARTICLE_SCHEMA].includes(
    (item as { _meta?: { schema?: string } })?._meta?.schema ?? '',
  )

  if (isThumbnail) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            marginInline: 'auto',
          }}
        >
          <VisualizationClient initialModel={item} isTopOfPage />
        </div>
      </div>
    )
  }

  if (!isTopLevel) {
    return <VisualizationClient initialModel={item} isTopOfPage />
  }

  // For page items, render with site chrome so the visualization matches what
  // a visitor would see. The header and footer are fetched via the same VSE
  // client so the editor sees the latest-saved version of both too.
  let header: ReactNode = null
  let footer: ReactNode = null
  const [headerResult, footerResult] = await Promise.allSettled([
    client.getByKey('site/header', { depth: 'all' }),
    client.getByKey('site/footer', { depth: 'all' }),
  ])
  if (headerResult.status === 'fulfilled') {
    try {
      header = renderContent(headerResult.value, registry)
    } catch {
      // Not fatal — render without header rather than breaking the visualization.
    }
  }
  if (footerResult.status === 'fulfilled') {
    try {
      footer = renderContent(footerResult.value, registry)
    } catch {
      // Not fatal — render without footer rather than breaking the visualization.
    }
  }

  return (
    <>
      {header}
      <main>
        <VisualizationClient initialModel={item} isTopOfPage />
      </main>
      {footer}
    </>
  )
}
