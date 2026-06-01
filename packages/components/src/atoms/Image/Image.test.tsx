// @vitest-environment jsdom
//
// Smoke tests for the Image atom (QL-26).
// next/image is mocked to a plain <img> so the test environment
// does not need a Next.js server or image optimisation pipeline.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Image } from './Image'

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    width,
    height,
    className,
    style,
    'data-has-ratio': dataHasRatio,
    ...props
  }: React.ComponentPropsWithoutRef<'img'> & { 'data-has-ratio'?: string }) => (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      data-has-ratio={dataHasRatio}
      {...props}
    />
  ),
}))

afterEach(cleanup)

describe('Image', () => {
  it('renders an <img> element', () => {
    render(<Image src="/hero.jpg" alt="Hero image" width={800} height={400} />)
    expect(screen.getByRole('img', { name: 'Hero image' }).tagName).toBe('IMG')
  })

  it('forwards src and alt', () => {
    render(<Image src="/hero.jpg" alt="Hero image" width={800} height={400} />)
    const img = screen.getByRole('img', { name: 'Hero image' })
    expect(img.getAttribute('src')).toBe('/hero.jpg')
    expect(img.getAttribute('alt')).toBe('Hero image')
  })

  it('forwards width and height', () => {
    render(<Image src="/photo.jpg" alt="Photo" width={640} height={480} />)
    const img = screen.getByRole('img', { name: 'Photo' })
    expect(img.getAttribute('width')).toBe('640')
    expect(img.getAttribute('height')).toBe('480')
  })

  it('does not set data-has-ratio when aspectRatio is omitted', () => {
    render(<Image src="/photo.jpg" alt="Photo" width={640} height={480} />)
    const img = screen.getByRole('img', { name: 'Photo' })
    expect(img.getAttribute('data-has-ratio')).toBeNull()
  })

  it('sets --image-aspect-ratio CSS variable when aspectRatio is supplied', () => {
    render(<Image src="/photo.jpg" alt="Photo" width={640} height={480} aspectRatio="16 / 9" />)
    const img = screen.getByRole('img', { name: 'Photo' })
    expect(img.getAttribute('data-has-ratio')).toBe('true')
    expect(img.style.getPropertyValue('--image-aspect-ratio')).toBe('16 / 9')
  })

  it('forwards additional className', () => {
    render(<Image src="/photo.jpg" alt="Photo" width={640} height={480} className="custom" />)
    expect(screen.getByRole('img', { name: 'Photo' }).className).toContain('custom')
  })
})
