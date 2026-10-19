/**
 * Read one subject across every hub, each column on its own (ADR-0023).
 *
 * The async half of the progressive grid: `hub-reads.ts` says what a column's
 * state *is*, this fires the requests that produce it. Subject-agnostic, so
 * the listeners and extensions tables (QL-166, QL-167) reuse it by passing a
 * different reader rather than repeating the machinery.
 *
 * Requests go out in parallel and each column renders the moment its own hub
 * answers. There is no streaming here and none is wanted: the server is on
 * localhost, so plain parallel `fetch` gives the same progressive fill without
 * reconnection, buffering or half-parsed responses to handle.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import type { HubReads } from './hub-reads.js'

export type HubCells<T> = {
  reads: HubReads<T>
  /**
   * Re-read some hubs, or every hub when called with nothing.
   *
   * Takes names rather than refreshing everything because the common case
   * after an operation is one hub changing. Re-reading the fleet to show the
   * result of a click on one column is thirteen requests nobody asked for.
   */
  refresh: (names?: readonly string[]) => void
}

export function useHubCells<T>(
  hubNames: readonly string[],
  read: (hub: string) => Promise<T>,
): HubCells<T> {
  const [reads, setReads] = useState<HubReads<T>>({})

  // ⚠️ A sequence number **per hub**, not one for the whole hook. A single
  // counter would mean refreshing one column invalidated the in-flight reads
  // of every other column, which is exactly the fleet-wide behaviour this
  // hook exists to avoid — and it would show up as columns that silently
  // never fill, which is the hardest kind of bug to notice in a grid.
  const sequence = useRef<Record<string, number>>({})

  // Held in a ref so a caller can pass an inline arrow without re-running
  // every read on every render.
  const readRef = useRef(read)
  readRef.current = read

  const refreshNames = useCallback((names: readonly string[]) => {
    for (const name of names) {
      const mine = (sequence.current[name] ?? 0) + 1
      sequence.current[name] = mine
      setReads((current) => ({ ...current, [name]: { status: 'reading' } }))

      readRef.current(name).then(
        (data) => {
          if (sequence.current[name] === mine) {
            setReads((current) => ({ ...current, [name]: { status: 'ok', data } }))
          }
        },
        (err: unknown) => {
          if (sequence.current[name] === mine) {
            const error = err instanceof Error ? err.message : 'This hub could not be read.'
            setReads((current) => ({ ...current, [name]: { status: 'failed', error } }))
          }
        },
      )
    }
  }, [])

  // The hub list joined into one string so the effect compares by value: the
  // array identity changes on every render of the parent, and depending on it
  // directly would re-read the whole fleet each time.
  const key = hubNames.join('\u0000')

  const refresh = useCallback(
    (names?: readonly string[]) => {
      refreshNames(names ?? (key === '' ? [] : key.split('\u0000')))
    },
    [key, refreshNames],
  )

  useEffect(() => {
    refreshNames(key === '' ? [] : key.split('\u0000'))
  }, [key, refreshNames])

  return { reads, refresh }
}
