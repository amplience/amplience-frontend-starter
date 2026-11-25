import { describe, expect, it } from 'vitest'

import { collectLinkKeys, hrefFor, isLinkField, resolveLinkFields } from './links'

const page = (id: string) => ({
  type: 'page',
  page: {
    _meta: { schema: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-reference' },
    contentType: 'https://quadratic.amplience.com/v2/content/page',
    id,
  },
})

const links = new Map([
  ['page:p1', '/about'],
  ['product:SKU-1', '/products/chair'],
])

describe('isLinkField', () => {
  it('needs the field its type names', () => {
    expect(isLinkField({ type: 'url', url: '/a' })).toBe(true)
    expect(isLinkField(page('p1'))).toBe(true)
    expect(isLinkField({ type: 'product', product: 'SKU-1' })).toBe(true)
    expect(isLinkField({ type: 'category', category: 'mens' })).toBe(true)
    expect(isLinkField({ type: 'url' })).toBe(true)
    expect(isLinkField({ type: 'other', url: '/a' })).toBe(false)
    expect(isLinkField('/a')).toBe(false)
  })
})

describe('hrefFor', () => {
  it('resolves URLs and categories without a lookup', () => {
    expect(hrefFor({ type: 'url', url: 'https://example.com' })).toBe('https://example.com')
    expect(hrefFor({ type: 'category', category: 'mens/shirts' })).toBe('/mens/shirts')
  })

  it('gives nothing for a type picked with its field left empty', () => {
    expect(hrefFor({ type: 'url' })).toBeUndefined()
    expect(hrefFor({ type: 'url', url: '' })).toBeUndefined()
    expect(hrefFor({ type: 'category' })).toBeUndefined()
    expect(hrefFor({ type: 'page', page: {} }, links)).toBeUndefined()
    expect(hrefFor({ type: 'product' }, links)).toBeUndefined()
  })

  it('reads pages and products from the resolved map', () => {
    expect(hrefFor(page('p1') as never, links)).toBe('/about')
    expect(hrefFor({ type: 'product', product: 'SKU-1' }, links)).toBe('/products/chair')
    expect(hrefFor({ type: 'product', product: 'gone' }, links)).toBeUndefined()
    expect(hrefFor(page('p1') as never)).toBeUndefined()
  })
})

describe('collectLinkKeys', () => {
  it('finds page and product links anywhere in a tree, once each', () => {
    const tree = {
      ctas: [
        { label: 'A', href: page('p1') },
        { label: 'B', href: page('p1') },
      ],
      link: { type: 'product', product: 'SKU-1' },
      other: { type: 'url', url: '/x' },
    }
    expect(collectLinkKeys(tree)).toEqual(['page:p1', 'product:SKU-1'])
    expect(collectLinkKeys({ a: { type: 'page' }, b: { type: 'product' } })).toEqual([])
  })
})

describe('resolveLinkFields', () => {
  it('swaps links for hrefs, nested partials included', () => {
    const node = {
      _meta: { schema: 'x' },
      link: page('p1'),
      links: { cta: { label: 'Go', href: { type: 'category', category: 'sale' } } },
    }
    expect(resolveLinkFields(node, links)).toEqual({
      _meta: { schema: 'x' },
      link: '/about',
      links: { cta: { label: 'Go', href: '/sale' } },
    })
  })

  it('drops a link that did not resolve', () => {
    expect(resolveLinkFields({ label: 'A', link: page('missing') }, links)).toEqual({ label: 'A' })
    expect(resolveLinkFields({ label: 'A', link: { type: 'url' } }, links)).toEqual({ label: 'A' })
  })

  it('leaves nested content items for their own dispatch', () => {
    const child = { _meta: { schema: 'y' }, link: page('p1') }
    const node = { _meta: { schema: 'x' }, children: [child] }
    expect(resolveLinkFields(node, links)).toBe(node)
  })

  it('returns the same object when there is nothing to resolve', () => {
    const node = { label: 'A', link: '/legacy' }
    expect(resolveLinkFields(node, links)).toBe(node)
  })
})
