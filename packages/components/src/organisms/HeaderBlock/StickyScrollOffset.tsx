'use client'

import { useEffect, useRef } from 'react'

/** The variable the global `scroll-padding-top` rule reads (apps/web/app/globals.css). */
const OFFSET_VARIABLE = '--site-scroll-offset'

/**
 * Publishes the sticky header's measured height as `--site-scroll-offset`, so
 * anchor jumps clear it. Rendered by HeaderBlock only when sticky — a static
 * header overlaps nothing, and the token's 0px default is already right.
 */
export function StickyScrollOffset() {
  const probe = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const header = probe.current?.closest('header')
    if (!header || typeof ResizeObserver === 'undefined') return

    const root = document.documentElement
    const observer = new ResizeObserver(() => {
      // Ceil, not round: half a pixel short still clips the heading.
      root.style.setProperty(
        OFFSET_VARIABLE,
        `${Math.ceil(header.getBoundingClientRect().height)}px`,
      )
    })
    observer.observe(header)

    return () => {
      observer.disconnect()
      root.style.removeProperty(OFFSET_VARIABLE)
    }
  }, [])

  return <span ref={probe} hidden />
}
