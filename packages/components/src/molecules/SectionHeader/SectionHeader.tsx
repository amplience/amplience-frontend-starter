import clsx from 'clsx'

import { Typography } from '../../atoms/Typography/Typography'
import styles from './SectionHeader.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the SectionHeader molecule.
 *
 * Exported so blocks that render a section heading (ColumnsBlock, GridBlock,
 * …) can pick the fields they expose rather than re-declaring them — the shape
 * stays in one place, and blocks that grow a header stay consistent for free.
 *
 * Only `title` exists today. The molecule is shaped to grow: a future
 * `align` (mapping to Typography's `left | center | right`), a `description`
 * paragraph, and an array of CTA links all sit naturally alongside `title`
 * without changing the call sites that pass only a title.
 */
export type SectionHeaderProps = {
  /** Heading text. When absent, the header renders nothing. */
  title: string | undefined
  subtitle?: string | undefined
  description?: string | undefined
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SectionHeader molecule — an optional heading rendered above a block's
 * content. Renders as an h2 via the Typography atom so heading styling stays
 * consistent with the rest of the design system.
 *
 * Returns nothing when `title` is empty, so blocks can render it
 * unconditionally: `<SectionHeader title={title} />`.
 */
export function SectionHeader({ title, subtitle, description, className }: SectionHeaderProps) {
  if (!title && !subtitle && !description) return null

  return (
    <header className={clsx('SectionHeader', styles.root, className)}>
      <Typography variant="h2">{title}</Typography>

      {subtitle && <Typography variant="h3">{subtitle}</Typography>}

      {description && <Typography>{description}</Typography>}
    </header>
  )
}
