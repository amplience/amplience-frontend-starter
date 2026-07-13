// @vitest-environment jsdom
//
// Tests for the MenuToggleButton molecule — the client-side half of Menu's
// zero-JS drawer contract: clicking toggles `data-open` on every
// nav.Menu[data-mobile-layout] on the page.
// CSS module classes are empty strings in the test environment and are
// not asserted.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MenuToggleButton } from './MenuToggleButton'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** A stand-in for Menu's rendered output: <nav class="Menu" data-mobile-layout>. */
const MobileMenu = ({ label }: { label: string }) => (
  <nav className="Menu" data-mobile-layout="true" aria-label={label} />
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
