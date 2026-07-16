'use client'

/**
 * Visualization for the custom-CSS content type.
 *
 * The custom-CSS item has no component to render — its whole effect is the CSS
 * it applies to the site. So instead of a component, the visualization shows a
 * real page (the homepage, server-rendered and passed as `children`) with the
 * item's CSS injected on top, and updates that CSS live as the editor types —
 * the same real-time feel as every other visualization (see VisualizationClient).
 *
 * Only the CSS is live; the page underneath is the server-rendered snapshot.
 * The <style> is emitted after `children` so it overrides the page's own styles
 * by source order — mirroring how the layer is injected on the real site.
 */
import { init } from 'dc-visualization-sdk'
import type { ReactNode } from 'react'
import { useEffect, useState, useTransition } from 'react'

import { CUSTOM_CSS_STYLE_ID, sanitizeCustomCss } from '../../lib/custom-css-schema'

type Props = {
  /** The item's CSS from the server fetch — the initial preview state. */
  initialCss: string
  /** The server-rendered page the CSS is previewed against (the homepage). */
  children: ReactNode
}

export function CustomCssVisualization({ initialCss, children }: Props) {
  const [css, setCss] = useState(initialCss)
  const [, startTransition] = useTransition()

  // The root layout injects the *published* custom CSS on every route (parity
  // with tokens.css). In the visualizer we want only the live edit to apply, so
  // the published block must not stack underneath — otherwise a rule the editor
  // removes keeps showing from the published version. Disable it (React owns the
  // hoisted <head> element, so toggle `media` rather than removing it) and
  // restore on unmount. Selected by the precedence key the layout injects with.
  useEffect(() => {
    const published = document.querySelectorAll<HTMLStyleElement>(
      `style[data-precedence="${CUSTOM_CSS_STYLE_ID}"]`,
    )
    const previousMedia = new Map<HTMLStyleElement, string>()
    published.forEach((el) => {
      previousMedia.set(el, el.media)
      el.media = 'not all'
    })
    return () => {
      previousMedia.forEach((media, el) => {
        el.media = media
      })
    }
  }, [])

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    init()
      .then((sdk) => {
        // form.changed delivers the edited custom-CSS item as { content: body };
        // its `css` field is the live value. Sanitise the same way the real-site
        // injection does before it reaches the DOM.
        unsubscribe = sdk.form.changed(
          ({ content }) => {
            const next = sanitizeCustomCss(((content as { css?: string })?.css ?? '').trim())
            startTransition(() => {
              setCss(next)
            })
          },
          { format: 'inlined', depth: 'all' },
        )
      })
      .catch(() => {
        // Opened standalone (not in the content-form iframe) — no live updates,
        // keep the server-fetched CSS.
      })

    return () => {
      unsubscribe?.()
    }
  }, [])

  return (
    <>
      {children}
      {css !== '' && <style id={CUSTOM_CSS_STYLE_ID} dangerouslySetInnerHTML={{ __html: css }} />}
    </>
  )
}
