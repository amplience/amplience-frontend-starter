import { describe, expect, it } from 'vitest'

import {
  addEntry,
  entryFromError,
  entryFromResult,
  entryId,
  failureCount,
  formatMs,
  MAX_ENTRIES,
  totalMs,
  type OpEntry,
} from './op-log.js'

const entry = (overrides: Partial<OpEntry> = {}): OpEntry => ({
  id: 'e1',
  subject: 'flow',
  action: 'push',
  hub: 'mattdemo',
  name: 'Localise Content Item [Org]',
  ok: true,
  steps: [{ label: 'created flow', ms: 900 }],
  at: 1_792_000_000_000,
  ...overrides,
})

describe('addEntry', () => {
  it('puts the newest first', () => {
    const log = addEntry(addEntry([], entry({ id: 'first' })), entry({ id: 'second' }))
    expect(log.map((e) => e.id)).toEqual(['second', 'first'])
  })

  it('never mutates the log it was given', () => {
    const original: OpEntry[] = [entry({ id: 'first' })]
    addEntry(original, entry({ id: 'second' }))
    expect(original.map((e) => e.id)).toEqual(['first'])
  })

  // A record of what just happened, not an audit trail — and an uncapped list
  // would eventually be the reason the page is slow.
  it('caps the log, dropping the oldest', () => {
    let log: OpEntry[] = []
    for (let i = 0; i < MAX_ENTRIES + 10; i += 1) log = addEntry(log, entry({ id: `e${i}` }))
    expect(log).toHaveLength(MAX_ENTRIES)
    expect(log[0]?.id).toBe(`e${MAX_ENTRIES + 9}`)
    expect(log.at(-1)?.id).toBe('e10')
  })

  // Two attempts at the same cell are two things that happened, not one.
  it('keeps both attempts at the same cell', () => {
    const log = addEntry(
      addEntry([], entry({ id: 'a', ok: false, error: 'refused' })),
      entry({ id: 'b' }),
    )
    expect(log).toHaveLength(2)
  })
})

describe('totalMs', () => {
  it('sums the steps', () => {
    expect(
      totalMs({
        steps: [
          { label: 'one', ms: 1200 },
          { label: 'two', ms: 900 },
        ],
      }),
    ).toBe(2100)
  })

  it('is zero for an entry that recorded nothing', () => {
    expect(totalMs({ steps: [] })).toBe(0)
  })
})

describe('formatMs', () => {
  // A bare "1s" beside "0.8s" reads as a rounder number than it is.
  it('always shows a decimal below a minute', () => {
    expect(formatMs(1000)).toBe('1.0s')
    expect(formatMs(840)).toBe('0.8s')
    expect(formatMs(0)).toBe('0.0s')
  })

  it('switches to minutes above one', () => {
    expect(formatMs(60_000)).toBe('1m 0s')
    expect(formatMs(95_000)).toBe('1m 35s')
  })

  it('refuses to render nonsense as a duration', () => {
    expect(formatMs(-1)).toBe('—')
    expect(formatMs(Number.NaN)).toBe('—')
    expect(formatMs(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('failureCount', () => {
  it('counts only the failures', () => {
    const log = [entry({ ok: true }), entry({ ok: false }), entry({ ok: false })]
    expect(failureCount(log)).toBe(2)
    expect(failureCount([])).toBe(0)
  })
})

describe('entryId', () => {
  it('is unique even for the same cell at the same millisecond', () => {
    const a = entryId('flow', 'mattdemo', 'Localise', 1)
    const b = entryId('flow', 'mattdemo', 'Localise', 1)
    expect(a).not.toBe(b)
  })

  it('carries the subject, so later tables are distinguishable in the log', () => {
    expect(entryId('listener', 'h', 'n', 1).startsWith('listener:')).toBe(true)
    expect(entryId('extension', 'h', 'n', 1).startsWith('extension:')).toBe(true)
  })
})

describe('entryFromResult', () => {
  const op = { action: 'push', hubLabel: 'mattdemo', label: 'Localise Content Item [Org]' }

  it('carries the steps, the hub and the name', () => {
    const built = entryFromResult(
      op,
      { ok: true, steps: [{ label: 'created flow', ms: 900 }] },
      1_792_000_000_000,
    )
    expect(built).toMatchObject({
      subject: 'flow',
      action: 'push',
      hub: 'mattdemo',
      name: 'Localise Content Item [Org]',
      ok: true,
      at: 1_792_000_000_000,
    })
    expect(built.steps).toHaveLength(1)
  })

  // ⚠️ The case that matters: a failure part-way through has usually already
  // changed the hub, and an entry showing only the error would make the next
  // attempt look like the first one.
  it('keeps the steps on a failure, alongside the error', () => {
    const built = entryFromResult(
      op,
      {
        ok: false,
        steps: [{ label: 'installed extension', detail: 'Dynamic Content', ms: 1200 }],
        error: 'the flow was refused',
      },
      1,
    )
    expect(built.ok).toBe(false)
    expect(built.error).toBe('the flow was refused')
    expect(built.steps[0]?.label).toBe('installed extension')
  })

  it('omits empty or absent warnings rather than rendering a blank list', () => {
    expect(entryFromResult(op, { ok: true, steps: [] }, 1)).not.toHaveProperty('warnings')
    expect(entryFromResult(op, { ok: true, steps: [], warnings: [] }, 1)).not.toHaveProperty(
      'warnings',
    )
    expect(entryFromResult(op, { ok: true, steps: [], warnings: ['careful'] }, 1).warnings).toEqual(
      ['careful'],
    )
  })
})

describe('entryFromError', () => {
  const op = { action: 'remove', hubLabel: 'mattdemo', label: 'Localise' }

  // No steps, because nothing is known to have happened — which is a
  // different state to retry from than "it got part way".
  it('records a failure with no steps', () => {
    const built = entryFromError(op, new Error('socket hang up'), 5)
    expect(built).toMatchObject({ ok: false, steps: [], error: 'socket hang up', at: 5 })
  })

  it('copes with something thrown that is not an Error', () => {
    expect(entryFromError(op, 'just a string', 5).error).toBe('just a string')
  })
})
