import { describe, expect, it } from 'vitest'

// The predicates are plain ESM (.mjs) shared with the wipe script; import them
// directly so the test exercises the exact code the wipe runs.
import { canUnpublish, isEnvironmentalFailure, mayBePublished } from './publishing.mjs'

describe('mayBePublished', () => {
  it('is false for states that mean nothing is live in Delivery', () => {
    expect(mayBePublished({ publishingStatus: 'NONE' })).toBe(false)
    expect(mayBePublished({ publishingStatus: 'UNPUBLISHED' })).toBe(false)
  })

  it('is true for states that mean a snapshot is live', () => {
    expect(mayBePublished({ publishingStatus: 'LATEST' })).toBe(true)
    expect(mayBePublished({ publishingStatus: 'EARLY' })).toBe(true)
  })

  // The pessimistic branch is the point: an unknown state must not be read as
  // "safe to leave alone", because that is how content stays live after a wipe.
  it('assumes published when the API omits the state', () => {
    expect(mayBePublished({})).toBe(true)
    expect(mayBePublished({ publishingStatus: null })).toBe(true)
    expect(mayBePublished(undefined)).toBe(true)
  })
})

describe('canUnpublish', () => {
  it('reads the action off a plain _links object', () => {
    expect(canUnpublish({ _links: { unpublish: { href: '/x' } } })).toBe(true)
    expect(canUnpublish({ _links: { publish: { href: '/x' } } })).toBe(false)
  })

  it('reads the action off a Map, as the SDK types claim', () => {
    expect(canUnpublish({ _links: new Map([['unpublish', { href: '/x' }]]) })).toBe(true)
    expect(canUnpublish({ _links: new Map([['publish', { href: '/x' }]]) })).toBe(false)
  })

  it('is false when there are no links at all', () => {
    expect(canUnpublish({})).toBe(false)
    expect(canUnpublish({ _links: null })).toBe(false)
    expect(canUnpublish(undefined)).toBe(false)
  })
})

describe('isEnvironmentalFailure', () => {
  it('treats auth and permission statuses as environmental', () => {
    expect(isEnvironmentalFailure({ response: { status: 401 } })).toBe(true)
    expect(isEnvironmentalFailure({ status: 403 })).toBe(true)
  })

  it('treats the SDK’s missing-action rejection as environmental', () => {
    // The SDK rejects with a bare string, not an Error.
    expect(
      isEnvironmentalFailure(
        'The unpublish action is not available, ensure you have permission to perform this action.',
      ),
    ).toBe(true)
    expect(isEnvironmentalFailure(new Error('unpublish is not enabled on this hub'))).toBe(true)
  })

  it('treats per-item and transient failures as non-environmental', () => {
    expect(isEnvironmentalFailure({ response: { status: 429 } })).toBe(false)
    expect(isEnvironmentalFailure({ response: { status: 500 } })).toBe(false)
    expect(isEnvironmentalFailure(new Error('content item is assigned to an edition'))).toBe(false)
    expect(isEnvironmentalFailure(undefined)).toBe(false)
  })
})
