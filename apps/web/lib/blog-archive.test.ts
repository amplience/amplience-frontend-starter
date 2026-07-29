import { afterEach, describe, expect, it, vi } from 'vitest'

import { blogArchiveFromItems, deliveryKeyFromMeta, warnOnDuplicateSlugs } from './blog-archive'

/** Build an item in the delivery `_meta` shape the Filter API returns. */
const item = (key: string, publishDate?: string, deliveryId = 'id-0') => ({
  publishDate,
  _meta: {
    schema: 'https://quadratic.amplience.com/v2/content/blog-article',
    deliveryId,
    deliveryKeys: { values: [{ value: key }] },
  },
})

const slugs = (archive: ReturnType<typeof blogArchiveFromItems>) =>
  archive.entries.map((entry) => entry.slug)

describe('deliveryKeyFromMeta', () => {
  it('reads the first delivery key value', () => {
    expect(deliveryKeyFromMeta(item('site/blog/a')._meta)).toBe('site/blog/a')
  })

  it('is undefined when no key is present', () => {
    expect(deliveryKeyFromMeta({ deliveryKeys: { values: [] } })).toBeUndefined()
    expect(deliveryKeyFromMeta({})).toBeUndefined()
    expect(deliveryKeyFromMeta(undefined)).toBeUndefined()
  })
})

describe('blogArchiveFromItems', () => {
  it('keeps only items under this site’s blog namespace', () => {
    const archive = blogArchiveFromItems(
      [
        item('site/blog/kept'),
        item('other-site/blog/wrong-site'),
        item('site/about'), // right site, not a blog route
        { _meta: { schema: 'x' } }, // no delivery key at all
      ],
      'site',
    )
    expect(slugs(archive)).toEqual(['kept'])
  })

  it('does not match a site whose name merely prefixes another', () => {
    const archive = blogArchiveFromItems([item('site-two/blog/a')], 'site')
    expect(slugs(archive)).toEqual([])
  })

  it('keeps nested slugs intact', () => {
    const archive = blogArchiveFromItems([item('site/blog/2026/june/launch')], 'site')
    expect(slugs(archive)).toEqual(['2026/june/launch'])
  })

  it('sorts newest first, with undated items last', () => {
    const archive = blogArchiveFromItems(
      [
        item('site/blog/old', '2026-01-01'),
        item('site/blog/undated'),
        item('site/blog/new', '2026-06-01'),
      ],
      'site',
    )
    expect(slugs(archive)).toEqual(['new', 'old', 'undated'])
  })

  it('returns one entry per slug and reports the duplicates', () => {
    // What a hub looks like after three wipe/seed cycles that archived without
    // unpublishing: three published items, same slug, same date.
    const archive = blogArchiveFromItems(
      [
        item('site/blog/a', '2026-06-01', 'gen-3'),
        item('site/blog/a', '2026-06-01', 'gen-1'),
        item('site/blog/a', '2026-06-01', 'gen-2'),
        item('site/blog/b', '2026-05-01', 'gen-1'),
      ],
      'site',
    )
    expect(slugs(archive)).toEqual(['a', 'b'])
    expect(archive.duplicateSlugs).toEqual(['a'])
  })

  it('breaks ties on delivery id so repeated renders agree', () => {
    const forward = blogArchiveFromItems(
      [item('site/blog/a', '2026-06-01', 'gen-3'), item('site/blog/a', '2026-06-01', 'gen-1')],
      'site',
    )
    const reversed = blogArchiveFromItems(
      [item('site/blog/a', '2026-06-01', 'gen-1'), item('site/blog/a', '2026-06-01', 'gen-3')],
      'site',
    )
    const idOf = (archive: typeof forward) => archive.entries[0]?.article._meta.deliveryId
    expect(idOf(forward)).toBe('gen-1')
    expect(idOf(reversed)).toBe('gen-1')
  })

  it('reports no duplicates for a healthy hub', () => {
    const archive = blogArchiveFromItems([item('site/blog/a'), item('site/blog/b')], 'site')
    expect(archive.duplicateSlugs).toEqual([])
  })

  it('handles an empty read', () => {
    expect(blogArchiveFromItems([], 'site')).toEqual({ entries: [], duplicateSlugs: [] })
  })
})

describe('warnOnDuplicateSlugs', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('says nothing when there are no duplicates', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    warnOnDuplicateSlugs([])
    expect(warn).not.toHaveBeenCalled()
  })

  it('names the affected slugs and the remedy', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    warnOnDuplicateSlugs(['a', 'b'])
    expect(warn).toHaveBeenCalledTimes(1)
    const message = String(warn.mock.calls[0]?.[0])
    expect(message).toContain('a, b')
    expect(message).toContain('hub:wipe')
  })
})
