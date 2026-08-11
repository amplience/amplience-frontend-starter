// @vitest-environment jsdom
//
// Tests for LocaleSelector (ADR-0015). next/navigation is mocked so we can
// drive the current path and observe navigation. The selector's job is to keep
// the reader on the same page while swapping the locale prefix.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LocaleSelector, type SelectorLocale } from './LocaleSelector'
import {
  localeSelectorRegistryEntry,
  validateLocaleSelectorSchema,
} from './LocaleSelector.registry'

const { nav } = vi.hoisted(() => ({ nav: { path: '/', search: '', push: vi.fn() } }))

vi.mock('next/navigation', () => ({
  usePathname: () => nav.path,
  useRouter: () => ({ push: nav.push }),
  useSearchParams: () => new URLSearchParams(nav.search),
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
  nav.search = ''
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

describe('LocaleSelector — query-param mode (visualizer)', () => {
  const renderQuery = (path: string, search: string) => {
    nav.path = path
    nav.search = search
    return render(<LocaleSelector locales={LOCALES} defaultSlug="en-us" localeParam="locale" />)
  }

  it('switches via the locale query param, preserving other params', () => {
    renderQuery('/visualization', 'vse=abc.staging.bigcontent.io&content=xyz')
    change('fr-fr')
    expect(nav.push).toHaveBeenCalledTimes(1)
    const url = new URL(`http://x${(nav.push.mock.calls[0] as string[])[0]}`)
    expect(url.pathname).toBe('/visualization')
    expect(url.searchParams.get('locale')).toBe('fr-fr')
    expect(url.searchParams.get('vse')).toBe('abc.staging.bigcontent.io')
    expect(url.searchParams.get('content')).toBe('xyz')
  })

  it('reflects the current locale from the query param (slug)', () => {
    renderQuery('/visualization', 'content=xyz&locale=de-de')
    expect(select().value).toBe('de-de')
  })

  it('accepts the delivery code (uppercase) in the query param', () => {
    renderQuery('/visualization', 'content=xyz&locale=de-DE')
    expect(select().value).toBe('de-de')
  })

  it('falls back to the default when the query param is absent', () => {
    renderQuery('/visualization', 'content=xyz')
    expect(select().value).toBe('en-us')
  })
})

describe('localeSelectorRegistryEntry', () => {
  it('accepts a body with a string label, or none at all', () => {
    expect(validateLocaleSelectorSchema({ _meta: {} })).toBe(true)
    expect(validateLocaleSelectorSchema({ _meta: {}, label: 'Language' })).toBe(true)
  })

  it('rejects a non-object body, or a label of the wrong type', () => {
    expect(validateLocaleSelectorSchema(null)).toBe(false)
    expect(validateLocaleSelectorSchema('Language')).toBe(false)
    expect(validateLocaleSelectorSchema({ _meta: {}, label: 42 })).toBe(false)
  })

  it('defaults to an empty locale list so the library entry renders nothing', () => {
    // ADR-0015: the locale list is deployment config the library can't know.
    // The default entry keeps the schema dispatchable in Storybook and the
    // visualizer without inventing locales; apps/web overrides it with real
    // config. Inert, not broken.
    expect(localeSelectorRegistryEntry.propsFromSchema?.({ _meta: {} }, {})).toEqual({
      locales: [],
      defaultSlug: '',
    })
  })

  it('keeps an authored label while still defaulting the list', () => {
    expect(
      localeSelectorRegistryEntry.propsFromSchema?.({ _meta: {}, label: 'Language' }, {}),
    ).toEqual({ locales: [], defaultSlug: '', label: 'Language' })
  })

  it('is not a container', () => {
    expect(localeSelectorRegistryEntry.getChildren).toBeUndefined()
  })
})
