// @vitest-environment jsdom
//
// Tests for the IconButton molecule — both render branches (<a> for
// navigation, <button> for actions) and the client-parent affordances
// (onClick, expanded) that MenuToggleButton builds on.
// CSS module classes are empty strings in the test environment and are
// not asserted.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { IconButton } from './IconButton'
import { iconButtonRegistryEntry, validateIconButtonSchema } from './IconButton.registry'

afterEach(cleanup)

describe('IconButton', () => {
  describe('link variant', () => {
    it('renders an <a> with the href and accessible label', () => {
      render(<IconButton icon="cart" label="Shopping cart" link="/cart" />)
      const el = screen.getByRole<HTMLAnchorElement>('link', { name: 'Shopping cart' })
      expect(el.getAttribute('href')).toBe('/cart')
    })
  })

  describe('button variant (no link)', () => {
    it('renders a <button type="button"> with the accessible label', () => {
      render(<IconButton icon="search" label="Search" />)
      const el = screen.getByRole<HTMLButtonElement>('button', { name: 'Search' })
      expect(el.type).toBe('button')
    })

    it('forwards onClick', () => {
      const onClick = vi.fn()
      render(<IconButton icon="search" label="Search" onClick={onClick} />)
      fireEvent.click(screen.getByRole('button', { name: 'Search' }))
      expect(onClick).toHaveBeenCalledOnce()
    })

    it('renders expanded as aria-expanded', () => {
      render(<IconButton icon="menu" label="Toggle menu" expanded />)
      expect(
        screen.getByRole('button', { name: 'Toggle menu' }).getAttribute('aria-expanded'),
      ).toBe('true')
    })

    it('omits aria-expanded for plain action buttons', () => {
      render(<IconButton icon="search" label="Search" />)
      expect(screen.getByRole('button', { name: 'Search' }).hasAttribute('aria-expanded')).toBe(
        false,
      )
    })

    it('renders disabled as the native disabled attribute', () => {
      render(<IconButton icon="chevron-left" label="Previous" disabled />)
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Previous' }).disabled).toBe(
        true,
      )
    })

    it('is enabled and free of aria-controls by default', () => {
      render(<IconButton icon="chevron-left" label="Previous" />)
      const el = screen.getByRole<HTMLButtonElement>('button', { name: 'Previous' })
      expect(el.disabled).toBe(false)
      expect(el.hasAttribute('aria-controls')).toBe(false)
    })

    it('renders controls as aria-controls', () => {
      render(<IconButton icon="chevron-right" label="Next" controls="track-1" />)
      expect(screen.getByRole('button', { name: 'Next' }).getAttribute('aria-controls')).toBe(
        'track-1',
      )
    })

    it('does not fire onClick when disabled', () => {
      const onClick = vi.fn()
      render(<IconButton icon="chevron-right" label="Next" onClick={onClick} disabled />)
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      expect(onClick).not.toHaveBeenCalled()
    })
  })
})

describe('iconButtonRegistryEntry', () => {
  it('strips the envelope and passes icon/label/link through', () => {
    expect(
      iconButtonRegistryEntry.propsFromSchema?.(
        { _meta: {}, icon: 'cart', label: 'Cart', link: '/cart' },
        {},
      ),
    ).toEqual({ icon: 'cart', label: 'Cart', link: '/cart', localeBasePath: '' })
  })

  it('passes visibility through to props', () => {
    expect(
      iconButtonRegistryEntry.propsFromSchema?.(
        { _meta: {}, icon: 'cart', label: 'Cart', link: '/cart', visibility: 'desktopOnly' },
        {},
      ),
    ).toEqual({
      icon: 'cart',
      label: 'Cart',
      link: '/cart',
      visibility: 'desktopOnly',
      localeBasePath: '',
    })
  })

  it('validates: icon and label are both required', () => {
    expect(validateIconButtonSchema({ _meta: {}, icon: 'cart', label: 'Cart' })).toBe(true)
    expect(validateIconButtonSchema({ _meta: {}, icon: 'cart' })).toBe(false)
    expect(validateIconButtonSchema({ _meta: {}, label: 'Cart' })).toBe(false)
    expect(validateIconButtonSchema(null)).toBe(false)
  })
})
