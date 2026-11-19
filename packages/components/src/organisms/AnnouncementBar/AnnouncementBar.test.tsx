// @vitest-environment jsdom
//
// Tests for the AnnouncementBar organism and its dismiss behaviour.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AnnouncementBar } from './AnnouncementBar'
import { announcementBarRegistryEntry } from './AnnouncementBar.registry'
import { DISMISS_STORAGE_PREFIX, fingerprint } from './AnnouncementBarDismiss'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe('AnnouncementBar', () => {
  describe('structure', () => {
    it('renders a labelled region with the stable theming hook', () => {
      const { container } = render(<AnnouncementBar message="Free delivery" />)
      const root = container.querySelector('section')
      expect(root?.classList.contains('AnnouncementBar')).toBe(true)
      expect(screen.getByRole('region', { name: 'Announcement' })).toBeTruthy()
    })

    it('renders the markdown message, inline formatting included', () => {
      const { container } = render(<AnnouncementBar message="**Extra 20%** off" />)
      expect(container.querySelector('strong')?.textContent).toBe('Extra 20%')
    })

    it('defaults to a black, centred bar', () => {
      const { container } = render(<AnnouncementBar message="Hi" />)
      const root = container.querySelector('section')
      expect(root?.getAttribute('data-background-color')).toBe('black')
      expect(root?.getAttribute('data-text-align')).toBe('center')
      expect(root?.hasAttribute('data-text-color')).toBe(false)
    })

    it('reflects colour and alignment choices as data attributes', () => {
      const { container } = render(
        <AnnouncementBar
          message="Hi"
          backgroundColor="tertiary"
          textColor="white"
          textAlign="left"
        />,
      )
      const root = container.querySelector('section')
      expect(root?.getAttribute('data-background-color')).toBe('tertiary')
      expect(root?.getAttribute('data-text-color')).toBe('white')
      expect(root?.getAttribute('data-text-align')).toBe('left')
    })
  })

  describe('link', () => {
    it('has no bar link without an href', () => {
      const { container } = render(<AnnouncementBar message="Plain" />)
      expect(container.querySelector('section')?.hasAttribute('data-linked')).toBe(false)
      expect(screen.queryByRole('link')).toBeNull()
    })

    it('shows the link text when given', () => {
      render(<AnnouncementBar message="Sale" href="/sale" linkLabel="Shop now" />)
      const link = screen.getByRole('link', { name: 'Shop now' })
      expect(link.getAttribute('href')).toBe('/sale')
    })

    it('names an unlabelled bar link by the message', () => {
      render(<AnnouncementBar message="Extra 20% off" href="/sale" />)
      expect(screen.getByRole('link', { name: 'Extra 20% off' }).getAttribute('href')).toBe('/sale')
    })

    it('keeps inline message links alongside the bar link', () => {
      render(<AnnouncementBar message="See [terms](/terms)" href="/sale" linkLabel="Shop" />)
      expect(screen.getByRole('link', { name: 'terms' }).getAttribute('href')).toBe('/terms')
      expect(screen.getByRole('link', { name: 'Shop' })).toBeTruthy()
    })
  })

  describe('dismiss', () => {
    it('has no close button unless dismissible', () => {
      render(<AnnouncementBar message="Hi" />)
      expect(screen.queryByRole('button')).toBeNull()
    })

    it('hides the bar and remembers it, keyed by id with the message fingerprint', () => {
      render(<AnnouncementBar message="Hi" dismissible id="abc" />)
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss announcement' }))
      expect(screen.queryByRole('region')).toBeNull()
      expect(window.localStorage.getItem(`${DISMISS_STORAGE_PREFIX}abc`)).toBe(fingerprint('Hi'))
    })

    it('stays hidden on a later visit with the same message', () => {
      window.localStorage.setItem(`${DISMISS_STORAGE_PREFIX}abc`, fingerprint('Hi'))
      render(<AnnouncementBar message="Hi" dismissible id="abc" />)
      expect(screen.queryByRole('region')).toBeNull()
    })

    it('shows again once the message changes', () => {
      window.localStorage.setItem(`${DISMISS_STORAGE_PREFIX}abc`, fingerprint('Old news'))
      render(<AnnouncementBar message="New news" dismissible id="abc" />)
      expect(screen.getByRole('region')).toBeTruthy()
    })

    it('ignores a stored dismissal when the bar is not dismissible', () => {
      window.localStorage.setItem(`${DISMISS_STORAGE_PREFIX}abc`, fingerprint('Hi'))
      render(<AnnouncementBar message="Hi" id="abc" />)
      expect(screen.getByRole('region')).toBeTruthy()
    })

    it('still dismisses when storage throws', () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked')
      })
      render(<AnnouncementBar message="Hi" dismissible id="abc" />)
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss announcement' }))
      expect(screen.queryByRole('region')).toBeNull()
      setItem.mockRestore()
    })
  })
})

describe('announcementBarRegistryEntry', () => {
  const adapt = announcementBarRegistryEntry.propsFromSchema!

  it('keys the bar by the delivery id and drops the envelope', () => {
    const props = adapt(
      { _meta: { deliveryId: 'item-1' }, message: 'Hi', dismissible: true },
      { localeBasePath: '/fr-fr' },
    )
    expect(props).toEqual({
      message: 'Hi',
      dismissible: true,
      id: 'item-1',
      localeBasePath: '/fr-fr',
    })
  })

  it('omits the id when the envelope has none', () => {
    const props = adapt({ _meta: {}, message: 'Hi' }, {})
    expect('id' in props).toBe(false)
  })
})
