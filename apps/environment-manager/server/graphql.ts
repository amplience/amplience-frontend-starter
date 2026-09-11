// Shared client for Amplience's GraphQL API (https://api.amplience.net/graphql).
//
// Two separate products live behind this one endpoint and the same OAuth
// client-credentials token: Content Hub's Asset Management API
// (`dam-permissions.ts`) and Workforce (`workforce-permissions.ts`). The
// transport and error handling are identical for both, so they live here.

export const GRAPHQL_API = 'https://api.amplience.net/graphql'

export type GqlResult = { status: number; body: unknown }

/**
 * Minimal GraphQL fetch: POST a query with auth already applied. `variables`
 * is optional so probes can pass operands as variables rather than
 * interpolating them into the query text.
 */
export type GqlFetch = (query: string, variables?: Record<string, unknown>) => Promise<GqlResult>

export type GqlError = { message: string; code?: string }

/** Pull the `errors` array out of a GraphQL response body, if present. */
export function gqlErrors(body: unknown): GqlError[] | undefined {
  if (typeof body !== 'object' || body === null || !('errors' in body)) return undefined
  const errors = body.errors
  if (!Array.isArray(errors) || errors.length === 0) return undefined
  return errors.map((e): GqlError => {
    if (typeof e !== 'object' || e === null) return { message: String(e) }
    const message = 'message' in e ? String((e as { message: unknown }).message) : 'Unknown error'
    const code = extensionValue(e, 'code')
    return code === undefined ? { message } : { message, code }
  })
}

/**
 * Read a string field out of a GraphQL error's `extensions` object. Only
 * primitives are returned — an object-valued field has no useful string form,
 * and stringifying one would put "[object Object]" in front of an operator.
 */
export function extensionValue(error: unknown, field: string): string | undefined {
  const value = deepGet(error, ['extensions', field])
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

const AUTH_CODES = new Set(['FORBIDDEN', 'UNAUTHORIZED', 'UNAUTHENTICATED', 'ACCESS_DENIED'])

/**
 * True when a GraphQL error looks like a permission/authorization failure.
 * The gateway reports a missing grant as HTTP 200 with an error whose message
 * is `Request failed with status code: "403"` — no error `code` and no auth
 * wording — so a bare 401/403 in the message counts too.
 */
export function isAuthError(errors: GqlError[] | undefined): boolean {
  if (errors === undefined) return false
  return errors.some(
    (e) =>
      (e.code !== undefined && AUTH_CODES.has(e.code.toUpperCase())) ||
      /forbidden|unauthori[sz]ed|not permitted|access denied|permission|status code[:\s"]*40[13]/i.test(
        e.message,
      ),
  )
}

/** Safe nested property read over unknown JSON. */
export function deepGet(value: unknown, path: string[]): unknown {
  let cur = value
  for (const key of path) {
    if (typeof cur !== 'object' || cur === null || !(key in cur)) return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

/** Flatten a Relay-style `{ edges: [{ node }] }` connection into its nodes. */
export function nodes(connection: unknown): unknown[] {
  const edges = deepGet(connection, ['edges'])
  if (!Array.isArray(edges)) return []
  return edges.map((edge) => deepGet(edge, ['node'])).filter((node) => node !== undefined)
}

/** Build a `GqlFetch` bound to a bearer token for the live GraphQL endpoint. */
export function liveGqlFetch(token: string): GqlFetch {
  return async (query, variables) => {
    const res = await fetch(GRAPHQL_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(variables === undefined ? { query } : { query, variables }),
    })
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    return { status: res.status, body }
  }
}
