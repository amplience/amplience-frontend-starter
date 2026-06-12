// Tests for the content package's structural guards and helpers (QL-40).
//
// The guards are structural on purpose: `instanceof` breaks when more than
// one copy of the module exists in a process, and regex-based sniffing is
// off the table (Sprint 5 ReDoS-safety posture). These tests pin both the
// accepting and rejecting paths of each guard.

import { describe, expect, it } from 'vitest'

import {
  CONTENT_LINK_SCHEMA,
  ContentClientError,
  IMAGE_LINK_SCHEMA,
  isContentClientError,
  isContentLink,
  isMediaImageLink,
  mediaImageUrl,
  type MediaImageLink,
} from './types'

const contentLink = {
  id: 'abc-123',
  contentType: 'https://quadratic.amplience.com/v2/content/hero',
  _meta: { schema: CONTENT_LINK_SCHEMA },
}

const imageLink: MediaImageLink = {
  _meta: { schema: IMAGE_LINK_SCHEMA },
  id: 'img-1',
  name: 'hero banner.png',
  endpoint: 'quadratic',
  defaultHost: 'cdn.media.amplience.net',
}

describe('ContentClientError', () => {
  it('carries its kind and message', () => {
    const err = new ContentClientError('not-found', 'no such key')
    expect(err.kind).toBe('not-found')
    expect(err.message).toBe('no such key')
    expect(err.name).toBe('ContentClientError')
  })

  it('attaches a cause when one is given', () => {
    const cause = new Error('socket hang up')
    const err = new ContentClientError('network', 'fetch failed', cause)
    expect(err.cause).toBe(cause)
  })

  it('leaves cause unset when none is given', () => {
    const err = new ContentClientError('network', 'fetch failed')
    expect(err.cause).toBeUndefined()
  })
})

describe('isContentClientError', () => {
  it('accepts a real instance', () => {
    expect(isContentClientError(new ContentClientError('unknown', 'x'))).toBe(true)
  })

  it('accepts a structural match from another module copy', () => {
    expect(isContentClientError({ name: 'ContentClientError', kind: 'network' })).toBe(true)
  })

  it.each([null, undefined, 'ContentClientError', 42])('rejects non-object value %o', (value) => {
    expect(isContentClientError(value)).toBe(false)
  })

  it('rejects an object with the wrong name', () => {
    expect(isContentClientError({ name: 'Error', kind: 'network' })).toBe(false)
  })

  it('rejects an object whose kind is not a string', () => {
    expect(isContentClientError({ name: 'ContentClientError', kind: 7 })).toBe(false)
  })
})

describe('isContentLink', () => {
  it('accepts a content-link reference stub', () => {
    expect(isContentLink(contentLink)).toBe(true)
  })

  it.each([null, undefined, 'abc-123', 42])('rejects non-object value %o', (value) => {
    expect(isContentLink(value)).toBe(false)
  })

  it('rejects a stub whose id is not a string', () => {
    expect(isContentLink({ ...contentLink, id: 99 })).toBe(false)
  })

  it('rejects a stub whose contentType is not a string', () => {
    expect(isContentLink({ ...contentLink, contentType: undefined })).toBe(false)
  })

  it('rejects a stub with no _meta envelope', () => {
    const { _meta: _envelope, ...withoutMeta } = contentLink
    expect(isContentLink(withoutMeta)).toBe(false)
  })

  it('rejects a stub carrying a different schema', () => {
    expect(isContentLink({ ...contentLink, _meta: { schema: 'https://other' } })).toBe(false)
  })
})

describe('isMediaImageLink', () => {
  it('accepts an image media-link', () => {
    expect(isMediaImageLink(imageLink)).toBe(true)
  })

  it.each([null, undefined, 'img', 42])('rejects non-object value %o', (value) => {
    expect(isMediaImageLink(value)).toBe(false)
  })

  it('rejects a link whose name is not a string', () => {
    expect(isMediaImageLink({ ...imageLink, name: 7 })).toBe(false)
  })

  it('rejects a link whose endpoint is not a string', () => {
    expect(isMediaImageLink({ ...imageLink, endpoint: undefined })).toBe(false)
  })

  it('rejects a link whose defaultHost is not a string', () => {
    expect(isMediaImageLink({ ...imageLink, defaultHost: null })).toBe(false)
  })

  it('rejects a link with no _meta envelope', () => {
    const { _meta: _envelope, ...withoutMeta } = imageLink
    expect(isMediaImageLink(withoutMeta)).toBe(false)
  })

  it('rejects a link carrying a different schema', () => {
    expect(isMediaImageLink({ ...imageLink, _meta: { schema: CONTENT_LINK_SCHEMA } })).toBe(false)
  })
})

describe('mediaImageUrl', () => {
  it('builds the Dynamic Media URL with the asset name encoded', () => {
    expect(mediaImageUrl(imageLink)).toBe(
      'https://cdn.media.amplience.net/i/quadratic/hero%20banner.png',
    )
  })
})
