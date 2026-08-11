// @vitest-environment jsdom
//
// Tests for the Logo molecule — the linked and unlinked render branches, the
// locale prefixing the home link inherits from the renderer (ADR-0015), and
// the registry validator that guards the dispatch boundary.
// CSS module classes are empty strings in the test environment and are
// not asserted.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Logo } from './Logo'
import { logoRegistryEntry, validateLogoSchema } from './Logo.registry'

afterEach(cleanup)

const manualLogo = {
  mediaType: 'ManualImage' as const,
  image: {
    src: '/brand-logo.png',
    alt: 'Acme',
    width: 200,
    height: 48,
  },
}

describe('Logo', () => {
  describe('linked', () => {
    it('wraps the image in a link labelled "Home"', () => {
      render(<Logo image={manualLogo} link="/" />)
      // The label is what a screen-reader user hears; the image alt describes
      // the brand, not the destination, so the link needs its own name.
      const el = screen.getByRole<HTMLAnchorElement>('link', { name: 'Home' })
      expect(el.getAttribute('href')).toBe('/')
    })

    it('keeps the home link inside the active locale', () => {
      // ADR-0015: the renderer supplies the prefix; a logo that linked to the
      // bare root would drop the reader out of their locale on every page.
      render(<Logo image={manualLogo} link="/" localeBasePath="/fr-fr" />)
      expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/fr-fr')
    })

    it('links to the unprefixed path for the default locale', () => {
      render(<Logo image={manualLogo} link="/" localeBasePath="" />)
      expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/')
    })
  })

  describe('unlinked', () => {
    it('renders the image with no link when link is omitted', () => {
      render(<Logo image={manualLogo} />)
      expect(screen.queryByRole('link')).toBeNull()
      expect(screen.getByRole('img', { name: 'Acme' })).not.toBeNull()
    })

    it('renders the image with no link when link is an empty string', () => {
      // A CMS text field left blank arrives as '', not undefined — that must
      // not produce an <a href="">, which navigates to the current page.
      render(<Logo image={manualLogo} link="" />)
      expect(screen.queryByRole('link')).toBeNull()
    })
  })

  it('applies the caller className alongside the component class', () => {
    const { container } = render(<Logo image={manualLogo} className="HeaderLogo" />)
    const root = container.firstElementChild
    expect(root?.classList.contains('Logo')).toBe(true)
    expect(root?.classList.contains('HeaderLogo')).toBe(true)
  })
})

describe('validateLogoSchema', () => {
  it('accepts a ManualImage with a src', () => {
    expect(validateLogoSchema({ _meta: {}, image: manualLogo })).toBe(true)
  })

  it('accepts a DynamicImage with an image-link', () => {
    expect(
      validateLogoSchema({
        _meta: {},
        image: { mediaType: 'DynamicImage', image: { image: { name: 'brand-logo' } } },
      }),
    ).toBe(true)
  })

  it('rejects a non-object schema', () => {
    expect(validateLogoSchema(null)).toBe(false)
    expect(validateLogoSchema('logo')).toBe(false)
  })

  it('rejects a schema with no usable media object', () => {
    expect(validateLogoSchema({ _meta: {} })).toBe(false)
    expect(validateLogoSchema({ _meta: {}, image: 'brand-logo.png' })).toBe(false)
    expect(validateLogoSchema({ _meta: {}, image: null })).toBe(false)
  })

  it('rejects media whose inner image is missing or not an object', () => {
    expect(validateLogoSchema({ _meta: {}, image: { mediaType: 'ManualImage' } })).toBe(false)
    expect(
      validateLogoSchema({ _meta: {}, image: { mediaType: 'ManualImage', image: null } }),
    ).toBe(false)
  })

  it('rejects a ManualImage with no src', () => {
    // Renders as a broken image otherwise — the failure card is more useful.
    expect(
      validateLogoSchema({
        _meta: {},
        image: { mediaType: 'ManualImage', image: { alt: 'Acme' } },
      }),
    ).toBe(false)
  })

  it('rejects a DynamicImage whose image-link is absent or unnamed', () => {
    // `name` is what the DI URL is built from, so a link without one cannot
    // resolve to an asset.
    for (const link of [undefined, null, 'brand-logo', {}]) {
      expect(
        validateLogoSchema({
          _meta: {},
          image: { mediaType: 'DynamicImage', image: { image: link } },
        }),
      ).toBe(false)
    }
  })

  it('rejects an unrecognised mediaType', () => {
    expect(
      validateLogoSchema({ _meta: {}, image: { mediaType: 'Video', image: { src: '/clip.mp4' } } }),
    ).toBe(false)
  })
})

describe('logoRegistryEntry', () => {
  it('strips the envelope and threads the locale prefix through', () => {
    expect(
      logoRegistryEntry.propsFromSchema?.(
        { _meta: {}, image: manualLogo, link: '/' },
        { localeBasePath: '/fr-fr' },
      ),
    ).toEqual({ image: manualLogo, link: '/', localeBasePath: '/fr-fr' })
  })

  it('defaults the locale prefix to the unprefixed default locale', () => {
    expect(
      logoRegistryEntry.propsFromSchema?.({ _meta: {}, image: manualLogo, link: '/' }, {}),
    ).toEqual({ image: manualLogo, link: '/', localeBasePath: '' })
  })

  it('is not a container', () => {
    // A logo has no child content; declaring getChildren would make the
    // dispatcher recurse into a leaf.
    expect(logoRegistryEntry.getChildren).toBeUndefined()
  })
})
