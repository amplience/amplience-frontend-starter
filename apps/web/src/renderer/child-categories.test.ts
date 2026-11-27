import { describe, expect, it } from 'vitest'

import { collectMenuCategories, withChildCategories } from './child-categories'

const MENU_ITEM = 'https://quadratic.amplience.com/v2/content/menu-item'
const HIERARCHY_ITEM = 'https://quadratic.amplience.com/v2/content/hierarchy-menu-item'

const item = (category: string, extra: Record<string, unknown> = {}, schema = MENU_ITEM) => ({
  _meta: { schema, deliveryId: `id-${category}` },
  label: category,
  link: { type: 'category', category },
  ...extra,
})

const children = new Map([
  [
    'women',
    [
      { identifier: 'women-tops', label: 'Tops' },
      { identifier: 'women-skirts', label: 'Skirts' },
    ],
  ],
])

describe('collectMenuCategories', () => {
  it('finds ticked category menu items, or every one with includeUnticked', () => {
    const menu = {
      _meta: { schema: 'https://quadratic.amplience.com/v2/content/menu' },
      items: [
        item('women', { showChildCategories: true }),
        item('men', { children: [item('women')] }),
        { ...item('home'), link: { type: 'url', url: '/home' } },
        {
          _meta: { schema: 'https://quadratic.amplience.com/v2/content/cta' },
          link: item('x').link,
        },
      ],
    }
    expect(collectMenuCategories(menu)).toEqual(['women'])
    expect(collectMenuCategories(menu, { includeUnticked: true })).toEqual(['women', 'men'])
  })
})

describe('withChildCategories', () => {
  it('lists child categories ahead of authored children', () => {
    const own = item('sale')
    const result = withChildCategories(
      item('women', { showChildCategories: true, children: [own] }, HIERARCHY_ITEM),
      children,
    )
    expect((result as { children?: unknown }).children).toEqual([
      {
        _meta: { schema: HIERARCHY_ITEM, deliveryId: 'id-women/women-tops' },
        label: 'Tops',
        link: { type: 'category', category: 'women-tops' },
      },
      {
        _meta: { schema: HIERARCHY_ITEM, deliveryId: 'id-women/women-skirts' },
        label: 'Skirts',
        link: { type: 'category', category: 'women-skirts' },
      },
      own,
    ])
  })

  it('expands items nested anywhere in the tree', () => {
    const tree = { rows: [{ items: [item('women', { showChildCategories: true })] }] }
    const result = withChildCategories(tree, children)
    expect(result.rows[0]?.items[0]).toHaveProperty('children.length', 2)
  })

  it('leaves unticked items, and those with no children, untouched', () => {
    const tree = [item('women'), item('men', { showChildCategories: true })]
    expect(withChildCategories(tree, children)).toBe(tree)
  })
})
