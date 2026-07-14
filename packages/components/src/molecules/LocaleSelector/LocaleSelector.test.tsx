// @vitest-environment jsdom
//
// Tests for LocaleSelector (ADR-0015). next/navigation is mocked so we can
// drive the current path and observe navigation. The selector's job is to keep
// the reader on the same page while swapping the locale prefix.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LocaleSelector, type SelectorLocale } from './LocaleSelector'

const { nav } = vi.hoisted(() => ({ nav: { path: '/', push: vi.fn() } }))

vi.mock('next/navigation', () => ({
  usePathname: () => nav.path,
  useRouter: () => ({ push: nav.push }),
}))

const LOCALES: SelectorLocale[] = [
  { slug: 'en-us', label: 'English (US)' },
  { slug: 'fr-fr', label: 'Français (FR)' },
  { slug: 'de-de', label: 'Deutsch (DE)' },
]

const renderSelector = (path: string, locales: SelectorLocale[] = LOCALES) => {
  nav.path = path
  return render(<LocaleSelector locales={locales} defaultSlug="en-us" />)
}

const select = () => screen.getByRole<HTMLSelectElement>('combobox')
const change = (value: string) => fireEvent.change(select(), { target: { value } })

beforeEach(() => {
  nav.push.mockReset()
})
afterEach(cleanup)

describe('LocaleSelector', () => {
  it('renders nothing when there is a single locale', () => {
    renderSelector('/about', [{ slug: 'en-us', label: 'English (US)' }])
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('renders an option per locale when there are several', () => {
    renderSelector('/about')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'English (US)',
      'Français (FR)',
      'Deutsch (DE)',
    ])
  })

  it('reflects the current locale from a prefixed path', () => {
    renderSelector('/de-de/about')
    expect(select().value).toBe('de-de')
  })

  it('reflects the default locale on an unprefixed path', () => {
    renderSelector('/about')
    expect(select().value).toBe('en-us')
  })

  it('switches to another locale, keeping the same page', () => {
    renderSelector('/de-de/about')
    change('fr-fr')
    expect(nav.push).toHaveBeenCalledWith('/fr-fr/about')
  })

  it('switching to the default locale drops the prefix', () => {
    renderSelector('/de-de/about')
    change('en-us')
    expect(nav.push).toHaveBeenCalledWith('/about')
  })

  it('adds a prefix when switching away from the default locale', () => {
    renderSelector('/about')
    change('fr-fr')
    expect(nav.push).toHaveBeenCalledWith('/fr-fr/about')
  })

  it('handles the homepage root in both directions', () => {
    renderSelector('/fr-fr')
    expect(select().value).toBe('fr-fr')
    change('en-us')
    expect(nav.push).toHaveBeenCalledWith('/')

    nav.push.mockReset()
    cleanup()
    renderSelector('/')
    change('fr-fr')
    expect(nav.push).toHaveBeenCalledWith('/fr-fr')
  })

  it('uses a custom accessible label when provided', () => {
    nav.path = '/about'
    render(<LocaleSelector locales={LOCALES} defaultSlug="en-us" label="Choose language" />)
    expect(screen.getByRole('combobox', { name: 'Choose language' })).toBeDefined()
  })
})
