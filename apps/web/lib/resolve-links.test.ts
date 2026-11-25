import { describe, expect, it, vi } from 'vitest'

const { getByIdMock, getBySkusMock } = vi.hoisted(() => ({
  getByIdMock: vi.fn(),
  getBySkusMock: vi.fn(),
}))

vi.mock('./content-client', () => ({ client: { getById: getByIdMock }, siteName: 'acme' }))
vi.mock('./product-source', () => ({ productSource: { getBySkus: getBySkusMock } }))

const { resolveLinks } = await import('./resolve-links')
const { defaultLocale } = await import('./locales')

const pageLink = (id: string) => ({ type: 'page', page: { id } })
const keyed = (key: string) => ({ _meta: { deliveryKeys: { values: [{ value: key }] } } })

describe('resolveLinks', () => {
  it('maps pages by delivery key and products by SKU or id', async () => {
    getByIdMock.mockImplementation((id: string) =>
      id === 'home'
        ? Promise.resolve(keyed('acme/homepage'))
        : Promise.resolve(keyed('acme/blog/a')),
    )
    getBySkusMock.mockResolvedValue([{ sku: 'SKU-1', id: 'ct-1', slug: 'chair' }])
    const links = await resolveLinks(
      [
        { link: pageLink('home') },
        { link: pageLink('post') },
        { link: { type: 'product', product: 'ct-1' } },
        { link: { type: 'url', url: '/x' } },
      ],
      defaultLocale,
    )
    expect(Object.fromEntries(links)).toEqual({
      'page:home': '/',
      'page:post': '/blog/a',
      'product:SKU-1': '/products/chair',
      'product:ct-1': '/products/chair',
    })
  })

  it('leaves out targets that fail or sit outside the site', async () => {
    getByIdMock.mockImplementation((id: string) =>
      id === 'other'
        ? Promise.resolve(keyed('elsewhere/about'))
        : Promise.reject(new Error('gone')),
    )
    getBySkusMock.mockRejectedValue(new Error('down'))
    const links = await resolveLinks(
      [
        { a: pageLink('other') },
        { b: pageLink('missing') },
        { c: { type: 'product', product: 'X' } },
      ],
      defaultLocale,
    )
    expect(links.size).toBe(0)
  })

  it('fetches nothing when the tree has no page or product links', async () => {
    getByIdMock.mockClear()
    getBySkusMock.mockClear()
    expect(
      (await resolveLinks({ link: { type: 'category', category: 'c' } }, defaultLocale)).size,
    ).toBe(0)
    expect(getByIdMock).not.toHaveBeenCalled()
    expect(getBySkusMock).not.toHaveBeenCalled()
  })
})
