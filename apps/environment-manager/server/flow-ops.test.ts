import { describe, expect, it } from 'vitest'

import type { HubFlow } from './content-flows.ts'
import {
  confirmsRemoval,
  matchForAction,
  opKey,
  STATUS_FOR,
  Steps,
  summarise,
  type FlowAction,
  type OpOutcome,
} from './flow-ops.ts'

const LOCALIZE = 'Localise Content Item [Org]'

const flow = (id: string, label = LOCALIZE): HubFlow => ({ id, label, status: 'ENABLED' })

describe('opKey', () => {
  // ⚠️ The reason this exists: `runningOps` is keyed by environment name and
  // holds the spawned seed child. Sharing that key space would let a cancel
  // meant for a seed hit a flow op, or let one evict the other.
  it('is never just the hub name, so it cannot collide with runningOps', () => {
    expect(opKey('mattdemo', LOCALIZE, 'push')).not.toBe('mattdemo')
    expect(opKey('mattdemo', LOCALIZE, 'push')).toContain('mattdemo')
  })

  it('separates every action on one cell', () => {
    const actions: FlowAction[] = ['push', 'sync', 'remove', 'enable', 'disable']
    const keys = new Set(actions.map((action) => opKey('mattdemo', LOCALIZE, action)))
    expect(keys.size).toBe(actions.length)
  })

  it('separates two flows on one hub, and one flow on two hubs', () => {
    expect(opKey('a', 'one', 'push')).not.toBe(opKey('a', 'two', 'push'))
    expect(opKey('a', 'one', 'push')).not.toBe(opKey('b', 'one', 'push'))
  })

  // Labels are user-typed. A separator that can appear in one would let two
  // different cells share a key.
  it('cannot be confused by a label containing the separator-ish characters', () => {
    expect(opKey('a', 'x:y', 'push')).not.toBe(opKey('a:x', 'y', 'push'))
    expect(opKey('a', 'x-y', 'push')).not.toBe(opKey('a-x', 'y', 'push'))
  })
})

describe('matchForAction', () => {
  describe('push', () => {
    it('creates when the hub has nothing by that label', () => {
      expect(matchForAction([], LOCALIZE, 'push', 'mattdemo')).toEqual({
        ok: true,
        action: 'create',
      })
    })

    // The grid can be minutes old. Creating a second copy would manufacture
    // the duplicate state the tab exists to warn about.
    it('refuses when it is already there, and says the view was stale', () => {
      const result = matchForAction([flow('a')], LOCALIZE, 'push', 'mattdemo')
      expect(result.ok).toBe(false)
      expect(result).toHaveProperty('error', expect.stringContaining('already on mattdemo'))
      expect(result).toHaveProperty('error', expect.stringContaining('refresh'))
    })
  })

  describe('sync', () => {
    it('updates the one match', () => {
      const result = matchForAction([flow('a')], LOCALIZE, 'sync', 'mattdemo')
      expect(result).toEqual({ ok: true, action: 'update', flow: flow('a') })
    })

    it('refuses when the flow has gone since the grid loaded', () => {
      const result = matchForAction([], LOCALIZE, 'sync', 'mattdemo')
      expect(result.ok).toBe(false)
      expect(result).toHaveProperty('error', expect.stringContaining('not on mattdemo any more'))
    })
  })

  describe('remove', () => {
    it('deletes the one match', () => {
      const result = matchForAction([flow('a')], LOCALIZE, 'remove', 'mattdemo')
      expect(result).toEqual({ ok: true, action: 'delete', flow: flow('a') })
    })

    it('refuses when it is already gone rather than reporting success', () => {
      expect(matchForAction([], LOCALIZE, 'remove', 'mattdemo').ok).toBe(false)
    })
  })

  describe('duplicates', () => {
    const twins = [flow('first'), flow('second')]

    // The decision: refuse all of them, including remove. A wrong sync can be
    // pushed over; a wrong delete cannot be undone. Enable and disable are
    // reversible, but the blanket rule is easier to hold in your head than a
    // per-action exception, and the cell already explains itself.
    it('refuses every action, naming the candidates', () => {
      for (const action of ['push', 'sync', 'remove', 'enable', 'disable'] as const) {
        const result = matchForAction(twins, LOCALIZE, action, 'mattdemo')
        expect(result.ok).toBe(false)
        expect(result).toHaveProperty('error', expect.stringContaining('2 flows'))
        expect(result).toHaveProperty('error', expect.stringContaining('first'))
        expect(result).toHaveProperty('error', expect.stringContaining('second'))
      }
    })

    it('sends people to Workforce, where they can see what each flow does', () => {
      const result = matchForAction(twins, LOCALIZE, 'remove', 'mattdemo')
      expect(result).toHaveProperty('error', expect.stringContaining('Workforce'))
    })

    it('counts three as a duplicate too, not just two', () => {
      expect(matchForAction([...twins, flow('third')], LOCALIZE, 'sync', 'hub').ok).toBe(false)
    })
  })

  describe('enable and disable', () => {
    const running = flow('a')
    const paused: HubFlow = { ...flow('a'), status: 'DISABLED' }

    it('asks for the status the action names', () => {
      expect(matchForAction([paused], LOCALIZE, 'enable', 'mattdemo')).toEqual({
        ok: true,
        action: 'status',
        flow: paused,
        status: 'ENABLED',
        already: false,
      })
      expect(matchForAction([running], LOCALIZE, 'disable', 'mattdemo')).toEqual({
        ok: true,
        action: 'status',
        flow: running,
        status: 'DISABLED',
        already: false,
      })
    })

    // ⚠️ Succeeds rather than refusing, unlike every other stale-grid case.
    // Setting a status that is already set costs nothing and is what the
    // clicker wanted, so it is reported as done, not as a mistake.
    it('reports a no-op as already there instead of refusing', () => {
      expect(matchForAction([running], LOCALIZE, 'enable', 'h')).toMatchObject({
        ok: true,
        already: true,
      })
      expect(matchForAction([paused], LOCALIZE, 'disable', 'h')).toMatchObject({
        ok: true,
        already: true,
      })
    })

    // ⚠️ `HubFlow.status` is a loose string on purpose. Reading an unexpected
    // or missing value as "already in that state" would skip the mutation and
    // report success for a flow nobody touched.
    it('never claims already for a status it cannot read', () => {
      for (const status of [undefined, '', 'enabled', 'SOMETHING_NEW']) {
        const odd: HubFlow = {
          id: 'a',
          label: LOCALIZE,
          ...(status === undefined ? {} : { status }),
        }
        expect(matchForAction([odd], LOCALIZE, 'enable', 'h')).toMatchObject({ already: false })
      }
    })

    // Releasing a quarantined flow is the one thing anyone wants from that
    // cell; whether Workforce accepts it is reported, not guessed at here.
    it('lets a quarantined flow be enabled', () => {
      const stuck: HubFlow = { ...flow('a'), status: 'QUARANTINED' }
      expect(matchForAction([stuck], LOCALIZE, 'enable', 'h')).toMatchObject({
        ok: true,
        action: 'status',
        status: 'ENABLED',
        already: false,
      })
    })

    it('refuses when the flow is not on the hub any more', () => {
      const result = matchForAction([], LOCALIZE, 'disable', 'mattdemo')
      expect(result.ok).toBe(false)
      expect(result).toHaveProperty('error', expect.stringContaining('not on mattdemo'))
    })

    it('only ever sets the two statuses that are ours to set', () => {
      expect(Object.values(STATUS_FOR)).toEqual(['ENABLED', 'DISABLED'])
      expect(Object.values(STATUS_FOR)).not.toContain('QUARANTINED')
    })
  })

  it('matches the exact label, trimmed, like the grid and the push both do', () => {
    expect(matchForAction([flow('a', ` ${LOCALIZE} `)], LOCALIZE, 'sync', 'h').ok).toBe(true)
    expect(matchForAction([flow('a', LOCALIZE.toUpperCase())], LOCALIZE, 'sync', 'h').ok).toBe(
      false,
    )
  })

  it('ignores flows with other labels entirely', () => {
    const others = [flow('x', 'Something else'), flow('y', 'Another')]
    expect(matchForAction(others, LOCALIZE, 'push', 'h')).toEqual({ ok: true, action: 'create' })
  })
})

describe('confirmsRemoval', () => {
  it('accepts the label, however it was cased or spaced', () => {
    expect(confirmsRemoval(LOCALIZE, LOCALIZE)).toBe(true)
    expect(confirmsRemoval(`  ${LOCALIZE.toLowerCase()}  `, LOCALIZE)).toBe(true)
  })

  it('rejects anything else, including empty and near-misses', () => {
    expect(confirmsRemoval('', LOCALIZE)).toBe(false)
    expect(confirmsRemoval(undefined, LOCALIZE)).toBe(false)
    expect(confirmsRemoval('yes', LOCALIZE)).toBe(false)
    expect(confirmsRemoval(LOCALIZE.slice(0, -1), LOCALIZE)).toBe(false)
  })
})

describe('Steps', () => {
  /** A clock that advances by a fixed amount on each read. */
  const clock = (ticks: number[]) => {
    let i = 0
    return () => ticks[Math.min(i++, ticks.length - 1)]!
  }

  it('times each step from the end of the previous one', () => {
    const steps = new Steps(clock([0, 100, 350, 400]))
    steps.add('installed extension', 'Amplience Dynamic Content')
    steps.add('created flow', LOCALIZE)
    expect(steps.all()).toEqual([
      { label: 'installed extension', detail: 'Amplience Dynamic Content', ms: 100 },
      { label: 'created flow', detail: LOCALIZE, ms: 250 },
    ])
  })

  it('omits an absent detail rather than writing undefined', () => {
    const steps = new Steps(clock([0, 10]))
    steps.add('read the hub')
    expect(steps.all()[0]).toEqual({ label: 'read the hub', ms: 10 })
  })

  it('totals the steps, not the wall clock', () => {
    const steps = new Steps(clock([0, 100, 350]))
    steps.add('one')
    steps.add('two')
    expect(steps.totalMs()).toBe(350)
  })

  it('starts empty', () => {
    expect(new Steps(clock([0])).all()).toEqual([])
    expect(new Steps(clock([0])).totalMs()).toBe(0)
  })

  // The default clock is the one production uses, so it is worth one test
  // rather than only ever exercising the injected one.
  it('works on the real clock, recording a non-negative duration', () => {
    const steps = new Steps()
    steps.add('did something')
    expect(steps.all()).toHaveLength(1)
    expect(steps.all()[0]?.ms).toBeGreaterThanOrEqual(0)
  })

  it('hands out a copy, so a caller cannot mutate the record', () => {
    const steps = new Steps(clock([0, 1]))
    steps.add('one')
    steps.all().push({ label: 'forged', ms: 0 })
    expect(steps.all()).toHaveLength(1)
  })
})

describe('summarise', () => {
  const base = { action: 'push' as const, hub: 'mattdemo', label: LOCALIZE }

  // The extension install is the step most worth not hiding — it is a change
  // to the hub that nobody explicitly asked for.
  it('names every step, so an incidental install is visible', () => {
    const outcome: OpOutcome = {
      ...base,
      ok: true,
      steps: [
        { label: 'installed extension', detail: 'Amplience Dynamic Content', ms: 1200 },
        { label: 'created flow', ms: 900 },
      ],
    }
    expect(summarise(outcome)).toBe('installed extension, created flow')
  })

  it('leads with the failure when there was one', () => {
    const outcome: OpOutcome = { ...base, ok: false, steps: [], error: 'the token was refused' }
    expect(summarise(outcome)).toBe('push failed — the token was refused')
  })

  it('says so plainly when nothing happened', () => {
    expect(summarise({ ...base, ok: true, steps: [] })).toBe('push — nothing to do')
  })
})
