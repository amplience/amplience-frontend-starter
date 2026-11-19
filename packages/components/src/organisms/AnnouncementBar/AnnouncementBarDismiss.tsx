'use client'

import { createContext, useCallback, useContext, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'

import { IconButton } from '../../molecules/IconButton/IconButton'

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/** localStorage key prefix — one entry per announcement item. */
export const DISMISS_STORAGE_PREFIX = 'announcement-bar:dismissed:'

/**
 * 32-bit FNV-1a, base36 — a short fingerprint of the message. Stored as the
 * entry's value, so editing the message counts as a new announcement and the
 * bar shows again for visitors who dismissed the old one.
 */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

// Storage can be missing or throw (private windows, blocked site data), so
// every access is guarded: the worst case is a bar that shows again.
function readDismissed(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeDismissed(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Not persisted — the bar stays hidden for this page view only.
  }
  for (const listener of listeners) listener()
}

// Same-tab writes don't fire `storage` events, so dismissals are broadcast to
// every mounted bar here; other tabs are covered by the `storage` event.
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

const DismissContext = createContext<(() => void) | null>(null)

export type DismissibleAnnouncementProps = {
  /** Identifies the announcement in storage — the content item's delivery id. */
  storageId: string
  /** The message source; its fingerprint decides whether a dismissal still applies. */
  message: string
  children: ReactNode
}

/**
 * Client wrapper that removes its children once the visitor dismisses them,
 * and keeps them removed on later visits until the message changes.
 *
 * The server render always includes the bar (storage isn't readable there),
 * so a returning visitor who dismissed it sees it briefly until hydration.
 * The header's sticky offset follows the height change on its own
 * (StickyScrollOffset observes the header's size).
 */
export function DismissibleAnnouncement({
  storageId,
  message,
  children,
}: DismissibleAnnouncementProps) {
  const key = `${DISMISS_STORAGE_PREFIX}${storageId}`
  const value = fingerprint(message)
  // The server snapshot is "not dismissed" (storage isn't readable there), so
  // hydration matches the server HTML and the stored value applies after it.
  const stored = useSyncExternalStore(
    subscribe,
    () => readDismissed(key) === value,
    () => false,
  )
  // Also tracked locally so a click hides the bar even when storage is blocked.
  const [dismissedNow, setDismissedNow] = useState(false)

  const dismiss = useCallback(() => {
    setDismissedNow(true)
    writeDismissed(key, value)
  }, [key, value])

  if (stored || dismissedNow) return null
  return <DismissContext.Provider value={dismiss}>{children}</DismissContext.Provider>
}

export type DismissButtonProps = {
  /** Accessible label for the close button. */
  label?: string
  className?: string
}

/** The × button. Renders nothing outside a DismissibleAnnouncement. */
export function DismissButton({ label = 'Dismiss announcement', className }: DismissButtonProps) {
  const dismiss = useContext(DismissContext)
  if (dismiss === null) return null
  return (
    <IconButton
      icon="x"
      label={label}
      onClick={dismiss}
      {...(className !== undefined && { className })}
    />
  )
}
