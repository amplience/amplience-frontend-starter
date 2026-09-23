import clsx from 'clsx'
import type { ReactNode } from 'react'

import type { ContentMediaData, MediaLoadPriority } from '@amplience/frontend-starter-types'

import { Container } from '../../atoms/Container/Container'
import { Price } from '../../atoms/Price/Price'
import { Typography } from '../../atoms/Typography/Typography'
import { AttributeList } from '../../molecules/AttributeList/AttributeList'
import type { Attribute } from '../../molecules/AttributeList/AttributeList'
import { Carousel } from '../../molecules/Carousel/Carousel'
import { ContentMedia } from '../../molecules/ContentMedia/ContentMedia'
import { mediaLoadingProps } from '../../molecules/ContentMedia/mediaLoadingProps'
import { Tags } from '../../molecules/Tags/Tags'
import { carouselSlotSizes } from '../../utils/imageSizes'
import styles from './ProductDetail.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProductDetailStatus = 'active' | 'coming-soon' | 'discontinued'

export type ProductDetailProps = {
  /** Product display name — the page's h1. */
  readonly name: string
  /** Amount in major units. Omit for a product with no price. */
  readonly price?: { readonly amount: number; readonly currencyCode: string }
  /**
   * Product imagery, first image first. Zero renders no gallery region, one
   * renders a single image, several render a carousel — see the component doc.
   */
  readonly images?: readonly ContentMediaData[]
  /** A sentence or two below the name. */
  readonly shortDescription?: string
  /** Display-only spec rows. */
  readonly attributes?: readonly Attribute[]
  /** Free-text category label. */
  readonly category?: string
  /** Topic tags. */
  readonly tags?: readonly string[]
  /** Editorial lifecycle. `active` shows no badge. */
  readonly status?: ProductDetailStatus
  /** BCP 47 locale for price formatting. See `Price`. */
  readonly locale?: string
  /**
   * How urgently the lead image should load. A PDP's first image is its LCP
   * element in practice, so the route hands this template `'lcp'` and the
   * registry entry declares `consumesLoadPriority` — which demotes what the
   * editorial slots below inherit (ADR-0021).
   */
  readonly loadPriority?: MediaLoadPriority
  /** The product's rendered editorial slots, in content order. */
  readonly children?: ReactNode
}

const STATUS_LABELS: Record<Exclude<ProductDetailStatus, 'active'>, string> = {
  'coming-soon': 'Coming soon',
  discontinued: 'Discontinued',
}

/**
 * Slides shown at each breakpoint when the gallery is a carousel. One at a
 * time on every size: a PDP gallery is about seeing the product, not about
 * browsing a track, and a single large slide is what the `sizes` hint below
 * is derived from.
 */
const GALLERY_SLIDES = { slidesMobile: 1, slidesTablet: 1, slidesDesktop: 1 } as const

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ProductDetail template — the rendered form of a `product` content item.
 *
 * Two halves. The commerce half (gallery, name, price, description,
 * attributes) comes from the normalised `Product` the `ProductSource` port
 * returns, so it renders identically whether that product came from the CMS
 * or from a PIM. The editorial half is `children` — the product's slots,
 * rendered by the recursive renderer exactly as a page's are.
 *
 * The gallery has three forms, and the distinction is deliberate:
 *
 *   none — no gallery region at all. Not an empty box and not a placeholder;
 *          ADR-0021 prefers reserved space to a fake image, and on a PDP
 *          there is nothing to reserve space *for*.
 *   one  — a single image. Not a one-slide carousel: controls that cannot go
 *          anywhere are worse than no controls.
 *   many — the `Carousel` molecule. Composed, not reimplemented (ADR-0020 §5).
 *
 * Head metadata is the route's job via `productMetadataFromSchema`, not this
 * component's.
 */
export function ProductDetail({
  name,
  price,
  images,
  shortDescription,
  attributes,
  category,
  tags,
  status = 'active',
  locale,
  loadPriority = 'lazy',
  children,
}: ProductDetailProps) {
  const gallery = images ?? []

  return (
    <article className={clsx('ProductDetail', styles.root)} data-product-detail>
      <Container gutter>
        <div className={styles.layout}>
          <div className={styles.gallery}>{renderGallery(gallery, name, loadPriority)}</div>

          <div className={styles.summary}>
            {category !== undefined && (
              <Typography variant="p" className={clsx(styles.category)}>
                {category}
              </Typography>
            )}

            <Typography variant="h1" className={clsx(styles.name)}>
              {name}
            </Typography>

            {status !== 'active' && (
              <span className={styles.status} data-status={status}>
                {STATUS_LABELS[status]}
              </span>
            )}

            {price !== undefined && (
              <Price
                amount={price.amount}
                currencyCode={price.currencyCode}
                className={clsx(styles.price)}
                {...(locale !== undefined && { locale })}
              />
            )}

            {shortDescription !== undefined && (
              <Typography variant="p" className={clsx(styles.description)}>
                {shortDescription}
              </Typography>
            )}

            {attributes !== undefined && attributes.length > 0 && (
              <AttributeList attributes={attributes} className={clsx(styles.attributes)} />
            )}

            {tags !== undefined && tags.length > 0 && (
              <Tags tags={tags} className={clsx(styles.tags)} />
            )}
          </div>
        </div>
      </Container>

      {children !== undefined && <div className={styles.content}>{children}</div>}
    </article>
  )
}

/**
 * The gallery, in whichever of its three forms applies.
 *
 * Only the first image gets the incoming tier; the rest drop to `'lazy'`.
 * A carousel's later slides are off-screen by definition, which is exactly
 * the case lazy loading exists for — eagerly loading the whole track would
 * compete with the LCP for bandwidth (ADR-0021's ADR-0020 knock-on).
 */
function renderGallery(
  images: readonly ContentMediaData[],
  name: string,
  loadPriority: MediaLoadPriority,
): ReactNode {
  if (images.length === 0) return null

  const [lead, ...rest] = images
  if (lead === undefined) return null

  const single = (media: ContentMediaData, tier: MediaLoadPriority, sizes?: string) => (
    <ContentMedia
      {...media}
      {...mediaLoadingProps(tier)}
      {...(sizes !== undefined && { sizes })}
      {...(styles.image !== undefined && { className: styles.image })}
    />
  )

  // One image: a plain image. A carousel with nothing to scroll to would
  // render dead controls, which the molecule already suppresses — but the
  // wrapper markup and drag handlers would still be there for nothing.
  if (rest.length === 0) {
    return single(lead, loadPriority, GALLERY_SIZES)
  }

  return (
    <Carousel
      {...GALLERY_SLIDES}
      showDots
      label={`${name} images`}
      className={clsx(styles.carousel)}
    >
      {images.map((media, index) => (
        // Index keys: the gallery is a fixed, ordered list from one content
        // item and never reorders, and a media body has no stable id of its
        // own to key on.
        <div key={index} className={styles.slide}>
          {single(media, index === 0 ? loadPriority : 'lazy', GALLERY_SIZES)}
        </div>
      ))}
    </Carousel>
  )
}

/**
 * The gallery occupies one full-width slide inside a half-width column on
 * desktop. `carouselSlotSizes` gives the slide fraction; the column split is
 * the layout's own, so this over-declares slightly on wide screens — which is
 * the direction the sizes helpers deliberately round.
 */
const GALLERY_SIZES = carouselSlotSizes(GALLERY_SLIDES)
