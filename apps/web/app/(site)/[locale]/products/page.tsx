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
 * Image loading is wired by hand here, unlike a renderer-dispatched page.
 * The demotion ladder (ADR-0021) only runs inside the renderer, and this
 * route composes components directly — so the hero takes `'lcp'`, the first
 * row of cards takes `'eager'`, and everything below is `'lazy'`. The blog
 * archive omits all of this and consequently lazy-loads every card at a
 * 100vw srcset; it is a defect to avoid copying, not a precedent.
 */

import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { Container } from '@amplience/frontend-starter-components/container'
import { GridBlock } from '@amplience/frontend-starter-components/grid-block'
import { HeroBlock } from '@amplience/frontend-starter-components/hero-block'
import { gridBlockSlotSizes } from '@amplience/frontend-starter-components/image-sizes'
import { ProductCard } from '@amplience/frontend-starter-components/product-card'

import { resolveCurrency } from '../../../../lib/currency'
import { localeBasePath, localeForSlug, publicPath } from '../../../../lib/locales'
import { productMedia } from '../../../../lib/product-media'
import { productSource } from '../../../../lib/product-source'

type RouteProps = {
  params: Promise<{ locale: string }>
}

/** Grid geometry — one source of truth for the CSS columns and the `sizes` hint. */
const COLUMNS = { columnsMobile: 1, columnsTablet: 2, columnsDesktop: 3 } as const

/**
 * `sizes` for one card. `fixed` mode mirrors the column counts above at the
 * same breakpoints the grid uses; `minItemWidth` is unused in that mode but
 * the input type requires it.
 */
const CARD_SIZES = gridBlockSlotSizes({ sizingMode: 'fixed', ...COLUMNS, minItemWidth: 0 })

/** Cards above this index are below the fold on every breakpoint. */
const EAGER_CARDS = COLUMNS.columnsDesktop

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

      {products.length === 0 ? (
        <Container gutter>
          <p data-product-listing-empty>No products published yet.</p>
        </Container>
      ) : (
        <GridBlock gutter {...COLUMNS} data-product-listing-list backgroundColor="light">
          {products.map((product, index) => {
            const media = productMedia(product.images?.[0])
            return (
              <ProductCard
                key={product.slug}
                name={product.name}
                href={publicPath(locale, `/products/${product.slug}`)}
                sizes={CARD_SIZES}
                loadPriority={index < EAGER_CARDS ? 'eager' : 'lazy'}
                locale={locale.code}
                localeBasePath={localeBasePath(locale)}
                {...(product.price !== undefined && { price: product.price })}
                {...(product.brand !== undefined && { brand: product.brand })}
                {...(media !== undefined && { media })}
                {...(product.shortDescription !== undefined && {
                  shortDescription: product.shortDescription,
                })}
                {...(product.status !== undefined && { status: product.status })}
              />
            )
          })}
        </GridBlock>
      )}
    </main>
  )
}
