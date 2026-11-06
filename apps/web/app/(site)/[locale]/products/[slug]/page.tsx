/**
 * The product detail page (ADR-0018).
 *
 * Reads through the `ProductSource` port only — no `ContentClient`, no
 * delivery key, no schema URI. A PIM adapter replacing the CMS one leaves
 * this file untouched, which is the property the port exists to provide.
 *
 * Two halves, from one read. The commerce fields come from the normalised
 * `Product`; the editorial slots it carries are handed to the recursive
 * renderer exactly as a page's are, so a product page composes the same
 * blocks every other page can.
 *
 * Rendered as one awaited server component, like the blog article route — no
 * `<Suspense>` shell, so the page arrives whole (no layout jump) and a
 * `notFound()` is thrown before anything streams, giving a real 404 status.
 *
 * No `generateStaticParams`: under the `(site)` 404 boundary (which reads
 * `headers()`), a statically-generated route 500s on any slug not built ahead
 * of time — every slug, when the build saw no products. `listSlugs()` stays on
 * the port for ADR-0022 to enumerate with.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ProductDetailPage } from '@amplience/frontend-starter-components/product-detail-page'
import { isContentClientError } from '@amplience/frontend-starter-content'

import { resolveCurrency } from '../../../../../lib/currency'
import { localeBasePath, localeForSlug, publicPath } from '../../../../../lib/locales'
import { productMediaList } from '../../../../../lib/product-media'
import { productSource } from '../../../../../lib/product-source'
import { registry } from '../../../../../lib/registry'
import { resolveProducts } from '../../../../../lib/resolve-products'
import {
  ContentUnavailableCard,
  emitContentFailure,
  renderContent,
} from '../../../../../src/renderer'

type RouteProps = {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { locale: localeSlug, slug } = await params
  const locale = localeForSlug(localeSlug)
  if (locale === undefined) notFound()

  try {
    const product = await productSource.getBySlug(slug, {
      locale: locale.delivery,
      currency: resolveCurrency(locale.code),
    })
    // The canonical is the public URL, not a delivery key — the site prefix
    // never surfaces in URLs (ADR-0014), the locale prefix does except for
    // the default locale (ADR-0015).
    return {
      title: product.name,
      ...(metaDescription(product) !== undefined && { description: metaDescription(product) }),
      alternates: { canonical: publicPath(locale, `/products/${slug}`) },
    }
  } catch (error) {
    if (isContentClientError(error)) return {}
    throw error
  }
}

export default async function ProductRoute({ params }: RouteProps) {
  const { locale: localeSlug, slug } = await params
  const locale = localeForSlug(localeSlug)
  if (locale === undefined) notFound()

  const product = await productSource
    .getBySlug(slug, { locale: locale.delivery, currency: resolveCurrency(locale.code) })
    .catch((error: unknown) => {
      if (!isContentClientError(error)) throw error
      if (error.kind === 'not-found') notFound()
      emitContentFailure(error, `product:${slug}`)
      return error
    })

  if (isContentClientError(product)) {
    return <ContentUnavailableCard error={product} resource={`product:${slug}`} />
  }

  // The editorial slots render through the recursive renderer, the same path a
  // page's slots take. `loadPriority: 'lcp'` is spent by ProductDetailPage on the
  // gallery's lead image — its registry entry declares `consumesLoadPriority`,
  // so the blocks below start a step lower (ADR-0021 §3).
  const content =
    product.content === undefined
      ? undefined
      : renderContent(product.content, registry, {
          loadPriority: 'eager',
          localeBasePath: localeBasePath(locale),
          locale: locale.code,
          products: await resolveProducts(product.content, registry, locale),
        })

  return (
    <main data-product-detail-page>
      <ProductDetailPage
        name={product.name}
        images={productMediaList(product.images)}
        attributes={product.attributes ?? []}
        tags={product.tags ?? []}
        locale={locale.code}
        loadPriority="lcp"
        {...(product.price !== undefined && { price: product.price })}
        {...(product.shortDescription !== undefined && {
          shortDescription: product.shortDescription,
        })}
        {...(product.description !== undefined && { description: product.description })}
        {...(product.brand !== undefined && { brand: product.brand })}
        {...(product.status !== undefined && { status: product.status })}
      >
        {content}
      </ProductDetailPage>
    </main>
  )
}

/**
 * The meta description: the short copy when there is one, else the long copy
 * clipped at a word boundary near the ~160 characters search results show.
 */
const META_DESCRIPTION_LENGTH = 160

const metaDescription = (product: {
  readonly shortDescription?: string
  readonly description?: string
}): string | undefined => {
  if (product.shortDescription !== undefined) return product.shortDescription
  const text = product.description?.replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  if (text.length <= META_DESCRIPTION_LENGTH) return text
  const clipped = text.slice(0, META_DESCRIPTION_LENGTH - 1)
  const lastSpace = clipped.lastIndexOf(' ')
  return `${lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped}…`
}
