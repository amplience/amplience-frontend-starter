import { describe, expect, it } from 'vitest'

import { hubBrands } from './hub-brands.js'
import type { WebApp } from './types.js'

const site = (brand: string): WebApp => ({ label: '', url: '', brand, name: '' })

const hub = (defaultBrand: string, ...brands: string[]) => ({
  defaultBrand,
  webApps: brands.map(site),
})

describe('hubBrands', () => {
  it('lists localhost first, then each site in card order', () => {
    expect(hubBrands(hub('culinary-supply-hub', 'acme', 'zeta'))).toEqual([
      'culinary-supply-hub',
      'acme',
      'zeta',
    ])
  })

  it('collapses repeats to one entry', () => {
    expect(hubBrands(hub('amplience', 'amplience', 'amplience'))).toEqual(['amplience'])
  })

  it('keeps the first position of a brand that recurs later', () => {
    expect(hubBrands(hub('amplience', 'acme', 'amplience'))).toEqual(['amplience', 'acme'])
  })

  it('drops sites with no brand — they inherit the hub default, already listed', () => {
    expect(hubBrands(hub('amplience', '', 'acme'))).toEqual(['amplience', 'acme'])
  })

  it('drops a blank hub default but keeps the sites', () => {
    expect(hubBrands(hub('', 'acme'))).toEqual(['acme'])
  })

  it('trims, so a padded value is not a separate brand', () => {
    expect(hubBrands(hub('  acme  ', 'acme'))).toEqual(['acme'])
  })

  it('returns the hub default alone when there are no sites (LEGACY hubs)', () => {
    expect(hubBrands(hub('LEGACY'))).toEqual(['LEGACY'])
  })

  it('returns nothing when no brand is set anywhere', () => {
    expect(hubBrands(hub('', '', ''))).toEqual([])
  })
})
