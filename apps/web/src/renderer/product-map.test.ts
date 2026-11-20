import { describe, expect, it } from 'vitest'

import type { ResolvedProduct } from '@amplience/frontend-starter-types'

import { productMap, uniqueProducts } from './product-map'

const cms: ResolvedProduct = {
  sku: 'AUR-CHAIR-01',
  slug: 'chair',
  name: 'Chair',
  href: '/products/chair',
}
const ct: ResolvedProduct = {
  sku: 'AF-LAMP-003',
  id: 'prod-lamp',
  slug: 'lamp',
  name: 'Lamp',
  href: '/products/lamp',
}

describe('productMap', () => {
  it('keys a product by its SKU, and by its id when it has one', () => {
    const map = productMap([cms, ct])
    expect(map.get('AUR-CHAIR-01')).toBe(cms)
    expect(map.get('AF-LAMP-003')).toBe(ct)
    // The eComm Toolkit picker stores ids, so a rail may hold this instead.
    expect(map.get('prod-lamp')).toBe(ct)
  })
})

describe('uniqueProducts', () => {
  it('lists each product once, however many keys it has', () => {
    expect(uniqueProducts(productMap([cms, ct]))).toEqual([cms, ct])
  })
})
