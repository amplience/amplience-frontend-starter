import type { PropsValidationFailure } from '@amplience/quadratic-types'

import { FailureCard } from './FailureCard'

/**
 * PropsValidationFailure — the entry's `validate` predicate rejected the
 * content, or its adapter (`propsFromSchema` / `getChildren`) threw while
 * mapping it (ADR-0010 §6).
 */
export function PropsValidationFailureCard({ failure }: { failure: PropsValidationFailure }) {
  return (
    <FailureCard
      failureClass="PropsValidationFailure"
      summary={
        failure.reason === 'validate-returned-false'
          ? 'This component is registered, but the content did not match the shape it expects.'
          : 'This component is registered, but its content adapter threw while mapping the content.'
      }
      schemaUri={failure.schemaUri}
      diagnostics={
        <p style={{ margin: 0 }}>
          Reason: <code>{failure.reason}</code>
          {failure.error instanceof Error && (
            <>
              {' — '}
              <code>{failure.error.message}</code>
            </>
          )}
        </p>
      }
    />
  )
}
