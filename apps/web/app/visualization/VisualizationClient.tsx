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
import type { MediaLoadPriority, RenderContext } from '@amplience/frontend-starter-types'

import { renderContent } from '../../src/renderer'

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

  const ctx: RenderContext = { loadPriority: loadPriority ?? 'lazy', localeBasePath }
  return <>{renderContent(resolvedModel, defaultRegistry, ctx)}</>
}
