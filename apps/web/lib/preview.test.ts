import { describe, expect, it } from 'vitest'

import { isVseHost, pinnedAt, previewBasePath, splitPreviewPath } from './preview'

const BASE = 'g8tgyy0etx3f1hv243pqc24ci.staging.bigcontent.io'
const PINNED = 'g8tgyy0etx3f1hv243pqc24ci-gvzrfgnzc-1794568891000.staging.bigcontent.io'

describe('isVseHost', () => {
  it.each([BASE, PINNED])('accepts %s', (host) => {
    expect(isVseHost(host)).toBe(true)
  })

  it.each([
    '',
    '.staging.bigcontent.io',
    'example.com',
    `${BASE}/evil`,
    `user@${BASE}`,
    `${BASE}:443`,
    `${BASE}?x=1`,
    `a ${BASE}`,
  ])('rejects %s', (host) => {
    expect(isVseHost(host)).toBe(false)
  })
})

describe('pinnedAt', () => {
  it('reads the timestamp off a pinned host', () => {
    expect(pinnedAt(PINNED)).toBe(1794568891000)
  })

  it.each([
    BASE,
    'abc-gvzrfgnzc-.staging.bigcontent.io',
    'abc-gvzrfgnzc-12x4.staging.bigcontent.io',
    'abc-other-1794568891000.staging.bigcontent.io',
    '-gvzrfgnzc-1794568891000.staging.bigcontent.io',
    'abc-gvzrfgnzc-1794568891000-extra.staging.bigcontent.io',
  ])('is undefined for %s', (host) => {
    expect(pinnedAt(host)).toBeUndefined()
  })
})

describe('splitPreviewPath', () => {
  it('splits host and site path', () => {
    expect(splitPreviewPath(`/preview/${PINNED}/fr-fr/about`)).toEqual({
      host: PINNED,
      path: '/fr-fr/about',
    })
  })

  it.each([`/preview/${PINNED}`, `/preview/${PINNED}/`])('maps %s to the root', (pathname) => {
    expect(splitPreviewPath(pathname)?.path).toBe('/')
  })

  it.each(['/about', '/preview', '/preview/not-a-vse/about', `/x/preview/${PINNED}`])(
    'is undefined for %s',
    (pathname) => {
      expect(splitPreviewPath(pathname)).toBeUndefined()
    },
  )

  it('round-trips with previewBasePath', () => {
    expect(splitPreviewPath(`${previewBasePath(PINNED)}/blog`)).toEqual({
      host: PINNED,
      path: '/blog',
    })
  })
})
