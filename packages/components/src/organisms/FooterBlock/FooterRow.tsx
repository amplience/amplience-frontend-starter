import clsx from 'clsx'
import type { ReactNode } from 'react'

import { Container } from '../../atoms/Container/Container'
import type { ContainerProps } from '../../atoms/Container/Container'
import styles from './FooterRow.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FooterRowColorToken =
  'primary' | 'secondary' | 'tertiary' | 'light' | 'dark' | 'black' | 'white'

export type FooterRowProps = {
  /**
   * Background colour token for this row. Applied via a data attribute so
   * brands can override the resolved value under [data-brand] without
   * touching this component.
   */
  backgroundColor?: FooterRowColorToken
  /**
   * Max-width of the inner content container. The row itself always spans the
   * full viewport width so the background colour bleeds edge-to-edge; only the
   * items inside are constrained. Defaults to `"default"`.
   */
  maxWidth?: ContainerProps['maxWidth']
  children?: ReactNode
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * FooterRow molecule — a single horizontal row within the site footer.
 *
 * Renders a flex row with horizontal gutter padding. Background and
 * foreground colours are set via data attributes and resolved to brand
 * tokens in the CSS. Each row carries its own palette independently, so
 * different rows can have different colour schemes.
 *
 * Items (Logo, Menu) are passed in as `children` by the renderer.
 *
 * Brand overrides (no component changes required):
 *   [data-brand="acme"] [data-background-color="dark"] { background-color: #111; }
 */
export function FooterRow({
  backgroundColor,
  maxWidth = 'default',
  children,
  className,
}: FooterRowProps) {
  return (
    <div className={clsx(styles.root, className)} data-color={backgroundColor}>
      <Container maxWidth={maxWidth} gutter className={clsx(styles.container, styles.inner)}>
        {children}
      </Container>
    </div>
  )
}
