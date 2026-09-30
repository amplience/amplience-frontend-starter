/**
 * The product listing page (ADR-0018).
 *
 * Everything here goes through the `ProductSource` port — no `ContentClient`,
 * no delivery key, no schema URI. That is the whole point: when a PIM adapter
 * replaces the CMS one, this file does not change.
 *
 * Written in the shape ADR-0022 will require rather than the shape that would
 * need rewriting: a synchronous shell wrapping an async inner component, with
 * `params` awaited inside a `<Suspense>` boundary, and **no route segment
 * config** — `dynamic`, `revalidate`, `fetchCache` and `dynamicParams` all
 * error under `cacheComponents`. These are new files, so paying that now is
 * free; paying it during the caching sweep would not be.
 *
 * The grid itself lives in `src/ProductGrid` because category listings
 * (ADR-0024) render the same thing from the same `Product[]`.
 */

import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { HeroBlock } from '@amplience/frontend-starter-components/hero-block'

import { resolveCurrency } from '../../../../lib/currency'
import { localeForSlug } from '../../../../lib/locales'
import { productSource } from '../../../../lib/product-source'
import { ProductGrid } from '../../../../src/ProductGrid'

type RouteProps = {
  params: Promise<{ locale: string }>
}

export default function ProductsPage({ params }: RouteProps) {
  return (
    <Suspense fallback={null}>
      <ProductListing params={params} />
    </Suspense>
  )
}

async function ProductListing({ params }: RouteProps) {
  const { locale: localeSlug } = await params
  const locale = localeForSlug(localeSlug)
  if (locale === undefined) notFound()

  const { products } = await productSource.list({
    locale: locale.delivery,
    currency: resolveCurrency(locale.code),
  })

  return (
    <main data-product-listing>
      <header data-product-listing-header>
        <HeroBlock
          title="Products"
          description="Everything in the catalogue."
          backgroundColor="black"
          contentPadding={30}
          loadPriority="lcp"
        />
      </header>

      <ProductGrid products={products} locale={locale} />
    </main>
  )
}
