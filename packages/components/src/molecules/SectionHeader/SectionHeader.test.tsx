// @vitest-environment jsdom
//
// Smoke tests for the SectionHeader molecule.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SectionHeader } from './SectionHeader'

afterEach(cleanup)

describe('SectionHeader', () => {
  it('renders the title as an h2', () => {
    render(<SectionHeader title="Featured products" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Featured products' })).toBeTruthy()
  })

  it('renders the subtitle as an h3 when provided', () => {
    render(<SectionHeader title="Featured products" subtitle="Hand-picked for the season" />)
    expect(
      screen.getByRole('heading', { level: 3, name: 'Hand-picked for the season' }),
    ).toBeTruthy()
  })

  it('does not render a subtitle when omitted', () => {
    render(<SectionHeader title="Featured products" />)
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
  })

  it('renders the description when provided', () => {
    render(<SectionHeader title="Featured products" description="Body copy for the section." />)
    expect(screen.getByText('Body copy for the section.')).toBeTruthy()
  })

  it('does not render a description when omitted', () => {
    render(<SectionHeader title="Featured products" />)
    expect(screen.queryByText('Body copy for the section.')).toBeNull()
  })

  it('renders when only a subtitle or description is provided (no title)', () => {
    const { container } = render(
      <SectionHeader title={undefined} description="Standalone body copy." />,
    )
    expect(container.firstChild).not.toBeNull()
    expect(screen.getByText('Standalone body copy.')).toBeTruthy()
  })

  it('renders nothing when title, subtitle and description are all absent', () => {
    const { container } = render(<SectionHeader title={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when all fields are empty strings', () => {
    const { container } = render(<SectionHeader title="" subtitle="" description="" />)
    expect(container.firstChild).toBeNull()
  })

  it('forwards className to the header element', () => {
    const { container } = render(<SectionHeader title="Title" className="custom" />)
    expect(container.querySelector('header.custom')).toBeTruthy()
  })
})
