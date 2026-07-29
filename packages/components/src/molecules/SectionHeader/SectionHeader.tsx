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
 * …) hold a single grouped `sectionHeader` object (mirroring the CMS
 * `section-header` partial) and spread it straight in — the field shape stays
 * in one place, and blocks that grow a header stay consistent for free.
 *
 * Every field is optional: the whole header is optional, and the component
 * renders nothing until at least one field is set. The molecule is shaped to
 * grow — a future `align` (mapping to Typography's `left | center | right`)
 * and an array of CTA links sit naturally alongside these without changing
 * existing call sites.
 */
export type SectionHeaderProps = {
  title?: string | undefined
  subtitle?: string | undefined
  description?: string | undefined
  className?: string | undefined
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
