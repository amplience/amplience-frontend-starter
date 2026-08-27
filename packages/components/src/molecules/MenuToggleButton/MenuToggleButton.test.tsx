// @vitest-environment jsdom
//
// Tests for the MenuToggleButton molecule — the client-side half of Menu's
// zero-JS drawer contract: clicking toggles `data-open` on every
// nav.Menu[data-mobile-layout] on the page, and an open drawer closes on the
// next click anywhere.
// CSS module classes are empty strings in the test environment and are
// not asserted.
// Link hrefs are hash targets so jsdom does not log unimplemented navigation.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MenuToggleButton } from './MenuToggleButton'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** A stand-in for Menu's rendered output: <nav class="Menu" data-mobile-layout>. */
const MobileMenu = ({ label, children }: { label: string; children?: ReactNode }) => (
  <nav className="Menu" data-mobile-layout="true" aria-label={label}>
    {children}
  </nav>
)

/** A stand-in for Menu's items. */
const MenuItems = () => (
  <ul>
    <li>
      <a href="#womens">
        <span>Womens</span>
      </a>
    </li>
  </ul>
)

const getButton = () => screen.getByRole('button', { name: 'Toggle menu' })

describe('MenuToggleButton', () => {
  it('renders a button with the default accessible label and collapsed state', () => {
    render(<MenuToggleButton />)
    const button = getButton()
    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('uses the provided label', () => {
    render(<MenuToggleButton label="Open navigation" />)
    expect(screen.getByRole('button', { name: 'Open navigation' })).toBeTruthy()
  })

  it('falls back to the default label when given an empty string', () => {
    render(<MenuToggleButton label="" />)
    expect(getButton()).toBeTruthy()
  })

  it('toggles data-open on a mobile-layout menu and mirrors aria-expanded', () => {
    render(
      <>
        <MenuToggleButton />
        <MobileMenu label="Site navigation" />
      </>,
    )
    const nav = screen.getByRole('navigation', { name: 'Site navigation' })
    const button = getButton()

    fireEvent.click(button)
    expect(nav.hasAttribute('data-open')).toBe(true)
    expect(button.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(button)
    expect(nav.hasAttribute('data-open')).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('toggles every mobile-layout menu on the page', () => {
    render(
      <>
        <MenuToggleButton />
        <MobileMenu label="Primary" />
        <MobileMenu label="Secondary" />
      </>,
    )
    fireEvent.click(getButton())
    expect(screen.getByRole('navigation', { name: 'Primary' }).hasAttribute('data-open')).toBe(true)
    expect(screen.getByRole('navigation', { name: 'Secondary' }).hasAttribute('data-open')).toBe(
      true,
    )
  })

  it('leaves menus without data-mobile-layout alone', () => {
    render(
      <>
        <MenuToggleButton />
        <nav className="Menu" aria-label="Desktop-only" />
        <MobileMenu label="Mobile" />
      </>,
    )
    fireEvent.click(getButton())
    expect(screen.getByRole('navigation', { name: 'Desktop-only' }).hasAttribute('data-open')).toBe(
      false,
    )
    expect(screen.getByRole('navigation', { name: 'Mobile' }).hasAttribute('data-open')).toBe(true)
  })

  it('swaps the icon between menu and x as it opens and closes', () => {
    render(
      <>
        <MenuToggleButton />
        <MobileMenu label="Site navigation" />
      </>,
    )
    const button = getButton()
    // Lucide SVGs carry their icon name as a class (lucide-menu / lucide-x).
    expect(button.querySelector('svg.lucide-menu')).toBeTruthy()

    fireEvent.click(button)
    expect(button.querySelector('svg.lucide-x')).toBeTruthy()

    fireEvent.click(button)
    expect(button.querySelector('svg.lucide-menu')).toBeTruthy()
  })

  it('closes the drawer when a link inside it is followed', () => {
    render(
      <>
        <MenuToggleButton />
        <MobileMenu label="Site navigation">
          <MenuItems />
        </MobileMenu>
      </>,
    )
    const nav = screen.getByRole('navigation', { name: 'Site navigation' })
    const button = getButton()

    fireEvent.click(button)
    expect(nav.hasAttribute('data-open')).toBe(true)

    // Click the label inside the anchor: the click still reaches the document.
    fireEvent.click(screen.getByText('Womens'))
    expect(nav.hasAttribute('data-open')).toBe(false)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.querySelector('svg.lucide-menu')).toBeTruthy()
  })

  it('closes the drawer when a link elsewhere on the page is followed', () => {
    render(
      <>
        <a href="#home">Home</a>
        <MenuToggleButton />
        <MobileMenu label="Site navigation">
          <MenuItems />
        </MobileMenu>
      </>,
    )
    const nav = screen.getByRole('navigation', { name: 'Site navigation' })

    fireEvent.click(getButton())
    fireEvent.click(screen.getByText('Home'))
    expect(nav.hasAttribute('data-open')).toBe(false)
    expect(getButton().getAttribute('aria-expanded')).toBe('false')
  })

  it('closes the drawer on a click outside the menu', () => {
    render(
      <>
        <p>Page content</p>
        <MenuToggleButton />
        <MobileMenu label="Site navigation">
          <MenuItems />
        </MobileMenu>
      </>,
    )
    const nav = screen.getByRole('navigation', { name: 'Site navigation' })

    fireEvent.click(getButton())
    fireEvent.click(screen.getByText('Page content'))
    expect(nav.hasAttribute('data-open')).toBe(false)
  })

  it('closes every mobile-layout menu when one link is followed', () => {
    render(
      <>
        <MenuToggleButton />
        <MobileMenu label="Primary">
          <MenuItems />
        </MobileMenu>
        <MobileMenu label="Secondary" />
      </>,
    )
    fireEvent.click(getButton())
    fireEvent.click(screen.getByText('Womens'))
    expect(screen.getByRole('navigation', { name: 'Primary' }).hasAttribute('data-open')).toBe(
      false,
    )
    expect(screen.getByRole('navigation', { name: 'Secondary' }).hasAttribute('data-open')).toBe(
      false,
    )
  })

  it('reopens after closing on a link click', () => {
    render(
      <>
        <MenuToggleButton />
        <MobileMenu label="Site navigation">
          <MenuItems />
        </MobileMenu>
      </>,
    )
    const nav = screen.getByRole('navigation', { name: 'Site navigation' })

    fireEvent.click(getButton())
    fireEvent.click(screen.getByText('Womens'))
    fireEvent.click(getButton())
    expect(nav.hasAttribute('data-open')).toBe(true)
    expect(getButton().getAttribute('aria-expanded')).toBe('true')
  })

  it('warns and stays collapsed when no mobile-layout menu exists (fail-loud)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    render(<MenuToggleButton />)
    const button = getButton()

    fireEvent.click(button)
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]?.[0]).toContain('nothing to toggle')
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })
})
