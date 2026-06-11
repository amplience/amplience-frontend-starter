import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PageProps = {
  /** The page's rendered slots, in content order. */
  children?: ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Page template — the rendered form of an Amplience page content item.
 *
 * A page is an ordered list of slots; this template renders them in content
 * order inside a single `<main>` landmark. Page-level fields beyond `slots`
 * (title, description) are metadata-level concerns — they feed `<head>` /
 * SEO generation when that lands, not visible page chrome, so the template
 * deliberately doesn't accept them.
 *
 * The page's slots arrive already rendered (as ReactNode) — recursion into
 * the content tree is the renderer's job, not this component's.
 *
 * Usage (via the renderer):
 *   <Page>{renderedSlots}</Page>
 */
export function Page({ children }: PageProps) {
  return <main data-page>{children}</main>
}
