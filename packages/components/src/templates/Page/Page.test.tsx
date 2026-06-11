// @vitest-environment jsdom
//
// Smoke tests for the Page template (QL-36).

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Page } from './Page'

afterEach(cleanup)

describe('Page', () => {
  it('renders a <main> landmark', () => {
    render(<Page>content</Page>)
    expect(screen.getByRole('main').tagName).toBe('MAIN')
  })

  it('renders its children in order', () => {
    render(
      <Page>
        <p>first slot</p>
        <p>second slot</p>
      </Page>,
    )
    const paragraphs = [...screen.getByRole('main').querySelectorAll('p')].map((p) => p.textContent)
    expect(paragraphs).toEqual(['first slot', 'second slot'])
  })
})
