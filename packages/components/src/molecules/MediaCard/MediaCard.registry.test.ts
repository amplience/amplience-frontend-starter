// Tests for the media-card registry entry — the three cues the adapter injects
// from the render context (locale, slot geometry, load priority) and the
// author fields it passes straight through.

import { describe, expect, it } from 'vitest'

import { mediaCardRegistryEntry, type MediaCardSchema } from './MediaCard.registry'

const validCard: MediaCardSchema = {
  _meta: {},
  title: 'A card',
  description: 'Card body copy',
}

describe('mediaCardRegistryEntry — propsFromSchema', () => {
  const adapt = mediaCardRegistryEntry.propsFromSchema

  it('strips the _meta envelope and passes the remaining fields through', () => {
    expect(adapt?.(validCard, {})).toMatchObject({
      title: 'A card',
      description: 'Card body copy',
    })
    expect(adapt?.(validCard, {})).not.toHaveProperty('_meta')
  })

  it('sets localeBasePath from the render context, defaulting to the unprefixed locale', () => {
    expect(adapt?.(validCard, {})?.localeBasePath).toBe('')
    expect(adapt?.(validCard, { localeBasePath: '/fr-fr' })?.localeBasePath).toBe('/fr-fr')
  })

  it('forwards the parent slot width as sizes when present', () => {
    expect(adapt?.(validCard, { slotSizes: '(min-width: 992px) 33.34vw, 100vw' })?.sizes).toBe(
      '(min-width: 992px) 33.34vw, 100vw',
    )
  })

  it('leaves sizes unset when the context supplies no slot width', () => {
    expect(adapt?.(validCard, {})).not.toHaveProperty('sizes')
  })

  // ADR-0021. Cards are usually below the fold, but a card grid can lead a
  // page — and before this cue reached MediaCard it had no way to say so.
  it('sets loadPriority from the render context, defaulting to lazy', () => {
    expect(adapt?.(validCard, {})?.loadPriority).toBe('lazy')
    expect(adapt?.(validCard, { loadPriority: 'eager' })?.loadPriority).toBe('eager')
    expect(adapt?.(validCard, { loadPriority: 'lcp' })?.loadPriority).toBe('lcp')
  })
})
