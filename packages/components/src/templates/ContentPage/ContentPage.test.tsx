// @vitest-environment jsdom
//
// Smoke tests for the ContentPage template (QL-36).

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ContentPage } from './ContentPage'

afterEach(cleanup)

describe('ContentPage', () => {
  it('renders a <main> landmark', () => {
    render(<ContentPage>content</ContentPage>)
    expect(screen.getByRole('main').tagName).toBe('MAIN')
  })

  it('renders its children in order', () => {
    render(
      <ContentPage>
        <p>first slot</p>
        <p>second slot</p>
      </ContentPage>,
    )
    const paragraphs = [...screen.getByRole('main').querySelectorAll('p')].map((p) => p.textContent)
    expect(paragraphs).toEqual(['first slot', 'second slot'])
  })
})
