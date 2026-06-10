// @vitest-environment jsdom
//
// Smoke tests for the MarkdownBlock organism.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MarkdownBlock } from './MarkdownBlock'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

afterEach(cleanup)

describe('MarkdownBlock', () => {
  describe('structure', () => {
    it('renders content inside a section', () => {
      const { container } = render(<MarkdownBlock content="## Hello" />)
      expect(container.querySelector('section')).toBeTruthy()
    })

    it('renders the markdown heading', () => {
      render(<MarkdownBlock content="## Hello world" />)
      expect(screen.getByRole('heading', { level: 2, name: 'Hello world' })).toBeTruthy()
    })

    it('renders a paragraph', () => {
      render(<MarkdownBlock content="Some body copy." />)
      expect(screen.getByText('Some body copy.')).toBeTruthy()
    })
  })

  describe('bare mode', () => {
    it('does not render a section when bare is true', () => {
      const { container } = render(<MarkdownBlock content="## Hello" bare />)
      expect(container.querySelector('section')).toBeNull()
    })

    it('still renders the content when bare is true', () => {
      render(<MarkdownBlock content="## Bare heading" bare />)
      expect(screen.getByRole('heading', { level: 2, name: 'Bare heading' })).toBeTruthy()
    })
  })

  describe('data attributes', () => {
    it('sets data-background-color on the section', () => {
      const { container } = render(<MarkdownBlock content="Test" backgroundColor="light" />)
      expect(container.querySelector('[data-background-color="light"]')).toBeTruthy()
    })
  })
})
