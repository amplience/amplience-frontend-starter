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
import { useEffect, useState, useTransition } from 'react'

import { defaultRegistry } from '@amplience/quadratic-components/registry'
import type { RenderContext } from '@amplience/quadratic-types'

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
   * Whether to pass isTopOfPage into the renderer (triggers eager image
   * loading for heroes that lead the page).
   */
  isTopOfPage?: boolean
  /**
   * Active locale URL prefix (ADR-0015) for the pane's locale, so internal
   * links in the visualized content stay inside that locale. Defaults to ''
   * (the default locale — links unprefixed).
   */
  localeBasePath?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VisualizationClient({ initialModel, isTopOfPage, localeBasePath = '' }: Props) {
  const [model, setModel] = useState(initialModel)
  const [, startTransition] = useTransition()

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

  const ctx: RenderContext = { isTopOfPage: isTopOfPage ?? false, localeBasePath }
  return <>{renderContent(model, defaultRegistry, ctx)}</>
}
