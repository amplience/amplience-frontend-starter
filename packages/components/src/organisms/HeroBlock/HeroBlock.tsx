import clsx from 'clsx'
import { useId, type CSSProperties } from 'react'

import type { ContentMediaData } from '@amplience/quadratic-types'

import { Button, type ButtonProps } from '../../atoms/Button/Button'
import { Container } from '../../atoms/Container/Container'
import type { ContainerProps } from '../../atoms/Container/Container'
import { Typography } from '../../atoms/Typography/Typography'
import { ContentMedia } from '../../molecules/ContentMedia/ContentMedia'
import { resolveDiAspectRatio } from '../../molecules/DynamicImage/di-utils'
import styles from './HeroBlock.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HeroBlockContentPosition = 'overlay' | 'beneath'
export type HeroBlockHeightBehaviour = 'flexible' | 'fitToContent' | 'fitToImage'
export type HeroBlockVerticalPosition = 'top' | 'center' | 'bottom'
export type HeroBlockHorizontalPosition = 'left' | 'center' | 'right'
export type HeroBlockTextAlign = 'left' | 'center' | 'right'
export type HeroBlockOverlayStyle = 'gradient' | 'solid' | 'hard'
export type HeroBlockTextColor = HeroBlockColorToken
/** Shared palette type — used for both backgroundColor and overlayColor. */
export type HeroBlockColorToken =
  'primary' | 'secondary' | 'tertiary' | 'light' | 'dark' | 'black' | 'white'
export type HeroBlockBackgroundColor = HeroBlockColorToken
export type HeroBlockOverlayColor = HeroBlockColorToken

export type HeroBlockCtaProps = {
  label: string
  href: string
  variant?: ButtonProps['variant']
  color?: ButtonProps['color']
}

export type HeroBlockProps = {
  title: string
  subtitle?: string
  /**
   * Optional hero media. Accepts ManualImage (direct URL) or DynamicImage
   * (Amplience DAM asset). Omit for a text-only hero.
   */
  media?: ContentMediaData
  ctas?: HeroBlockCtaProps[]
  /**
   * Where the content sits relative to the image on mobile (≤ 768px).
   *   'overlay' — content overlays the image with a gradient scrim (default).
   *   'beneath' — content flows below the image.
   * Has no effect when image is omitted.
   */
  contentPositionMobile?: HeroBlockContentPosition
  /**
   * Where the content sits relative to the image on desktop (> 768px).
   * Defaults to 'overlay'. Has no effect when image is omitted.
   */
  contentPositionDesktop?: HeroBlockContentPosition
  /**
   * Determines the hero's height when content overlays the image.
   *   'flexible'     — height = max(image's natural ratio, content). Default.
   *                    Uses a CSS grid stacking trick with a ::before spacer
   *                    sized by --media-aspect-ratio, resolved entirely from
   *                    the delivery payload (aspectLock, extension-written
   *                    ratio, or ManualImage dimensions).
   *   'fitToContent' — content drives height; image crops to fill.
   *   'fitToImage'   — image drives height; content sits absolutely on top.
   *                    Warning: content may clip at narrow viewports if it
   *                    exceeds the image height.
   * Has no effect when contentPosition is 'beneath' at the active breakpoint.
   */
  heightBehaviour?: HeroBlockHeightBehaviour
  /**
   * Vertical position of the content within the section: top (default),
   * center, or bottom. Applies whenever the section is taller than its
   * content — overlay layouts, and any mode given slack by `minHeight`
   * (including text-only heroes and `fitToContent`).
   */
  verticalPosition?: HeroBlockVerticalPosition
  /**
   * Horizontal extent and alignment of the content panel.
   *   'left'      — content is capped at 50% width, aligned to the left edge
   *   'center'    — content is capped at 50% width, centred horizontally
   *   'right'     — content is capped at 50% width, aligned to the right edge
   * Only applies in overlay layouts.
   */
  horizontalPosition?: HeroBlockHorizontalPosition
  /**
   * Text alignment of heading, subtitle, and CTA group.
   * Also aligns the CTA button group via justify-content.
   * Defaults to 'center'.
   */
  textAlign?: HeroBlockTextAlign
  /**
   * Max-width constraint on the content slot. Passed through to the Container
   * atom — useful for limiting line length on text-heavy heroes.
   */
  /**
   * Style of the overlay scrim (image overlay).
   *   'gradient' — fades from the content side to transparent (default)
   *   'solid'    — uniform semi-transparent tint across the full image
   *   'hard'     — solid on the content side, sharp cutoff at 50%
   * Direction is derived automatically from horizontalPosition.
   * Has no effect when contentPosition is 'beneath' or no image is present.
   */
  /**
   * Colour of the overlay scrim, drawn from the design token palette.
   * Defaults to black. Use a brand colour for tinted overlays (e.g. a deep
   * navy tint over a lifestyle image).
   * Has no effect when contentPosition is 'beneath' or no image is present.
   */
  overlayColor?: HeroBlockOverlayColor
  overlayStyle?: HeroBlockOverlayStyle
  /**
   * Strength of the overlay scrim.
   *   'none'   — no overlay (0% opacity)
   *   'light'  — subtle tint (20%)
   *   'medium' — standard tint (45%, default)
   *   'strong' — heavy tint (70%)
   * Has no effect when contentPosition is 'beneath' or no image is present.
   */
  /**
   * Opacity of the overlay scrim as a percentage (0–100).
   * Set per-image: the right value depends on the image content and the
   * scrim colour chosen. Defaults to 0 (no overlay).
   */
  overlayIntensity?: number
  /**
   * Text colour of the content panel (title, subtitle), drawn from the
   * design token palette. In overlay mode the default is white; in beneath
   * mode it inherits from the page. Set this to override either.
   * Buttons manage their own colours and are unaffected.
   */
  textColor?: HeroBlockTextColor | undefined
  /**
   * Background colour of the hero section, drawn from the design token palette.
   * Applies in all layout modes and serves as:
   *   - A fallback when no image is provided
   *   - A placeholder colour while the image loads (reduces jarring flash)
   *   - A legibility guarantee for overlaid text before the image appears
   * When set, a matching foreground colour is applied automatically so text
   * remains readable even without the image.
   */
  backgroundColor?: HeroBlockBackgroundColor
  contentWidth?: number
  contentPadding?: number | undefined
  maxWidth?: ContainerProps['maxWidth']
  minHeight?: number
  maxHeight?: number
  /**
   * True when this hero is the first block on the page (supplied by the
   * renderer via RenderContext, not authored). A top-of-page hero image is
   * the likely LCP element, so it renders with next/image `priority` —
   * eager load, `fetchpriority="high"`, and a head preload hint. Below the
   * fold, next/image's default lazy loading applies. Defaults to false.
   */
  isTopOfPage?: boolean
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Hero molecule — the first-impression section of a page. Composes the
 * Image, Typography, and Button atoms.
 *
 * Layout modes (per breakpoint):
 *   overlay — image behind content with a gradient scrim
 *   beneath — image above, content below
 *
 * Height behaviours (overlay only):
 *   flexible     — grows with the tallest of content or image (default)
 *   fitToContent — image crops to match content-driven height
 *   fitToImage   — height locked to image ratio; content floats on top
 *
 * Content panel positioning (overlay only):
 *   verticalPosition  — top (default) / center / bottom
 *   horizontalPosition — left (default) / center / right
 *   textAlign — left (default) / center / right
 *
 * All visual theming reads from --hero-* CSS variables; brands override
 * under [data-brand] without touching this file.
 *
 * Usage:
 *   // Text-only
 *   <Hero title="Welcome" subtitle="…" cta={[{ label: 'Start', href: '/docs' }]} />
 *
 *   // Overlay hero (default)
 *   <Hero title="Welcome" media={{ mediaType: 'ManualImage', src: '/hero.jpg', alt: 'Hero', width: 1600, height: 900 }} />
 *
 *   // Beneath on mobile, overlay on desktop
 *   <Hero
 *     title="Welcome"
 *     media={…}
 *     contentPositionMobile="beneath"
 *     contentPositionDesktop="overlay"
 *   />
 */
export function HeroBlock({
  title,
  subtitle,
  media,
  ctas,
  contentPositionMobile = 'overlay',
  contentPositionDesktop = 'overlay',
  heightBehaviour = 'flexible',
  verticalPosition = 'top',
  horizontalPosition = 'left',
  textAlign = 'left',
  textColor,
  overlayStyle = 'gradient',
  overlayColor = 'black',
  overlayIntensity = 0,
  backgroundColor = 'light',
  maxWidth = 'default',
  contentWidth = 50,
  contentPadding,
  minHeight,
  maxHeight,
  isTopOfPage = false,
  className,
}: HeroBlockProps) {
  const hasMedia = media != null
  const titleId = useId()

  // The ::before spacer in 'flexible' overlay mode needs the media aspect
  // ratio as a CSS custom property. Only set when at least one breakpoint
  // uses overlay + flexible.
  const needsAspectRatio =
    hasMedia &&
    heightBehaviour === 'flexible' &&
    (contentPositionMobile === 'overlay' || contentPositionDesktop === 'overlay')

  // The media's displayed ratio, resolved from the delivery payload alone:
  //   ManualImage  — explicit aspectRatio override, else intrinsic width/height
  //   DynamicImage — the image-poi aspectLock ('none' = author unlocked it),
  //                  else the crop-aware ratio the di-transform extension
  //                  wrote into the field at pick time.
  // No guessed default: undefined means no spacer height (content drives it).
  // Defensive on every access: hub content can predate the media partial
  // (legacy flat image shape) — degrade to "no ratio" rather than crash SSG.
  function getAspectRatioCss(m: ContentMediaData): string | undefined {
    if (m.mediaType === 'ManualImage' && m.image !== undefined) {
      return m.image.aspectRatio ?? `${m.image.width} / ${m.image.height}`
    }
    if (m.mediaType === 'DynamicImage' && m.image !== undefined) {
      return resolveDiAspectRatio(m.image)
    }
    return undefined
  }

  return (
    <section
      aria-labelledby={titleId}
      className={clsx(styles.root, className)}
      data-content-position-mobile={hasMedia ? contentPositionMobile : undefined}
      data-content-position-desktop={hasMedia ? contentPositionDesktop : undefined}
      data-height-behaviour={hasMedia ? heightBehaviour : undefined}
      data-vertical-position={verticalPosition}
      data-horizontal-position={horizontalPosition}
      data-text-align={textAlign}
      data-overlay-color={hasMedia ? overlayColor : undefined}
      data-overlay-style={hasMedia ? overlayStyle : undefined}
      data-background-color={backgroundColor}
      data-text-color={textColor}
      data-max-height={maxHeight != null ? true : undefined}
      style={(() => {
        const vars: Record<string, string | number> = {}
        if (needsAspectRatio) {
          const ratio = getAspectRatioCss(media)
          if (ratio !== undefined) vars['--media-aspect-ratio'] = ratio
        }
        if (hasMedia) vars['--hero-scrim-opacity'] = overlayIntensity / 100
        if (minHeight != null) vars['--hero-min-height'] = `${minHeight}px`
        if (maxHeight != null) vars['--hero-max-height'] = `${maxHeight}px`
        return Object.keys(vars).length > 0 ? vars : undefined
      })()}
    >
      {hasMedia && (
        <div className={styles.media}>
          {/*
            Defaults sit before the spread so authored `image` props win.
            - priority: top-of-page hero is the likely LCP element. Triggers
              the head preload and eager loading.
            - fetchPriority: next/image (v16) no longer derives fetchpriority
              from `priority`, so we set it explicitly for the LCP hero. This
              lands `fetchpriority="high"` on both the <img> and the preload
              link — the "LCP request discovery" audit fix.
            - sizes: the media image is full-bleed (width:100% of the section,
              which spans the viewport), so it renders at ~100vw at every
              breakpoint. Declaring it lets next/image preload the correctly
              sized candidate instead of defaulting to the largest 3840px image.
          */}
          <ContentMedia
            priority={isTopOfPage}
            {...(isTopOfPage && { fetchPriority: 'high' })}
            sizes="100vw"
            {...media}
            {...(styles.image !== undefined && { className: styles.image })}
          />
        </div>
      )}

      <Container className={styles.container ?? ''} maxWidth={maxWidth} gutter>
        <div
          className={styles.content}
          style={
            {
              '--contentWidth': `${contentWidth}%`,
              paddingBlock: contentPadding ?? undefined,
            } as CSSProperties
          }
        >
          <Typography id={titleId} variant="h1" className={styles.title ?? ''}>
            {title}
          </Typography>

          {subtitle && (
            <Typography variant="p" className={styles.subtitle ?? ''}>
              {subtitle}
            </Typography>
          )}

          {ctas && ctas.length > 0 && (
            <div className={styles.buttonGroup}>
              {ctas.map(({ href, variant, color, label }: HeroBlockCtaProps) => (
                <Button
                  key={href}
                  href={href}
                  variant={variant ?? 'solid'}
                  color={color ?? 'primary'}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </Container>
    </section>
  )
}
