/**
 * Structured console emission for renderer failures (ADR-0010 §8).
 *
 * Dev-verbose, prod-redacted:
 *  - development — full failure payload, the offending content node, and a
 *    "did you mean" suggestion against the registered schema URIs.
 *  - production  — schema URI, failure class, registered URI list, and the
 *    validation reason. No content values, no error objects, no stack
 *    traces, no framework internals. Sufficient for monitoring;
 *    insufficient for reconnaissance.
 *
 * The environment switch is evaluated at module load, not per-render.
 */

import type { RendererFailure, SchemaURI } from '@amplience/quadratic-types'

const isDev = process.env.NODE_ENV === 'development'

/**
 * Suggest the registered schema URI closest to `uri`, judged by longest
 * common prefix — schema URIs in one hub share long prefixes, so a typo in
 * the tail still matches most of the string. Deliberately regex-free
 * (Sprint 5 carries a ReDoS-safety requirement) and linear.
 */
const didYouMean = (uri: string, registered: readonly SchemaURI[]): string | undefined => {
  const commonPrefixLength = (a: string, b: string): number => {
    const max = Math.min(a.length, b.length)
    let i = 0
    while (i < max && a[i] === b[i]) i += 1
    return i
  }

  let best: string | undefined
  let bestScore = 0
  for (const candidate of registered) {
    const score = commonPrefixLength(uri, candidate)
    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  }

  // Require a meaningful overlap — a shared protocol prefix alone ("https://")
  // says nothing. Half the candidate's length is a practical bar.
  return best !== undefined && bestScore >= best.length / 2 ? best : undefined
}

/**
 * Emit one renderer failure to the console. `content` is the offending node;
 * it is logged in development only.
 */
export function emitRendererFailure(failure: RendererFailure, content?: unknown): void {
  if (isDev) {
    const suggestion =
      failure.failureClass === 'SchemaUnknown'
        ? didYouMean(failure.schemaUri, failure.registeredSchemas)
        : undefined

    console.error(
      `[renderer] ${failure.failureClass} — ${failure.schemaUri}`,
      suggestion === undefined ? '' : `(did you mean "${suggestion}"?)`,
      { failure, content },
    )
    return
  }

  // Production: names and classes only — never content values or stacks.
  console.error('[renderer]', {
    failureClass: failure.failureClass,
    schemaUri: failure.schemaUri,
    ...(failure.failureClass === 'SchemaUnknown' && {
      registeredSchemas: failure.registeredSchemas,
    }),
    ...(failure.failureClass === 'PropsValidationFailure' && { reason: failure.reason }),
  })
}
