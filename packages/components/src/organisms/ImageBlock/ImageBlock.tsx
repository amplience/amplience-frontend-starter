import clsx from 'clsx'

import { Container } from '../../atoms/Container/Container'
import type { ContainerProps } from '../../atoms/Container/Container'
import { Image } from '../../atoms/Image/Image'
import type { ImageProps } from '../../atoms/Image/Image'
import { Link } from '../../atoms/Link/Link'
import { Typography } from '../../atoms/Typography/Typography'
import styles from './ImageBlock.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImageBlockColorToken =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'light'
  | 'dark'
  | 'black'
  | 'white'

export type ImageBlockBackgroundColor = ImageBlockColorToken

export type ImageBlockProps = {
  /**
   * Image to render. All Image atom props are accepted (src, alt, width,
   * height, aspectRatio, priority, unoptimized, etc.).
   */
  image: ImageProps
  /**
   * Optional caption rendered below the image in a <figcaption>.
   */
  caption?: string
  /**
   * Optional URL. When provided, the image is wrapped in a link.
   * External URLs open in a new tab; internal paths use Next.js routing.
   */
  href?: string
  /**
   * When true, the image extends edge-to-edge — the Container's horizontal
   * padding and max-width cap are both removed. Equivalent to setting
   * maxWidth="full" with the gutter removed.
   *
   * Vertical padding on the section is preserved.
   * Defaults to false.
   */
  fullBleed?: boolean
  /**
   * Background colour of the section, drawn from the design token palette.
   */
  backgroundColor?: ImageBlockBackgroundColor
  /**
   * Max-width constraint passed through to the inner Container atom.
   * Ignored when fullBleed is true.
   * Defaults to 'default'.
   */
  maxWidth?: ContainerProps['maxWidth']
  /**
   * When true, strips the outer `<section>` and `<Container>` wrapper and
   * renders only the `<figure>`. Use when ImageBlock is nested inside a layout
   * component (ColumnsBlock, GridBlock) that already provides container
   * semantics — avoids double-padding and misaligned max-width caps.
   * Defaults to false.
   */
  bare?: boolean
  /**
   * True when this block is the first block on the page (supplied by the
   * renderer via RenderContext, not authored). A top-of-page image is the
   * likely LCP element, so it renders with next/image `priority` — eager
   * load, `fetchpriority="high"`, and a head preload hint. Below the fold,
   * next/image's default lazy loading applies. An explicit `image.priority`
   * still wins. Defaults to false.
   */
  isTopOfPage?: boolean
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ImageBlock molecule — a standalone image section on a page.
 *
 * Composes the Image atom inside a semantic <figure> element, with optional:
 *   - caption  — <figcaption> below the image
 *   - href     — wraps image in a Link (internal or external)
 *   - fullBleed — image runs edge-to-edge (no Container padding)
 *
 * All visual theming reads from --image-block-* CSS variables; brands
 * override under [data-brand] without touching this file.
 *
 * Usage:
 *   // Contained
 *   <ImageBlock image={{ src: '/photo.jpg', alt: 'Photo', width: 1200, height: 800 }} />
 *
 *   // Full-bleed with caption
 *   <ImageBlock
 *     fullBleed
 *     image={{ src: '/banner.jpg', alt: 'Banner', width: 1920, height: 600 }}
 *     caption="Photography by Jane Smith"
 *   />
 *
 *   // Linked image
 *   <ImageBlock
 *     image={{ src: '/promo.jpg', alt: 'Promo', width: 800, height: 600 }}
 *     href="/products/spring-collection"
 *   />
 */
export function ImageBlock({
  image,
  caption,
  href,
  fullBleed,
  backgroundColor,
  maxWidth = 'default',
  bare = false,
  isTopOfPage = false,
  className,
}: ImageBlockProps) {
  // Default before the spread: an authored `priority` overrides.
  const imageEl = (
    <Image priority={isTopOfPage} {...image} className={clsx(styles.image, image.className)} />
  )

  const figure = (
    <figure className={clsx(styles.figure, bare && className)}>
      {href ? (
        <Link href={href} className={clsx(styles.link)}>
          {imageEl}
        </Link>
      ) : (
        imageEl
      )}
      {caption && (
        <figcaption className={styles.caption}>
          <Typography variant="p">{caption}</Typography>
        </figcaption>
      )}
    </figure>
  )

  if (bare)
    return (
      <section
        className={clsx(styles.root, className)}
        data-full-bleed={fullBleed ? 'true' : undefined}
        data-background-color={backgroundColor}
      >
        {figure}
      </section>
    )

  return (
    <section
      aria-label={caption ? `Image: ${caption}` : 'Image'}
      className={clsx(styles.root, className)}
      data-full-bleed={fullBleed ? 'true' : undefined}
      data-background-color={backgroundColor}
    >
      <Container
        className={styles.container ?? ''}
        maxWidth={fullBleed ? 'full' : maxWidth}
        gutter={!fullBleed}
      >
        {figure}
      </Container>
    </section>
  )
}
