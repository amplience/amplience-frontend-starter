// @vitest-environment jsdom
//
// PreviewBanner (ADR-0028): the pinned date, the exit link back to the live
// path, and re-pinning through the Virtual Staging API.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PreviewBanner } from './PreviewBanner'

const HOST = 'abc-gvzrfgnzc-1794568891000.staging.bigcontent.io'
const NEXT_HOST = 'abc-gvzrfgnzc-1800000000000.staging.bigcontent.io'

const { nav } = vi.hoisted(() => ({ nav: { path: '/' } }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.path }))

const assign = vi.fn()
const fetchMock = vi.fn()

beforeEach(() => {
  nav.path = `/preview/${HOST}/fr-fr/about`
  assign.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  Object.defineProperty(window, 'location', { configurable: true, value: { assign } })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const submit = (value: string) => {
  fireEvent.change(screen.getByLabelText('Preview date and time'), { target: { value } })
  fireEvent.submit(screen.getByRole('button', { name: 'Go' }).closest('form')!)
}

describe('PreviewBanner', () => {
  it('shows the pinned date', () => {
    render(<PreviewBanner host={HOST} />)
    const label = screen.getByText(/Showing the site as of/)
    expect(label.getAttribute('data-preview-pinned')).toBe('1794568891000')
  })

  it('says staged content when the host carries no date', () => {
    render(<PreviewBanner host="abc.staging.bigcontent.io" />)
    expect(screen.getByText('Showing staged content')).toBeDefined()
  })

  it('exits to the same page on the live site', () => {
    render(<PreviewBanner host={HOST} />)
    expect(screen.getByRole('link', { name: 'Exit preview' }).getAttribute('href')).toBe(
      '/fr-fr/about',
    )
  })

  it('exits to the live root from the preview root', () => {
    nav.path = `/preview/${HOST}`
    render(<PreviewBanner host={HOST} />)
    expect(screen.getByRole('link', { name: 'Exit preview' }).getAttribute('href')).toBe('/')
  })

  it('re-pins the host and reloads the same page under it', async () => {
    fetchMock.mockResolvedValue(new Response(`${NEXT_HOST}\n`, { status: 200 }))
    render(<PreviewBanner host={HOST} />)
    submit('2027-01-15T09:30')

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith(`/preview/${NEXT_HOST}/fr-fr/about`)
    })
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.origin + url.pathname).toBe(`https://virtual-staging.amplience.net/domain/${HOST}`)
    expect(url.searchParams.get('timestamp')).toBe(String(new Date('2027-01-15T09:30').getTime()))
  })

  it('re-pins from the preview root without a trailing slash', async () => {
    nav.path = `/preview/${HOST}`
    fetchMock.mockResolvedValue(new Response(NEXT_HOST, { status: 200 }))
    render(<PreviewBanner host={HOST} />)
    submit('2027-01-15T09:30')
    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith(`/preview/${NEXT_HOST}`)
    })
  })

  it.each([
    ['a non-host answer', () => new Response('<html>nope</html>', { status: 200 })],
    ['an error status', () => new Response(NEXT_HOST, { status: 500 })],
  ])('reports %s and stays put', async (_name, response) => {
    fetchMock.mockResolvedValue(response())
    render(<PreviewBanner host={HOST} />)
    submit('2027-01-15T09:30')
    expect(await screen.findByRole('alert')).toBeDefined()
    expect(assign).not.toHaveBeenCalled()
  })

  it('reports a network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'))
    render(<PreviewBanner host={HOST} />)
    submit('2027-01-15T09:30')
    expect(await screen.findByRole('alert')).toBeDefined()
  })

  it('rejects an empty date without calling the API', async () => {
    render(<PreviewBanner host={HOST} />)
    submit('')
    expect(await screen.findByRole('alert')).toBeDefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
