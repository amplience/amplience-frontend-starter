'use client'

/**
 * Client boundary for the /visualization route (QL-93).
 *
 * The page server-renders the initial SDK fetch so the editor sees content
 * immediately (same behaviour as before QL-93). Once mounted, this component
 * attempts to connect to dc-visualization-sdk; if the route is embedded in
 * the Amplience content-form iframe, the SDK delivers unsaved form state via
 * form.changed() and the visualization pane re-renders on every field change
 * without requiring a save.
 *
 * Graceful fallback: if init() rejects — the route is opened standalone, in a
 * snapshot/edition context, or the SDK times out — the component keeps
 * rendering the server-fetched initialModel. Behaviour is identical to the
 * pre-QL-93 save-then-reload path; the route never breaks.
 *
 * Registry choice: defaultRegistry (not the deployment registry). The
 * deployment registry's HierarchyMenuServer override is an async RSC that
 * fetches from the hierarchy API — it cannot run client-side. HierarchyMenu
 * never appears inside an editable page-body item, so defaultRegistry is
 * equivalent for all content types the form can push.
 *
 * Model shape: the SDK is called with { format: 'inlined', depth: 'all' }
 * so the pushed model is fully inlined — the same shape as the VSE fetch with
 * depth: 'all'. Cross-item references that the form cannot resolve arrive as
 * content-link stubs; the renderer's existing stub path renders a failure card
 * in place (ADR-0010 §5B) rather than crashing.
 */
import { init } from 'dc-visualization-sdk'
import { useEffect, useMemo, useState, useTransition } from 'react'

import { defaultRegistry } from '@amplience/frontend-starter-components/registry'
import { resolveLocalized } from '@amplience/frontend-starter-content'
import type { ContentBody } from '@amplience/frontend-starter-content'
import type {
  MediaLoadPriority,
  RenderContext,
  ResolvedProduct,
} from '@amplience/frontend-starter-types'

import { collectSkus, renderContent } from '../../src/renderer'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  /**
   * The content model from the server fetch — JSON-serializable, passed as a
   * prop so Next.js serialises it across the server/client boundary.
   */
  initialModel: unknown
  /**
   * The `loadPriority` tier the renderer starts from (ADR-0021). A visualized
   * item is shown on its own, so it stands at the top of its own page —
   * `'lcp'`. Omitted → `'lazy'`.
   */
  loadPriority?: MediaLoadPriority
  /**
   * Products the server resolved for `initialModel` (ADR-0027). Passed as an
   * array because the RSC boundary carries plain JSON; rebuilt as a map here.
   *
   * The seed for the first paint; edits then top it up from `/api/products`,
   * so a SKU added in the content form resolves without a reload.
   */
  initialProducts?: readonly ResolvedProduct[]
  /**
   * BCP 47 code for the pane's locale (e.g. `de-DE`). Sent to `/api/products`
   * so live-resolved products carry the same prices and copy as the server's.
   */
  localeCode?: string
  /**
   * Active locale URL prefix (ADR-0015) for the pane's locale, so internal
   * links in the visualized content stay inside that locale. Defaults to ''
   * (the default locale — links unprefixed).
   */
  localeBasePath?: string
  /**
   * Delivery-locale list for the pane's locale (e.g. `de-DE,*`). The server
   * fetch is already resolved to it, but the live `dc-visualization-sdk` model
   * arrives with field-level localized values *unresolved* (all locales inline)
   * — so it's collapsed here, client-side, to the single matching value before
   * the renderer sees it. Without this the live model fails the component
   * validators (a localized `title` is an object, not a string). Omitted → no
   * resolution (single-locale/default deployment).
   */
  deliveryLocale?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VisualizationClient({
  initialModel,
  loadPriority,
  localeBasePath = '',
  deliveryLocale,
  initialProducts,
  localeCode,
}: Props) {
  const [model, setModel] = useState(initialModel)
  const [, startTransition] = useTransition()

  // Collapse field-level localized values to the pane's locale. The server
  // fetch is already resolved, so this is a no-op for `initialModel`; it's the
  // live SDK model (raw, all locales inline) that needs it. Safe on any shape.
  const resolvedModel = useMemo(
    () =>
      deliveryLocale !== undefined ? resolveLocalized(model as ContentBody, deliveryLocale) : model,
    [model, deliveryLocale],
  )

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    init()
      .then((sdk) => {
        // form.changed delivers models in CDv2Response shape: { content: body }.
        // Extract .content so the renderer receives the same { _meta, ...fields }
        // shape as the server-side getById() fetch.
        //
        // startTransition marks the re-render as non-urgent: React coalesces
        // rapid updates (e.g. every keystroke) and skips intermediate renders
        // when a new model arrives before the previous one finishes painting.
        unsubscribe = sdk.form.changed(
          ({ content }) => {
            startTransition(() => {
              setModel(content)
            })
          },
          { format: 'inlined', depth: 'all' },
        )
      })
      .catch(() => {
        // Not inside a content-form iframe — no live updates, keep initial model.
      })

    return () => {
      unsubscribe?.()
    }
  }, [])

  const [products, setProducts] = useState<ReadonlyMap<string, ResolvedProduct>>(
    () => new Map((initialProducts ?? []).map((p) => [p.sku, p])),
  )

  // SKUs the current model references. The server resolved the initial set; an
  // edit can introduce more, and a client boundary cannot reach `ProductSource`
  // — so the route does it (ADR-0027).
  const skus = useMemo(() => collectSkus(resolvedModel, defaultRegistry).join(','), [resolvedModel])

  useEffect(() => {
    const wanted = skus.split(',').filter(Boolean)
    const missing = wanted.filter((sku) => !products.has(sku))
    if (missing.length === 0) return

    const aborted = new AbortController()
    const query = new URLSearchParams({ skus: missing.join(',') })
    if (localeCode !== undefined) query.set('locale', localeCode)

    fetch(`/api/products?${query.toString()}`, { signal: aborted.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ products?: ResolvedProduct[] }>) : null))
      .then((body) => {
        const resolved = body?.products ?? []
        if (resolved.length === 0) return
        // Merge rather than replace: products already resolved stay put, so
        // removing a SKU never re-fetches the rest of the rail.
        setProducts((current) => new Map([...current, ...resolved.map((p) => [p.sku, p] as const)]))
      })
      .catch(() => {
        // Aborted, offline, or the route is unavailable — the rail renders with
        // whatever resolved, which is the same degradation a missing SKU gets.
      })

    return () => {
      aborted.abort()
    }
    // `products` is read but deliberately not a dependency: adding resolved
    // products would re-run this and, with nothing left missing, it would
    // simply exit — churn for no gain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skus, localeCode])

  const ctx: RenderContext = {
    loadPriority: loadPriority ?? 'lazy',
    localeBasePath,
    products,
    ...(localeCode !== undefined && { locale: localeCode }),
  }
  return <>{renderContent(resolvedModel, defaultRegistry, ctx)}</>
}
