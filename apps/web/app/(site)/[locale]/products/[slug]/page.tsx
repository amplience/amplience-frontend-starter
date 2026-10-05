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
 * Written ADR-0022-shaped ahead of the caching work: a synchronous shell
 * around an async inner component with `params` awaited inside `<Suspense>`,
 * `generateMetadata` structured so a `use cache` directive is a one-line
 * addition, and no route segment config at all.
 *
 * `generateStaticParams` prerenders nothing today — `cacheComponents` is
 * unset, the `(site)` 404 boundary reads `headers()`, and `[locale]` is
 * unenumerated, so it is as unreachable here as it is on `/blog/[slug]`. It
 * ships because it is the port consumer ADR-0018 §2 wants and the
 * enumeration source ADR-0022 open question #5 needs. Note the live trap
 * recorded as ADR-0018 open question #11: under `cacheComponents` an empty
 * return errors, and a hub with no products returns exactly that.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { ProductDetail } from '@amplience/frontend-starter-components/product-detail'
import { isContentClientError } from '@amplience/frontend-starter-content'

import { resolveCurrency } from '../../../../../lib/currency'
import { localeBasePath, localeForSlug, locales, publicPath } from '../../../../../lib/locales'
import { productMediaList } from '../../../../../lib/product-media'
import { productSource } from '../../../../../lib/product-source'
import { registry } from '../../../../../lib/registry'
import {
  ContentUnavailableCard,
  emitContentFailure,
  renderContent,
} from '../../../../../src/renderer'

type RouteProps = {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateStaticParams() {
  // `listSlugs` rather than `list`: route enumeration needs slugs and nothing
  // else, and a PIM adapter can serve that from a cheap endpoint instead of
  // paging a whole catalogue. Delivery keys aren't localized, so one call
  // yields the slug set; the cross-product with the supported locales covers
  // every product in every language.
  const slugs = await productSource.listSlugs()
  return locales.flatMap((locale) => slugs.map((slug) => ({ locale: locale.slug, slug })))
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
      ...(product.shortDescription !== undefined && { description: product.shortDescription }),
      alternates: { canonical: publicPath(locale, `/products/${slug}`) },
    }
  } catch (error) {
    if (isContentClientError(error)) return {}
    throw error
  }
}

export default function ProductPage({ params }: RouteProps) {
  return (
    <Suspense fallback={null}>
      <ProductDetailPage params={params} />
    </Suspense>
  )
}

async function ProductDetailPage({ params }: RouteProps) {
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
  // page's slots take. `loadPriority: 'lcp'` is spent by ProductDetail on the
  // gallery's lead image — its registry entry declares `consumesLoadPriority`,
  // so the blocks below start a step lower (ADR-0021 §3).
  const content =
    product.content === undefined
      ? undefined
      : renderContent(product.content, registry, {
          loadPriority: 'eager',
          localeBasePath: localeBasePath(locale),
        })

  return (
    <main data-product-detail-page>
      <ProductDetail
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
        {...(product.brand !== undefined && { brand: product.brand })}
        {...(product.status !== undefined && { status: product.status })}
      >
        {content}
      </ProductDetail>
    </main>
  )
}
