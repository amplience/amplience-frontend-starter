// @vitest-environment jsdom
//
// Smoke tests for the Slot organism (QL-36).

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Slot } from './Slot'

afterEach(cleanup)

describe('Slot', () => {
  it('renders its children in order', () => {
    const { container } = render(
      <Slot>
        <p>first</p>
        <p>second</p>
      </Slot>,
    )
    const paragraphs = [...container.querySelectorAll('p')].map((p) => p.textContent)
    expect(paragraphs).toEqual(['first', 'second'])
  })

  it('exposes a data-slot boundary that is invisible to layout', () => {
    const { container } = render(<Slot>content</Slot>)
    const el = container.querySelector('[data-slot]')
    expect(el).not.toBeNull()
    expect((el as HTMLElement).style.display).toBe('contents')
  })

  it('exposes the slot name when provided', () => {
    const { container } = render(<Slot name="home/main">content</Slot>)
    expect(container.querySelector('[data-slot="home/main"]')).not.toBeNull()
  })
})
