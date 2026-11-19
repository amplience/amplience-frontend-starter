// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { HubIcon } from './HubIcon.js'

afterEach(cleanup)

describe('HubIcon', () => {
  it('renders nothing without an icon', () => {
    const { container } = render(<HubIcon icon={undefined} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders an emoji as text', () => {
    const { container } = render(<HubIcon icon="🛍️" />)
    expect(container.textContent).toBe('🛍️')
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders an http(s) URL as an image that sends no referrer', () => {
    const { container } = render(<HubIcon icon="https://example.com/logo.png" />)
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('https://example.com/logo.png')
    expect(img?.getAttribute('referrerpolicy')).toBe('no-referrer')
  })

  it('hides itself when the image fails to load', () => {
    const { container } = render(<HubIcon icon="https://example.com/missing.png" />)
    const img = container.querySelector('img')
    if (img === null) throw new Error('expected an image')
    fireEvent.error(img)
    expect(container.innerHTML).toBe('')
  })
})
