import { describe, expect, it, vi } from 'vitest'

type Source = { childCategories?: (id: string) => Promise<unknown> }
const source = vi.hoisted((): { productSource: Source } => ({ productSource: {} }))

vi.mock('./product-source', () => source)

const { addChildCategories, resolveChildCategories } = await import('./child-categories')
const { defaultLocale } = await import('./locales')

const item = (category: string) => ({
  _meta: { schema: 'https://quadratic.amplience.com/v2/content/menu-item' },
  label: category,
  link: { type: 'category', category },
  showChildCategories: true,
})

describe('resolveChildCategories', () => {
  it('is empty when the source has no category tree', async () => {
    source.productSource = {}
    expect((await resolveChildCategories([item('women')], defaultLocale)).size).toBe(0)
  })

  it('resolves each category, leaving out any that fail', async () => {
    source.productSource = {
      childCategories: (id) =>
        id === 'women'
          ? Promise.resolve([{ identifier: 'women-tops', label: 'Tops' }])
          : Promise.reject(new Error('down')),
    }
    const resolved = await resolveChildCategories([item('women'), item('men')], defaultLocale)
    expect(Object.fromEntries(resolved)).toEqual({
      women: [{ identifier: 'women-tops', label: 'Tops' }],
    })
  })
})

describe('addChildCategories', () => {
  it('adds the resolved children to ticked items', async () => {
    source.productSource = {
      childCategories: () => Promise.resolve([{ identifier: 'women-tops', label: 'Tops' }]),
    }
    const [women] = await addChildCategories([item('women')], defaultLocale)
    expect(women).toHaveProperty('children.0.label', 'Tops')
  })
})
