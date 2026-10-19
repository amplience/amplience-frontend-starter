import { describe, expect, it } from 'vitest'

import {
  ACTION_EXPLANATION,
  ACTION_GLYPH,
  ACTION_LABEL,
  cellDisplay,
  confirmCopy,
  isConfirmable,
  needsTypedConfirmation,
  offerFor,
  overwritesHubCopy,
  type CellAction,
} from './flow-actions.js'
import type { CellState } from './flow-rows.js'

const ALL_STATES: CellState[] = [
  'absent',
  'present',
  'disabled',
  'quarantined',
  'duplicate',
  'unavailable',
]

const ALL_ACTIONS: CellAction[] = ['push', 'sync', 'remove', 'enable', 'disable']

describe('offerFor', () => {
  it('offers only push when the flow is not there', () => {
    expect(offerFor('absent')).toEqual({ actions: ['push'] })
  })

  // A flow that is present, disabled or quarantined is *there*. What you can
  // do to it does not depend on whether it happens to be running.
  it('offers sync and remove for every state that means "it is on the hub"', () => {
    for (const state of ['present', 'disabled', 'quarantined'] as const) {
      expect(offerFor(state).actions).toContain('sync')
      expect(offerFor(state).actions).toContain('remove')
    }
  })

  // ⚠️ The pair that must never both appear: a cell offering play *and* pause
  // is a cell that does not know what the hub is doing.
  it('offers the one status action the cell is not already in', () => {
    expect(offerFor('present').actions).toEqual(['disable', 'sync', 'remove'])
    expect(offerFor('disabled').actions).toEqual(['enable', 'sync', 'remove'])
  })

  // Workforce quarantines a flow that keeps failing, so it is already not
  // responding to triggers — disabling it would be a button that does nothing.
  it('offers enable but not disable on a quarantined flow', () => {
    expect(offerFor('quarantined').actions).toContain('enable')
    expect(offerFor('quarantined').actions).not.toContain('disable')
  })

  it('never offers both halves of the pair in one cell', () => {
    for (const state of ALL_STATES) {
      const { actions } = offerFor(state)
      expect(actions.includes('enable') && actions.includes('disable')).toBe(false)
    }
  })

  it('never offers push for a flow that is already there', () => {
    for (const state of ['present', 'disabled', 'quarantined'] as const) {
      expect(offerFor(state).actions).not.toContain('push')
    }
  })

  // The decision: refuse all three on a duplicate, remove included.
  it('offers nothing on a duplicate, and says to fix it in Workforce', () => {
    const offer = offerFor('duplicate')
    expect(offer.actions).toEqual([])
    expect(offer.reason).toMatch(/Workforce/)
    expect(offer.reason).toMatch(/share this label/)
  })

  it('offers nothing when the hub cannot be read', () => {
    const offer = offerFor('unavailable')
    expect(offer.actions).toEqual([])
    expect(offer.reason).toBeTruthy()
  })

  it('gives a reason exactly when it offers nothing', () => {
    for (const state of ALL_STATES) {
      const offer = offerFor(state)
      expect(offer.actions.length === 0).toBe(offer.reason !== undefined)
    }
  })

  it('covers every cell state, so a new one cannot slip through untyped', () => {
    for (const state of ALL_STATES) {
      expect(offerFor(state)).toBeDefined()
    }
  })
})

describe('confirmation rules', () => {
  // Remove is the only one with no undo, so it is the only one that makes
  // someone type the label.
  it('demands the label typed back for remove alone', () => {
    expect(needsTypedConfirmation('remove')).toBe(true)
    expect(needsTypedConfirmation('sync')).toBe(false)
    expect(needsTypedConfirmation('push')).toBe(false)
  })

  // Sync is recoverable — push it again — but what it overwrites may not be.
  it('flags sync as overwriting the hub’s own copy', () => {
    expect(overwritesHubCopy('sync')).toBe(true)
    expect(overwritesHubCopy('push')).toBe(false)
    expect(overwritesHubCopy('remove')).toBe(false)
  })

  it('does not ask twice for the same action', () => {
    for (const action of ALL_ACTIONS) {
      expect(needsTypedConfirmation(action) && overwritesHubCopy(action)).toBe(false)
    }
  })

  // ⚠️ Undone by clicking the other half of the pair, so a dialog in front of
  // them would be ceremony — and a confirmation people learn to click through
  // is worse than none, because remove depends on the reflex not existing.
  it('lets enable and disable through without asking', () => {
    for (const action of ['enable', 'disable'] as CellAction[]) {
      expect(needsTypedConfirmation(action)).toBe(false)
      expect(overwritesHubCopy(action)).toBe(false)
      expect(isConfirmable(action)).toBe(false)
    }
  })

  // `isConfirmable` is what routes a click to the dialog, so it has to agree
  // with the two predicates that say why a dialog is needed.
  it('asks exactly when one of the two reasons to ask applies', () => {
    for (const action of ALL_ACTIONS) {
      expect(isConfirmable(action)).toBe(
        needsTypedConfirmation(action) || overwritesHubCopy(action),
      )
    }
  })
})

describe('presentation tables', () => {
  it('has a label, glyph and explanation for every action', () => {
    for (const action of ALL_ACTIONS) {
      expect(ACTION_LABEL[action]).toBeTruthy()
      expect(ACTION_GLYPH[action]).toBeTruthy()
      expect(ACTION_EXPLANATION[action]).toBeTruthy()
    }
  })

  // The two destructive ones have to say what is lost, not just what happens.
  it('says what sync and remove cost, in their own words', () => {
    expect(ACTION_EXPLANATION.sync).toMatch(/those changes go/)
    expect(ACTION_EXPLANATION.remove).toMatch(/no undo/)
  })

  // The reassurance is the point: someone hovering "disable" on a customer's
  // hub wants to know the run history survives before they click.
  it('says disabling keeps the flow and is reversible', () => {
    expect(ACTION_EXPLANATION.disable).toMatch(/stays on the hub/i)
    expect(ACTION_EXPLANATION.disable).toMatch(/enabled again/)
    expect(ACTION_EXPLANATION.enable).toMatch(/[Rr]eversible/)
  })

  it('gives every action a glyph of its own', () => {
    const glyphs = ALL_ACTIONS.map((action) => ACTION_GLYPH[action])
    expect(new Set(glyphs).size).toBe(glyphs.length)
  })
})

describe('confirmCopy', () => {
  // The copy that warns someone before an irreversible delete is the last
  // copy that should go unchecked, which is why it is here and not inline.
  it('names the hub and what remove costs, and asks for the label', () => {
    const copy = confirmCopy('remove', 'Localise Content Item [Org]', 'mattdemo')
    expect(copy.title).toContain('Remove')
    expect(copy.title).toContain('Localise Content Item [Org]')
    expect(copy.intro).toContain('From mattdemo')
    expect(copy.intro).toMatch(/no undo/)
    expect(copy.confirmLabel).toBe('Remove from this hub')
    expect(copy.danger).toBe(true)
    expect(copy.typed).toBe(true)
  })

  it('says sync overwrites, without demanding the label', () => {
    const copy = confirmCopy('sync', 'Translate', 'quadratic-lite')
    expect(copy.title).toContain('Sync')
    expect(copy.intro).toContain('To quadratic-lite')
    expect(copy.intro).toMatch(/those changes go/)
    expect(copy.danger).toBe(false)
    expect(copy.typed).toBe(false)
  })

  it('never offers the same button text for both', () => {
    expect(confirmCopy('remove', 'x', 'h').confirmLabel).not.toBe(
      confirmCopy('sync', 'x', 'h').confirmLabel,
    )
  })
})

describe('cellDisplay', () => {
  it('shows the cell’s own state when nothing is running', () => {
    expect(cellDisplay('✓', 'On hub', undefined)).toEqual({ glyph: '✓', label: 'On hub' })
  })

  it('takes over while an operation runs', () => {
    expect(cellDisplay('·', 'Not there', 'running')).toEqual({ glyph: '…', label: 'Working…' })
  })

  // The tick is feedback about the click, not a claim about the hub — so the
  // words stay the cell's own, and only the glyph confirms.
  it('ticks on success but keeps describing the hub', () => {
    expect(cellDisplay('·', 'Not there', 'done')).toEqual({ glyph: '✓', label: 'Not there' })
  })

  it('says plainly when the operation failed', () => {
    expect(cellDisplay('✓', 'On hub', 'failed')).toEqual({ glyph: '!', label: 'Failed' })
  })
})
