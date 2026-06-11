import type { ContentClientError } from '@amplience/quadratic-content'

import { FailureCard } from './FailureCard'

// ---------------------------------------------------------------------------
// Copy per error kind
// ---------------------------------------------------------------------------

const SUMMARIES: Record<ContentClientError['kind'], string> = {
  network: 'The content service could not be reached, so this content cannot be shown right now.',
  unauthorised:
    'This deployment is not authorised to read this content. Check the delivery credentials.',
  malformed: 'The content service responded, but the response could not be understood.',
  'not-found': 'The requested content does not exist.', // routes normally turn this kind into a 404 instead
  unknown: 'Fetching this content failed for an unexpected reason.',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ContentUnavailable — the page-level loud-failure card for content-fetch
 * errors (QL-37). The three dispatch-failure cards cover "the tree arrived
 * but a node can't render"; this one covers "the tree never arrived".
 *
 * Routes catch `ContentClientError` from the content client and render this
 * in place of the page tree — server-rendered and brand-styled, like every
 * other failure surface. `kind: 'not-found'` should normally become a 404
 * via `notFound()` before reaching here.
 */
export function ContentUnavailableCard({
  error,
  resource,
}: {
  error: ContentClientError
  /** What was being fetched — a delivery key or id, for the diagnostics. */
  resource: string
}) {
  return (
    <FailureCard
      failureClass="ContentUnavailable"
      summary={SUMMARIES[error.kind]}
      schemaUri={resource}
      diagnostics={
        <p style={{ margin: 0 }}>
          Kind: <code>{error.kind}</code> — <code>{error.message}</code>
        </p>
      }
    />
  )
}
