import clsx from 'clsx'
import type { ReactNode } from 'react'

import { Container } from '../../atoms/Container/Container'
import type { ContainerProps } from '../../atoms/Container/Container'
import { SectionHeader } from '../../molecules/SectionHeader/SectionHeader'
import type { SectionHeaderProps } from '../../molecules/SectionHeader/SectionHeader'
import styles from './GridBlock.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GridBlockColorToken =
  'primary' | 'secondary' | 'tertiary' | 'light' | 'dark' | 'black' | 'white'

export type GridBlockBackgroundColor = GridBlockColorToken

/**
 * Controls how column widths are determined.
 *
 *   'fixed' — explicit column counts per breakpoint (mobile / tablet / desktop).
 *   'auto'  — browser derives columns from a minimum item width via
 *              `repeat(auto-fit, minmax(minItemWidth, 1fr))`. No breakpoint
 *              configuration needed; columns collapse naturally.
 */
export type GridBlockSizingMode = 'fixed' | 'auto'

export type GridBlockProps = {
  children?: ReactNode
  /**
   * Sizing strategy — see GridBlockSizingMode.
   * Defaults to 'fixed'.
   */
  sizingMode?: GridBlockSizingMode
  /**
   * Columns on mobile (≤ 768px). Only applies when sizingMode is 'fixed'.
   * Defaults to 1.
   */
  columnsMobile?: number
  /**
   * Columns on tablet (769–1024px). Only applies when sizingMode is 'fixed'.
   * Defaults to 2.
   */
  columnsTablet?: number
  /**
   * Columns on desktop (≥ 1025px). Only applies when sizingMode is 'fixed'.
   * Defaults to 3.
   */
  columnsDesktop?: number
  /**
   * Minimum item width in px. Only applies when sizingMode is 'auto'.
   * The browser fits as many columns as possible without going below this width.
   * Defaults to 250.
   */
  minItemWidth?: number
  /**
   * Gap between grid cells, in px.
   * Defaults to the --gap token (16px at the base scale).
   */
  gap?: number
  /**
   * Optional heading group rendered above the grid — title, subtitle and
   * description spread straight into SectionHeader. See the `section-header`
   * CMS partial, which delivers this same grouped shape.
   */
  sectionHeader?: Omit<SectionHeaderProps, 'className'>
  /**
   * Background colour of the section, drawn from the design token palette.
   */
  backgroundColor?: GridBlockBackgroundColor
  /**
   * Max-width constraint passed through to the inner Container atom.
   * Defaults to 'default'.
   */
  maxWidth?: ContainerProps['maxWidth']
  /**
   * When true, adds horizontal padding (`--site-gutter`) to the inner Container
   * so grid items are inset from the section edge. Omit or set false for
   * edge-to-edge grids (e.g. inside a full-bleed colour band).
   * Defaults to false.
   */
  gutter?: ContainerProps['gutter']
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * GridBlock molecule — a wrapping grid of child content items.
 *
 * Two sizing modes:
 *   fixed — columns-per-breakpoint (mobile / tablet / desktop)
 *   auto  — browser-driven via minItemWidth; columns collapse naturally
 *
 * The grid never overflows or clips: all columns wrap by design.
 * For a non-wrapping column layout, use ColumnsBlock instead.
 *
 * All visual theming reads from --grid-block-* CSS variables; brands
 * override under [data-brand] without touching this file.
 *
 * Usage:
 *   // Fixed columns
 *   <GridBlock columnsMobile={1} columnsTablet={2} columnsDesktop={4}>
 *     <Card … /> <Card … />
 *   </GridBlock>
 *
 *   // Auto-sizing
 *   <GridBlock sizingMode="auto" minItemWidth={300}>
 *     <Card … /> <Card … />
 *   </GridBlock>
 */
export function GridBlock({
  children,
  sizingMode = 'fixed',
  columnsMobile = 1,
  columnsTablet = 2,
  columnsDesktop = 3,
  minItemWidth = 250,
  gap,
  backgroundColor,
  sectionHeader,
  maxWidth = 'default',
  gutter = false,
  className,
}: GridBlockProps) {
  const cssVars: Record<string, string | number> = {
    '--grid-block-columns-mobile': columnsMobile,
    '--grid-block-columns-tablet': columnsTablet,
    '--grid-block-columns-desktop': columnsDesktop,
    '--grid-block-min-item-width': `${minItemWidth}px`,
  }
  if (gap != null) cssVars['--grid-block-gap'] = `${gap}px`

  return (
    <section
      className={clsx('GridBlock', styles.root, className)}
      data-sizing-mode={sizingMode}
      data-background-color={backgroundColor}
      style={cssVars}
    >
      <Container className={styles.container ?? ''} maxWidth={maxWidth} gutter={gutter}>
        <SectionHeader {...(sectionHeader ?? {})} />
        <div className={styles.grid}>{children}</div>
      </Container>
    </section>
  )
}
