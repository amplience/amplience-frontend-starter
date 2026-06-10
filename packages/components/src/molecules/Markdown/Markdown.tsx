import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'

import { Link } from '../../atoms/Link/Link'
import { List } from '../../atoms/List/List'
import { ListItem } from '../../atoms/ListItem/ListItem'
import { Typography } from '../../atoms/Typography/Typography'
import styles from './Markdown.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarkdownProps = {
  /**
   * Markdown source string — typically from a CMS `content` field.
   * Standard CommonMark syntax is supported: headings, bold, italic,
   * links, lists, blockquotes, and code blocks.
   */
  content: string
  className?: string
}

// ---------------------------------------------------------------------------
// Component overrides
// ---------------------------------------------------------------------------

/**
 * Maps react-markdown's HTML elements to Quadratic Lite atoms where relevant.
 *
 * `a` → Link atom so internal paths use Next.js client navigation and
 *       external URLs open in a new tab with `rel="noopener noreferrer"`.
 *       `node` is excluded to prevent it leaking into the DOM.
 */
const components: Components = {
  a: ({ href, children, node: _node }) => (
    <Link href={href ?? ''} className={clsx(styles.link)}>
      {children}
    </Link>
  ),
  h1: ({ children }) => <Typography variant="h1">{children}</Typography>,
  h2: ({ children }) => <Typography variant="h2">{children}</Typography>,
  h3: ({ children }) => <Typography variant="h3">{children}</Typography>,
  h4: ({ children }) => <Typography variant="h4">{children}</Typography>,
  h5: ({ children }) => <Typography variant="h5">{children}</Typography>,
  h6: ({ children }) => <Typography variant="h6">{children}</Typography>,
  p: ({ children }) => <Typography>{children}</Typography>,
  ul: ({ children }) => <List>{children}</List>,
  ol: ({ children }) => <List as="ol">{children}</List>,
  li: ({ children }) => <ListItem>{children}</ListItem>,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Markdown molecule — renders a CommonMark string as typeset HTML.
 *
 * Anchor elements are routed through the Link atom so internal/external
 * navigation behaviour is consistent across the design system.
 *
 * Typography (headings, body, caption) mirrors the Typography atom's scale;
 * brands override via CSS variables under [data-brand] without touching
 * this file.
 *
 * Usage:
 *   <Markdown content="## Hello\n\nSome **bold** text." />
 */
export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div className={clsx(styles.root, className)}>
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  )
}
