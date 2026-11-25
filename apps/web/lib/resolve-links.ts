/**
 * Resolve the page and product links a content tree holds, for `ctx.links`.
 *
 * Pages are content references, so each is fetched by id for its delivery key;
 * products go through one batched `getBySkus`. A target that doesn't resolve is
 * left out, and the link renders as plain text rather than failing the page.
 */

import { collectLinkKeys } from '../src/renderer/links'
import { client, siteName } from './content-client'
import { resolveCurrency } from './currency'
import type { Locale } from './locales'
import { productSource } from './product-source'
import { pathForDeliveryKey } from './routing'

type PageMeta = {
  readonly deliveryKey?: string
  readonly deliveryKeys?: { readonly values?: readonly { readonly value: string }[] }
}

const EMPTY: ReadonlyMap<string, string> = new Map()

const pagePath = async (id: string): Promise<string | undefined> => {
  const item = await client.getById<{ _meta?: PageMeta }>(id)
  const key = item._meta?.deliveryKeys?.values?.[0]?.value ?? item._meta?.deliveryKey
  return key === undefined ? undefined : pathForDeliveryKey(siteName, key)
}

const productPaths = async (skus: readonly string[], locale: Locale) => {
  const products = await productSource.getBySkus(skus, {
    locale: locale.delivery,
    currency: resolveCurrency(locale.code),
  })
  // A picker may store either the SKU or the source's own id.
  return products.flatMap((product) => {
    const path = `/products/${product.slug}`
    const ids = product.id === undefined ? [product.sku] : [product.sku, product.id]
    return ids.map((id) => [`product:${id}`, path] as const)
  })
}

export async function resolveLinks(
  content: unknown,
  locale: Locale,
): Promise<ReadonlyMap<string, string>> {
  const keys = collectLinkKeys(content)
  if (keys.length === 0) return EMPTY

  const pageIds = keys.filter((k) => k.startsWith('page:')).map((k) => k.slice('page:'.length))
  const skus = keys.filter((k) => k.startsWith('product:')).map((k) => k.slice('product:'.length))

  const [pages, products] = await Promise.allSettled([
    Promise.allSettled(pageIds.map(pagePath)),
    skus.length === 0 ? Promise.resolve([]) : productPaths(skus, locale),
  ])

  const links = new Map<string, string>()
  if (pages.status === 'fulfilled') {
    pages.value.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value !== undefined) {
        links.set(`page:${pageIds[i]}`, result.value)
      }
    })
  }
  if (products.status === 'fulfilled') {
    for (const [key, path] of products.value) links.set(key, path)
  }
  return links
}
