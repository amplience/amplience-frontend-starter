'use client'

import { useCallback, useEffect, useState, type RefObject } from 'react'

import { prefersReducedMotion } from './video-utils'

/** `'autoplay'`: plays on screen, with a pause button. `'hover'`: plays while its link is hovered or focused. */
export type AmbientTrigger = 'autoplay' | 'hover'

export type AmbientPlayback = {
  /** What the toggle shows. */
  readonly paused: boolean
  /** Whether the video should be playing right now. */
  readonly shouldPlay: boolean
  readonly toggle: () => void
}

/**
 * Ambient video rules (ADR-0025): nothing plays before hydration, reduced motion
 * starts paused, autoplay only runs on screen, and a visitor's pause sticks.
 */
export function useAmbientPlayback(
  ref: RefObject<Element | null>,
  enabled: boolean,
  trigger: AmbientTrigger = 'autoplay',
): AmbientPlayback {
  const [paused, setPaused] = useState(true)
  const [inView, setInView] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (!enabled || trigger !== 'autoplay') return
    if (!prefersReducedMotion()) setPaused(false)

    const element = ref.current
    if (element === null || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (entry) setInView(entry.isIntersecting)
      },
      { rootMargin: '200px 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [enabled, trigger, ref])

  useEffect(() => {
    if (!enabled || trigger !== 'hover') return
    const element = ref.current
    const target = element?.closest('a') ?? element
    if (!target) return
    const start = () => {
      if (!prefersReducedMotion()) setHovered(true)
    }
    const stop = () => setHovered(false)
    const events = [
      ['pointerenter', start],
      ['focusin', start],
      ['pointerleave', stop],
      ['focusout', stop],
    ] as const
    for (const [type, listener] of events) target.addEventListener(type, listener)
    return () => {
      for (const [type, listener] of events) target.removeEventListener(type, listener)
    }
  }, [enabled, trigger, ref])

  const toggle = useCallback(() => setPaused((p) => !p), [])

  if (trigger === 'hover') {
    return { paused: !hovered, shouldPlay: enabled && hovered, toggle }
  }
  return { paused, shouldPlay: enabled && !paused && inView, toggle }
}
