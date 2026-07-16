import clsx from 'clsx'
import type { ReactNode } from 'react'

import { Container } from '../../atoms/Container/Container'
import type { ContainerProps } from '../../atoms/Container/Container'
import styles from './ColumnsBlock.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ColumnsBlockColorToken =
  'primary' | 'secondary' | 'tertiary' | 'light' | 'dark' | 'black' | 'white'

export type ColumnsBlockBackgroundColor = ColumnsBlockColorToken

export type ColumnsBlockProps = {
  children?: ReactNode
  /**
   * Gap between columns, in px.
   * Defaults to the --gap token (16px at the base scale).
   */
  gap?: number
  /**
   * Vertical alignment of column children within the row.
   * Defaults to 'stretch' (columns fill the tallest child's height).
   */
  alignItems?: 'top' | 'center' | 'bottom'
  backgroundColor?: ColumnsBlockBackgroundColor
  /**
   * Max-width constraint passed through to the inner Container atom.
   * Defaults to 'default'.
   */
  maxWidth?: ContainerProps['maxWidth']
  /**
   * When true, adds horizontal padding (`--site-gutter`) to the inner Container
   * so columns are inset from the section edge. Omit or set false for
   * edge-to-edge layouts.
   * Defaults to false.
   */
  gutter?: boolean
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ColumnsBlock molecule — a fixed, non-wrapping set of equal-width columns.
 *
 * Each direct child occupies one equal column; the number of columns is
 * determined by the number of children. Columns never wrap — content
 * intentionally runs edge-to-edge at all breakpoints.
 *
 * For a wrapping or auto-sizing grid, use GridBlock instead.
 *
 * All visual theming reads from --columns-block-* CSS variables; brands
 * override under [data-brand] without touching this file.
 *
 * Usage:
 *   <ColumnsBlock>
 *     <Image … />
 *     <RichText … />
 *   </ColumnsBlock>
 */
export function ColumnsBlock({
  children,
  gap,
  alignItems,
  backgroundColor,
  maxWidth = 'default',
  gutter = false,
  className,
}: ColumnsBlockProps) {
  const alignItemsMap = { top: 'start', center: 'center', bottom: 'end' } as const
  const cssVars: Record<string, string> = {}
  if (gap != null) cssVars['--columns-block-gap'] = `${gap}px`
  if (alignItems != null) cssVars['--columns-block-align-items'] = alignItemsMap[alignItems]

  return (
    <section
      className={clsx('ColumnsBlock', styles.root, className)}
      data-background-color={backgroundColor}
      style={Object.keys(cssVars).length > 0 ? cssVars : undefined}
    >
      <Container className={styles.container ?? ''} maxWidth={maxWidth} gutter={gutter}>
        <div className={styles.columns}>{children}</div>
      </Container>
    </section>
  )
}
