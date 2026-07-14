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
  /**
   * Active locale URL prefix (ADR-0015), supplied by the renderer. Passed to
   * the Link atom for every inline markdown link, so links written in body
   * copy stay inside the current locale — the reason link localization lives
   * in Link rather than at the field boundary (markdown links aren't fields).
   * Defaults to '' (default locale — links unprefixed).
   */
  localeBasePath?: string
  className?: string
}

// ---------------------------------------------------------------------------
// Component overrides
// ---------------------------------------------------------------------------

/**
 * Non-link element overrides — locale-independent, so they're built once.
 */
const baseComponents: Components = {
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

/**
 * Build the element map for a given locale. `a` → Link atom so internal paths
 * use Next.js client navigation (localized to `localeBasePath`) and external
 * URLs open in a new tab with `rel="noopener noreferrer"`. `node` is excluded
 * to prevent it leaking into the DOM.
 */
const makeComponents = (localeBasePath: string): Components => ({
  ...baseComponents,
  a: ({ href, children, node: _node }) => (
    <Link href={href ?? ''} localeBasePath={localeBasePath} className={clsx(styles.link)}>
      {children}
    </Link>
  ),
})

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
export function Markdown({ content, localeBasePath = '', className }: MarkdownProps) {
  return (
    <div className={clsx(styles.root, className)}>
      <ReactMarkdown components={makeComponents(localeBasePath)}>{content}</ReactMarkdown>
    </div>
  )
}
