import clsx from 'clsx'

import { Button } from '../../atoms/Button/Button'
import type { ButtonColor, ButtonVariant } from '../../atoms/Button/Button'
import { Container } from '../../atoms/Container/Container'
import type { ContainerProps } from '../../atoms/Container/Container'
import { Markdown } from '../../molecules/Markdown/Markdown'
import type { MarkdownProps } from '../../molecules/Markdown/Markdown'
import styles from './MarkdownBlock.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarkdownBlockColorToken =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'light'
  | 'dark'
  | 'black'
  | 'white'

export type MarkdownBlockCtaProps = {
  label: string
  href: string
  variant?: ButtonVariant
  color?: ButtonColor
}

export type MarkdownBlockProps = MarkdownProps & {
  /**
   * Background colour of the section, drawn from the design token palette.
   */
  backgroundColor?: MarkdownBlockColorToken
  /**
   * Max-width constraint passed through to the inner Container atom.
   * Defaults to 'default'.
   */
  maxWidth?: ContainerProps['maxWidth']
  /**
   * When true, adds horizontal padding (`--site-gutter`) to the inner Container
   * so content is inset from the section edge.
   * Defaults to false.
   */
  gutter?: boolean
  /**
   * When true, strips the outer `<section>` and `<Container>` wrapper —
   * renders only the Markdown molecule. Use when MarkdownBlock is nested
   * inside a layout component (ColumnsBlock, GridBlock) that already provides
   * container semantics.
   * Defaults to false.
   */
  bare?: boolean
  /**
   * Optional array of call-to-action buttons rendered below the markdown content.
   * Each item maps to a Button atom; `variant` defaults to 'solid', `color` to 'primary'.
   */
  ctas?: MarkdownBlockCtaProps[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CtaRow({ ctas }: { ctas: MarkdownBlockCtaProps[] }) {
  return (
    <div className={styles.ctas}>
      {ctas.map(({ label, href, variant = 'solid', color = 'primary' }) => (
        <Button key={href} href={href} variant={variant} color={color}>
          {label}
        </Button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * MarkdownBlock organism — a standalone markdown section on a page.
 *
 * Renders CommonMark content inside a semantic `<section>` with the standard
 * layout controls (max-width, gutter, background colour). An optional `ctas`
 * array renders a row of buttons below the content. When `bare` is set,
 * the section and Container are omitted so it can compose inside GridBlock or
 * ColumnsBlock without double-padding.
 *
 * Usage:
 *   <MarkdownBlock content="## Hello\n\nWorld." />
 *   <MarkdownBlock content="Narrow copy." maxWidth="narrow" gutter />
 *   <MarkdownBlock content="Inside a column." bare />
 *   <MarkdownBlock content="CTA example." ctas={[{ label: 'Go', href: '/go' }]} />
 */
export function MarkdownBlock({
  content,
  backgroundColor,
  maxWidth = 'default',
  gutter = false,
  bare = false,
  ctas,
  className,
}: MarkdownBlockProps) {
  const hasCtas = ctas && ctas.length > 0

  if (bare) {
    return (
      <div className={className ? clsx(styles.bareWrapper, className) : styles.bareWrapper}>
        <Markdown content={content} />
        {hasCtas && <CtaRow ctas={ctas} />}
      </div>
    )
  }

  return (
    <section className={clsx(styles.root, className)} data-background-color={backgroundColor}>
      <Container maxWidth={maxWidth} gutter={gutter}>
        <Markdown content={content} />
        {hasCtas && <CtaRow ctas={ctas} />}
      </Container>
    </section>
  )
}
