import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

// Plain ESM shared with hub-import.mjs; import it directly so the test
// exercises the exact code the seed runs.
import { alreadyMapped, moveProductItems, PRODUCT_SCHEMA, withProductsRepo } from './products.mjs'

describe('withProductsRepo', () => {
  const productType = { contentTypeUri: PRODUCT_SCHEMA, repositories: ['content'] }

  it('adds the products repo alongside content, never instead of it', () => {
    expect(withProductsRepo(productType, 'products').repositories).toEqual(['content', 'products'])
  })

  it('leaves other content types alone', () => {
    const page = {
      contentTypeUri: 'https://quadratic.amplience.com/v2/content/page',
      repositories: ['content'],
    }
    expect(withProductsRepo(page, 'products')).toBe(page)
  })

  it('is a no-op with no products repo, or when already assigned', () => {
    expect(withProductsRepo(productType, undefined)).toBe(productType)
    const assigned = { ...productType, repositories: ['content', 'products'] }
    expect(withProductsRepo(assigned, 'products')).toBe(assigned)
  })
})

describe('moveProductItems', () => {
  const dirs: string[] = []
  const tmp = () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'products-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  const write = (dir: string, rel: string, schema: string, id: string) => {
    const file = path.join(dir, rel)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify({ id, label: id, body: { _meta: { schema } } }))
  }

  it('moves products by schema, wherever they are filed, and leaves pages', () => {
    const pages = tmp()
    const products = tmp()
    write(pages, 'products/chair.json', PRODUCT_SCHEMA, 'p1')
    write(pages, 'products/lighting/lamp.json', PRODUCT_SCHEMA, 'p2')
    write(pages, 'misfiled.json', PRODUCT_SCHEMA, 'p3')
    write(pages, 'home.json', 'https://quadratic.amplience.com/v2/content/page', 'page')

    expect(moveProductItems(pages, products).sort()).toEqual(['p1', 'p2', 'p3'])
    expect(readdirSync(pages, { recursive: true })).toEqual(['home.json'])
    // The leading products/ is dropped; deeper folders are kept.
    expect(existsSync(path.join(products, 'chair.json'))).toBe(true)
    expect(existsSync(path.join(products, 'lighting', 'lamp.json'))).toBe(true)
    expect(existsSync(path.join(products, 'misfiled.json'))).toBe(true)
  })

  it('moves nothing from a set with no products', () => {
    const pages = tmp()
    write(pages, 'home.json', 'https://quadratic.amplience.com/v2/content/page', 'page')
    expect(moveProductItems(pages, tmp())).toEqual([])
  })
})

describe('alreadyMapped', () => {
  it('names the ids the import map already holds', () => {
    expect(
      alreadyMapped(['a', 'b', 'c'], {
        contentItems: [
          ['b', 'x'],
          ['z', 'y'],
        ],
      }),
    ).toEqual(['b'])
  })

  it('treats a missing map as nothing mapped', () => {
    expect(alreadyMapped(['a'], undefined)).toEqual([])
  })
})
