// The rule that decides what a column says about itself.
//
// Three states look identical in a naive model — no data — and mean completely
// different things to someone reading the grid: wait, something broke, and go
// and set a token up. Every case below is one of those three being told apart,
// which is the whole reason this is a function rather than a ternary inside a
// component.

import { describe, expect, it } from 'vitest'

import { allSettled, readingHubs, resolveColumn, type HubReads } from './hub-reads.js'

const FLOWS = [{ id: 'a', label: 'Localise' }]

describe('resolveColumn', () => {
  it('reports rows the hub returned', () => {
    expect(resolveColumn({ status: 'ok', data: { rows: FLOWS } })).toEqual({ rows: FLOWS })
  })

  // An empty hub is a hub we read successfully. It must not fall through to
  // "unavailable", which would tell someone to go and fix a token that is fine.
  it('treats an empty list as an answer, not as a failure', () => {
    expect(resolveColumn({ status: 'ok', data: { rows: [] } })).toEqual({ rows: [] })
  })

  it('passes a stated reason through untouched', () => {
    expect(resolveColumn({ status: 'ok', data: { unavailable: { reason: 'no-token' } } })).toEqual({
      unavailable: { reason: 'no-token' },
    })
  })

  it('is reading while the request is in flight', () => {
    expect(resolveColumn({ status: 'reading' })).toEqual({ reading: true })
  })

  // ⚠️ The gap between the grid rendering and the request being issued. A
  // column that flickered through "unavailable" on its way to its data would
  // be worse than one that says it is still working.
  it('is reading, not unavailable, before a request exists at all', () => {
    expect(resolveColumn(undefined)).toEqual({ reading: true })
  })

  // ⚠️ A transport failure is `error`, never `no-token`: the reason decides
  // what the UI tells someone to do, and "set up a token" is bad advice for a
  // request that never reached the server.
  it('reports a transport failure as an error, carrying the message', () => {
    expect(resolveColumn({ status: 'failed', error: 'socket hang up' })).toEqual({
      unavailable: { reason: 'error', detail: 'socket hang up' },
    })
  })

  it('falls back to an error for a response that says nothing at all', () => {
    expect(resolveColumn({ status: 'ok', data: {} })).toEqual({
      unavailable: { reason: 'error' },
    })
  })
})

describe('readingHubs and allSettled', () => {
  const reads: HubReads<{ rows?: string[] }> = {
    douglas: { status: 'ok', data: { rows: [] } },
    anyafinn: { status: 'reading' },
    schaeffler: { status: 'failed', error: 'nope' },
  }
  const names = ['douglas', 'anyafinn', 'schaeffler', 'mattdemo']

  // A hub with no entry has not been read, so it counts as outstanding.
  it('counts a hub with no entry as still reading', () => {
    expect(readingHubs(names, reads)).toEqual(['anyafinn', 'mattdemo'])
  })

  // A failure is settled: it is not going to change on its own, and waiting
  // for it would mean never announcing the grid as finished.
  it('treats a failed read as settled', () => {
    expect(readingHubs(['schaeffler'], reads)).toEqual([])
    expect(allSettled(['douglas', 'schaeffler'], reads)).toBe(true)
  })

  it('is settled only when nothing is outstanding', () => {
    expect(allSettled(names, reads)).toBe(false)
    expect(allSettled([], reads)).toBe(true)
  })
})
