import clsx from 'clsx'

import { Container } from '../../atoms/Container/Container'
import type { ContainerProps } from '../../atoms/Container/Container'
import { Link } from '../../atoms/Link/Link'
import { Markdown } from '../../molecules/Markdown/Markdown'
import styles from './AnnouncementBar.module.css'
import { DismissButton, DismissibleAnnouncement, fingerprint } from './AnnouncementBarDismiss'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnnouncementBarColorToken =
  'primary' | 'secondary' | 'tertiary' | 'light' | 'dark' | 'black' | 'white'

export type AnnouncementBarProps = {
  /**
   * The announcement — a line of markdown. Bold, italics and inline links
   * render; block elements (headings, paragraphs, lists) are flattened onto
   * the one line.
   */
  message: string
  /**
   * Optional destination for the whole bar. Implemented as a "stretched"
   * link (its hit area covers the bar), so inline links in the message and
   * the dismiss button keep working on top of it.
   */
  href?: string
  /**
   * Optional visible link text shown after the message ("Shop now"). Without
   * it the bar link is announced by the message itself.
   */
  linkLabel?: string
  /** Show a close button; the dismissal is remembered in the visitor's browser. */
  dismissible?: boolean
  /** Background colour from the design-token palette. Defaults to 'black'. */
  backgroundColor?: AnnouncementBarColorToken
  /** Text colour override. Defaults to the background's contrast colour. */
  textColor?: AnnouncementBarColorToken
  /** Defaults to 'center'. */
  textAlign?: 'left' | 'center' | 'right'
  /** Width of the message area — the background always spans the page. Defaults to 'wide'. */
  maxWidth?: ContainerProps['maxWidth']
  /**
   * Stable identifier for the announcement — the content item's delivery id,
   * supplied by the registry adapter. Keys the dismissal in storage; when
   * absent the message itself is used.
   */
  id?: string
  /** Accessible name of the landmark. Defaults to 'Announcement'. */
  ariaLabel?: string
  /** Accessible label of the close button. Defaults to 'Dismiss announcement'. */
  dismissLabel?: string
  /** Active locale URL prefix (ADR-0015), supplied by the renderer. */
  localeBasePath?: string
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AnnouncementBar organism — a slim, full-width notification banner for the
 * header (as one of its rows) or the top of a slot.
 *
 * Server-rendered; only the optional dismiss behaviour is client code
 * (AnnouncementBarDismiss), so a non-dismissible bar ships no JavaScript.
 *
 * Usage:
 *   <AnnouncementBar message="Free delivery on orders over £50" />
 *   <AnnouncementBar message="**Extra 20% off** the sale" href="/sale" linkLabel="Shop now" />
 *   <AnnouncementBar message="Stores close at 4pm today" dismissible id="store-hours" />
 */
export function AnnouncementBar({
  message,
  href,
  linkLabel,
  dismissible = false,
  backgroundColor = 'black',
  textColor,
  textAlign = 'center',
  maxWidth = 'wide',
  id,
  ariaLabel = 'Announcement',
  dismissLabel,
  localeBasePath,
  className,
}: AnnouncementBarProps) {
  const hasLink = href !== undefined && href !== ''
  const label = linkLabel?.trim() ? linkLabel : undefined
  const storageId = id ?? fingerprint(message)
  // Names the stretched link when it has no text of its own.
  const messageId = `announcement-${storageId}`
  const localeProps = localeBasePath !== undefined ? { localeBasePath } : {}

  const bar = (
    <section
      className={clsx('AnnouncementBar', styles.root, className)}
      aria-label={ariaLabel}
      data-background-color={backgroundColor}
      data-text-color={textColor}
      data-text-align={textAlign}
      data-linked={hasLink || undefined}
      data-dismissible={dismissible || undefined}
    >
      <Container className={styles.container ?? ''} maxWidth={maxWidth} gutter>
        <div className={styles.message} id={messageId}>
          <Markdown content={message} {...localeProps} />
        </div>
        {hasLink && (
          <Link
            href={href}
            className={styles.link ?? ''}
            {...(label === undefined && { 'aria-labelledby': messageId })}
            {...localeProps}
          >
            {label}
          </Link>
        )}
        {dismissible && (
          <DismissButton
            className={styles.dismiss ?? ''}
            {...(dismissLabel !== undefined && { label: dismissLabel })}
          />
        )}
      </Container>
    </section>
  )

  if (!dismissible) return bar
  return (
    <DismissibleAnnouncement storageId={storageId} message={message}>
      {bar}
    </DismissibleAnnouncement>
  )
}
