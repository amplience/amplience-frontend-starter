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
      const el = screen.getByRole<HTMLButtonElement>('button', { name: 'Save' })
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
      const el = screen.getByRole<HTMLAnchorElement>('link', { name: 'Visit' })
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

  describe('inert variant (asSpan)', () => {
    it('renders a <span> element', () => {
      render(<Button asSpan>Shop now</Button>)
      expect(screen.getByText('Shop now').tagName).toBe('SPAN')
    })

    it('is not exposed as a button or link to assistive tech', () => {
      render(<Button asSpan>Shop now</Button>)
      expect(screen.queryByRole('button')).toBeNull()
      expect(screen.queryByRole('link')).toBeNull()
    })

    it('does not leak asSpan or localeBasePath to the DOM', () => {
      render(
        <Button asSpan localeBasePath="/fr-fr">
          Shop now
        </Button>,
      )
      const el = screen.getByText('Shop now')
      expect(el.hasAttribute('localebasepath')).toBe(false)
      expect(el.hasAttribute('asspan')).toBe(false)
    })

    it('still applies variant and colour styling hooks', () => {
      render(
        <Button asSpan variant="outlined" color="primary">
          Shop now
        </Button>,
      )
      const el = screen.getByText('Shop now')
      expect(el.getAttribute('data-variant')).toBe('outlined')
      expect(el.getAttribute('data-color')).toBe('primary')
    })

    it('a Button without href or onClick is still a real <button>', () => {
      render(<Button>Save</Button>)
      expect(screen.getByText('Save').tagName).toBe('BUTTON')
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
