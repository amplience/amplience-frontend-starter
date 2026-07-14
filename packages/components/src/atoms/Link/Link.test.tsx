// @vitest-environment jsdom
//
// Smoke tests for the Link atom (QL-25).
// next/link is mocked to a plain <a> — we're testing our routing logic and
// prop forwarding, not Next.js internals.
// CSS module classes are empty strings in the test environment and are
// not asserted.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Link } from './Link'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

afterEach(cleanup)

describe('Link', () => {
  it('renders an <a> element', () => {
    render(<Link href="/about">About</Link>)
    expect(screen.getByRole('link', { name: 'About' }).tagName).toBe('A')
  })

  it('internal link passes href through', () => {
    render(<Link href="/about">About</Link>)
    const el = screen.getByRole('link', { name: 'About' })
    expect(el.getAttribute('href')).toBe('/about')
  })

  it('external link opens in a new tab with noopener', () => {
    render(<Link href="https://example.com">External</Link>)
    const el = screen.getByRole<HTMLAnchorElement>('link', { name: 'External' })
    expect(el.target).toBe('_blank')
    expect(el.rel).toBe('noopener noreferrer')
  })

  it('internal link does not get target=_blank', () => {
    render(<Link href="/internal">Internal</Link>)
    const el = screen.getByRole<HTMLAnchorElement>('link', { name: 'Internal' })
    expect(el.target).toBe('')
  })

  it('protocol-relative URLs are treated as external', () => {
    render(<Link href="//cdn.example.com/img.png">CDN</Link>)
    const el = screen.getByRole<HTMLAnchorElement>('link', { name: 'CDN' })
    expect(el.target).toBe('_blank')
  })

  it('mailto: links are treated as external', () => {
    render(<Link href="mailto:hello@example.com">Email</Link>)
    const el = screen.getByRole<HTMLAnchorElement>('link', { name: 'Email' })
    expect(el.target).toBe('_blank')
  })

  it('tel: links are treated as external', () => {
    render(<Link href="tel:+441234567890">Call</Link>)
    const el = screen.getByRole<HTMLAnchorElement>('link', { name: 'Call' })
    expect(el.target).toBe('_blank')
  })

  it('forwards title attribute', () => {
    render(
      <Link href="/foo" title="The Foo Page">
        Foo
      </Link>,
    )
    const el = screen.getByRole<HTMLAnchorElement>('link', { name: 'Foo' })
    expect(el.title).toBe('The Foo Page')
  })

  it('forwards additional class names', () => {
    render(
      <Link href="/bar" className="custom">
        Bar
      </Link>,
    )
    expect(screen.getByRole('link', { name: 'Bar' }).className).toContain('custom')
  })

  it('caller can override target on external links', () => {
    render(
      <Link href="https://example.com" target="_self">
        Same tab
      </Link>,
    )
    const el = screen.getByRole<HTMLAnchorElement>('link', { name: 'Same tab' })
    expect(el.target).toBe('_self')
  })

  describe('locale prefixing (ADR-0015)', () => {
    it('prefixes an internal root-relative href with the locale base', () => {
      render(
        <Link href="/about" localeBasePath="/fr-fr">
          About
        </Link>,
      )
      expect(screen.getByRole('link', { name: 'About' }).getAttribute('href')).toBe('/fr-fr/about')
    })

    it('maps the bare root to the base with no trailing slash', () => {
      render(
        <Link href="/" localeBasePath="/fr-fr">
          Home
        </Link>,
      )
      expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/fr-fr')
    })

    it('leaves the href unchanged for the default locale (empty base)', () => {
      render(
        <Link href="/about" localeBasePath="">
          About
        </Link>,
      )
      expect(screen.getByRole('link', { name: 'About' }).getAttribute('href')).toBe('/about')
    })

    it('does not double-prefix an href already under the base (idempotent)', () => {
      render(
        <Link href="/fr-fr/about" localeBasePath="/fr-fr">
          About
        </Link>,
      )
      expect(screen.getByRole('link', { name: 'About' }).getAttribute('href')).toBe('/fr-fr/about')
    })

    it('never localizes external links', () => {
      render(
        <Link href="https://example.com" localeBasePath="/fr-fr">
          External
        </Link>,
      )
      expect(screen.getByRole('link', { name: 'External' }).getAttribute('href')).toBe(
        'https://example.com',
      )
    })

    it('leaves in-page anchors alone', () => {
      render(
        <Link href="#section" localeBasePath="/fr-fr">
          Jump
        </Link>,
      )
      expect(screen.getByRole('link', { name: 'Jump' }).getAttribute('href')).toBe('#section')
    })

    it('does not leak localeBasePath to the DOM', () => {
      render(
        <Link href="/about" localeBasePath="/fr-fr">
          About
        </Link>,
      )
      expect(screen.getByRole('link', { name: 'About' }).hasAttribute('localebasepath')).toBe(false)
    })
  })
})
