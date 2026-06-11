import type { ComponentUnregisteredFailure } from '@amplience/quadratic-types'

import { FailureCard } from './FailureCard'

/**
 * ComponentUnregistered — the schema URI is in the registry but the entry
 * carries no component (ADR-0010 §6). A registration-time bug in the
 * deployment's registry composition; rare.
 */
export function ComponentUnregisteredCard({ failure }: { failure: ComponentUnregisteredFailure }) {
  return (
    <FailureCard
      failureClass="ComponentUnregistered"
      summary="This schema is known, but no component is registered against it in this deployment."
      schemaUri={failure.schemaUri}
      diagnostics={
        <p style={{ margin: 0 }}>
          The registry entry for this schema URI has no <code>component</code>. Check the
          deployment&apos;s registry composition (lib/registry.ts).
        </p>
      }
    />
  )
}
