// @vitest-environment jsdom
//
// Smoke tests for the Button atom (QL-25).
// next/link is mocked to a plain <a> — same as Link.test.tsx.
// CSS module classes are empty strings in the test environment and are
// not asserted.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Button } from './Button'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

afterEach(cleanup)

describe('Button', () => {
  describe('button variant (no href)', () => {
    it('renders a <button> element', () => {
      render(<Button>Save</Button>)
      expect(screen.getByRole('button', { name: 'Save' }).tagName).toBe('BUTTON')
    })

    it('forwards onClick', () => {
      let clicked = false
      render(
        <Button
          onClick={() => {
            clicked = true
          }}
        >
          Click me
        </Button>,
      )
      screen.getByRole('button', { name: 'Click me' }).click()
      expect(clicked).toBe(true)
    })

    it('forwards disabled', () => {
      render(<Button disabled>Save</Button>)
      const el = screen.getByRole('button', { name: 'Save' })
      expect(el.disabled).toBe(true)
    })

    it('forwards title', () => {
      render(<Button title="Save the form">Save</Button>)
      expect(screen.getByRole('button', { name: 'Save' }).title).toBe('Save the form')
    })
  })

  describe('link variant (with href)', () => {
    it('renders an <a> element', () => {
      render(<Button href="/checkout">Continue</Button>)
      expect(screen.getByRole('link', { name: 'Continue' }).tagName).toBe('A')
    })

    it('passes href through', () => {
      render(<Button href="/checkout">Continue</Button>)
      expect(screen.getByRole('link', { name: 'Continue' }).getAttribute('href')).toBe('/checkout')
    })

    it('external href opens in a new tab', () => {
      render(<Button href="https://example.com">Visit</Button>)
      const el = screen.getByRole('link', { name: 'Visit' })
      expect(el.target).toBe('_blank')
    })

    it('forwards title', () => {
      render(
        <Button href="/foo" title="Go to Foo">
          Foo
        </Button>,
      )
      expect(screen.getByRole('link', { name: 'Foo' }).title).toBe('Go to Foo')
    })
  })

  describe('shared', () => {
    it('forwards additional class names (button)', () => {
      render(<Button className="custom">Save</Button>)
      expect(screen.getByRole('button', { name: 'Save' }).className).toContain('custom')
    })

    it('forwards additional class names (link)', () => {
      render(
        <Button href="/foo" className="custom">
          Foo
        </Button>,
      )
      expect(screen.getByRole('link', { name: 'Foo' }).className).toContain('custom')
    })
  })
})
