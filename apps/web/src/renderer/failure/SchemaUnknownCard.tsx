import type { SchemaUnknownFailure } from '@amplience/quadratic-types'

import { FailureCard } from './FailureCard'

/**
 * SchemaUnknown — the content references a schema URI the registry doesn't
 * know (ADR-0010 §6). Usually a content-modelling bug, or an unresolved
 * content-link stub when the tree was fetched without `depth: 'all'` (the
 * dispatcher passes a `hint` in that case).
 */
export function SchemaUnknownCard({ failure }: { failure: SchemaUnknownFailure }) {
  return (
    <FailureCard
      failureClass="SchemaUnknown"
      summary={failure.hint ?? 'This content type is not a schema this site knows how to render.'}
      schemaUri={failure.schemaUri}
      diagnostics={
        <>
          <p style={{ margin: 0 }}>Registered schemas:</p>
          <ul style={{ margin: 0 }}>
            {failure.registeredSchemas.map((uri) => (
              <li key={uri}>{uri}</li>
            ))}
          </ul>
        </>
      }
    />
  )
}
