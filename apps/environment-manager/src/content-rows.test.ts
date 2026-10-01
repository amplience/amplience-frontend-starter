import { describe, expect, it } from 'vitest'

import {
  canWipeEverything,
  contentRows,
  gateReason,
  localeNote,
  type ContentBreakdown,
} from './content-rows.js'
import type { FixtureSetInfo } from './types.js'

const set = (name: string, authoredLocales: string[] = ['en-US']): FixtureSetInfo => ({
  name,
  label: name === 'frontend-starter' ? 'Amplience Frontend Starter' : 'Anya Finn',
  description: '',
  defaultBrand: name,
  defaultLocale: 'en-US',
  authoredLocales,
  generatedDocs: false,
})

const SETS = [set('frontend-starter', ['en-US', 'en-GB', 'fr-FR']), set('anyafinn')]

const available = (over: Partial<Extract<ContentBreakdown, { available: true }>> = {}) =>
  ({
    available: true,
    bySet: { 'frontend-starter': 142, anyafinn: 53 },
    orphaned: 0,
    custom: 0,
    ...over,
  }) satisfies ContentBreakdown

describe('contentRows', () => {
  it('gives every registered set a row, in the order the sets are listed', () => {
    expect(contentRows(available(), SETS).map((r) => r.key)).toEqual([
      'frontend-starter',
      'anyafinn',
    ])
  })

  it('shows a set that has never been seeded at zero rather than omitting it', () => {
    // Missing would read as unavailable; zero reads as "nothing here yet".
    const rows = contentRows(available({ bySet: { 'frontend-starter': 142 } }), SETS)
    expect(rows.find((r) => r.key === 'anyafinn')).toMatchObject({ count: 0, canSync: true })
  })

  it('lets a set row both sync and wipe, because the repository can put it back', () => {
    const row = contentRows(available(), SETS)[0]
    expect(row).toMatchObject({ canSync: true, canWipe: true, regenerable: true })
  })

  it('adds orphaned and custom rows only when they hold something', () => {
    expect(contentRows(available(), SETS).map((r) => r.kind)).toEqual(['set', 'set'])
    const rows = contentRows(available({ orphaned: 53, custom: 942 }), SETS)
    expect(rows.map((r) => r.key)).toEqual(['frontend-starter', 'anyafinn', 'orphaned', 'custom'])
  })

  it('never offers sync on orphaned or custom — there is no source on disk', () => {
    // The definition of both buckets, not a policy choice.
    const rows = contentRows(available({ orphaned: 1, custom: 1 }), SETS)
    for (const row of rows.filter((r) => r.kind !== 'set')) {
      expect(row.canSync, `${row.key} offered sync`).toBe(false)
      expect(row.canWipe).toBe(true)
      expect(row.regenerable, `${row.key} claimed to be regenerable`).toBe(false)
    }
  })

  it('keeps orphaned and custom as separate rows', () => {
    // Collapsed, a "wipe custom" would destroy a retired set's live content
    // while presenting itself as tidying up strays.
    const rows = contentRows(available({ orphaned: 53, custom: 942 }), SETS)
    expect(rows.find((r) => r.kind === 'orphaned')?.count).toBe(53)
    expect(rows.find((r) => r.kind === 'custom')?.count).toBe(942)
  })

  it('renders no rows at all when the breakdown is unavailable', () => {
    // Not zeroes, which would be a guess presented as a fact.
    expect(contentRows({ available: false, reason: 'No map.' }, SETS)).toEqual([])
  })

  it('renders no rows before the breakdown has loaded', () => {
    expect(contentRows(null, SETS)).toEqual([])
  })
})

describe('localeNote', () => {
  it('reports how many of a set’s authored locales the hub can take', () => {
    expect(localeNote(set('x', ['en-US', 'en-GB', 'fr-FR']), ['en-US', 'fr-FR'])).toBe(
      '2 of 3 locales kept',
    )
  })

  it('says nothing when the hub covers everything the set authored', () => {
    // "3 of 3" on every row is noise.
    expect(localeNote(set('x', ['en-US', 'fr-FR']), ['en-US', 'fr-FR', 'de-DE'])).toBeUndefined()
  })

  it('says nothing when the hub’s locales are unknown', () => {
    expect(localeNote(set('x', ['en-US', 'fr-FR']), [])).toBeUndefined()
  })

  it('sits on the set row, where the filtering actually happens', () => {
    const rows = contentRows(available(), SETS, ['en-US', 'fr-FR'])
    expect(rows.find((r) => r.key === 'frontend-starter')?.localeNote).toBe('2 of 3 locales kept')
    expect(rows.find((r) => r.key === 'anyafinn')?.localeNote).toBeUndefined()
  })
})

describe('the provenance gate', () => {
  it('explains itself when the breakdown is unavailable', () => {
    expect(gateReason({ available: false, reason: 'No dc-cli import map.' })).toBe(
      'No dc-cli import map.',
    )
  })

  it('says nothing when the breakdown is available, or still loading', () => {
    expect(gateReason(available())).toBeNull()
    expect(gateReason(null)).toBeNull()
  })

  it('leaves the wholesale wipes available regardless', () => {
    // They enumerate the hub directly and need no provenance — which is what
    // leaves wipe-and-reseed as a recovery path rather than a dead end.
    expect(canWipeEverything()).toBe(true)
  })
})
