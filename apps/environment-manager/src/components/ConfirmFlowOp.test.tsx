// @vitest-environment jsdom
//
// The guard in front of a sync or a remove (QL-162).
//
// This is the component most worth testing in the app: it is the last thing
// between a click and an irreversible delete on a customer's hub, and two of
// its protections are invisible — focus starting on Cancel, and the confirming
// button staying disabled until the label matches. Both exist so that a Return
// held down from the click that opened the dialog cannot carry through it, and
// neither is something you would notice had broken.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConfirmFlowOp, type ConfirmableOp } from './ConfirmFlowOp.js'

afterEach(cleanup)

const LABEL = 'Create page from a Screenshot [MI]'

const op = (overrides: Partial<ConfirmableOp> = {}): ConfirmableOp => ({
  action: 'remove',
  hub: 'douglas',
  hubLabel: 'Douglas',
  label: LABEL,
  ...overrides,
})

const confirmButton = () => screen.getByRole('button', { name: /Remove from this hub|Overwrite/ })

describe('ConfirmFlowOp — remove', () => {
  it('names the flow and the hub it is coming off', () => {
    render(<ConfirmFlowOp op={op()} onConfirm={vi.fn()} onCancel={vi.fn()} />)

    // A function matcher rather than a built RegExp: the repo bans patterns
    // assembled at runtime, and the label is full of brackets anyway.
    expect(screen.getByRole('heading', { name: (name) => name.includes(LABEL) })).toBeDefined()
    expect(screen.getByText(/From Douglas/)).toBeDefined()
    expect(screen.getByText(/no archive and no undo/)).toBeDefined()
  })

  // ⚠️ The guard that is easiest to break and hardest to notice.
  it('starts with focus on Cancel, never on the destructive button', () => {
    render(<ConfirmFlowOp op={op()} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
  })

  it('keeps the confirming button disabled until the label is typed', () => {
    render(<ConfirmFlowOp op={op()} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(confirmButton()).toHaveProperty('disabled', true)

    fireEvent.change(screen.getByLabelText(/Type the flow/), { target: { value: 'not it' } })
    expect(confirmButton()).toHaveProperty('disabled', true)

    fireEvent.change(screen.getByLabelText(/Type the flow/), { target: { value: LABEL } })
    expect(confirmButton()).toHaveProperty('disabled', false)
  })

  // Typing it is meant to make someone read the label, not test their shift
  // key — a guard that rejects the right answer teaches people to paste.
  it('accepts the label whatever its case or surrounding space', () => {
    render(<ConfirmFlowOp op={op()} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/Type the flow/), {
      target: { value: `  ${LABEL.toUpperCase()}  ` },
    })
    expect(confirmButton()).toHaveProperty('disabled', false)
  })

  it('passes the typed text back so the server can check it too', () => {
    const onConfirm = vi.fn()
    render(<ConfirmFlowOp op={op()} onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/Type the flow/), { target: { value: LABEL } })
    fireEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledWith(LABEL)
  })

  it('cancels on the button, on Escape and on a backdrop click', () => {
    const onCancel = vi.fn()
    const { container, rerender } = render(
      <ConfirmFlowOp op={op()} onConfirm={vi.fn()} onCancel={onCancel} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    rerender(<ConfirmFlowOp op={op()} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(2)

    const backdrop = container.querySelector('.modal-backdrop')
    fireEvent.click(backdrop!)
    expect(onCancel).toHaveBeenCalledTimes(3)
  })

  // A drag that starts inside and ends outside should not destroy anything.
  it('does not cancel on a click that started inside the dialog', () => {
    const onCancel = vi.fn()
    render(<ConfirmFlowOp op={op()} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onCancel).not.toHaveBeenCalled()
  })
})

describe('ConfirmFlowOp — sync', () => {
  const syncOp = op({ action: 'sync' })

  // Recoverable by pushing again, so it asks rather than demands — but what
  // it overwrites may not be, so it still asks.
  it('warns what is overwritten without demanding the label', () => {
    render(<ConfirmFlowOp op={syncOp} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(/To Douglas/)).toBeDefined()
    expect(screen.getByText(/those changes go/)).toBeDefined()
    expect(screen.queryByLabelText(/Type the flow/)).toBeNull()
  })

  it('is confirmable straight away, and sends no typed text', () => {
    const onConfirm = vi.fn()
    render(<ConfirmFlowOp op={syncOp} onConfirm={onConfirm} onCancel={vi.fn()} />)
    const button = screen.getByRole('button', { name: /Overwrite/ })
    expect(button).toHaveProperty('disabled', false)
    fireEvent.click(button)
    expect(onConfirm).toHaveBeenCalledWith(undefined)
  })

  // Focus still avoids the confirming button, even where it is not destructive.
  it('still starts focus on Cancel', () => {
    render(<ConfirmFlowOp op={syncOp} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
  })
})
