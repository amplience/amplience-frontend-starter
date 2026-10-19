// Reading a hub's content flows out of Workforce (ADR-0023, QL-127).
//
// The Flows tab is a grid: one row per flow fixture in the repository, one
// column per hub. This module owns the hub half — what a hub currently has —
// and nothing about fixtures or cells, which belong to the browser.
//
// Three things make this more than a fetch:
//
//   1. `contentFlows` is a Relay connection and the API caps a page at 50,
//      *refusing* rather than clamping a larger `first`. So it pages, and the
//      page size is a constant rather than an optimistic 100.
//   2. A hub whose organization has no personal access token is not an error.
//      It is a setup step that has not happened, and it has to read as an
//      invitation rather than a red cross — the same distinction
//      `workforce-permissions.ts` draws between `not-configured` and `denied`.
//   3. Labels are not unique. Two flows on one hub can share a label, and the
//      grid has to say so rather than silently picking the first.
//
// Pure apart from the injected `GqlFetch`, so pagination, auth failure and the
// duplicate case are all testable without a hub or a token.

import { deepGet, gqlErrors, isAuthError, nodes, type GqlFetch } from './graphql.ts'

/**
 * ⚠️ The API refuses `first` above 50 rather than clamping it — a 100 here is
 * not a slow query, it is a failed one. Matches `PAGE_SIZE` in
 * `packages/hub-management/scripts/lib/workforce-api.mjs`; change both.
 */
export const PAGE_SIZE = 50

/**
 * A hard ceiling on pages, so a cursor that never advances cannot spin the
 * server forever. 50 pages is 2,500 flows — far past anything real, which is
 * the point: reaching it means the API is misbehaving, not that a hub is busy.
 */
export const MAX_PAGES = 50

/**
 * Confirmed against the schema on 17 Oct 2026, not assumed: `ContentFlow` has
 * `lastRunDate: DateTime` (nullable — a flow that has never run), alongside
 * `status: ContentFlowStatus!` and `updatedDate: DateTime!`.
 *
 * Worth having checked: an unknown field here would not degrade, it would fail
 * the whole query against every hub at once.
 */
export const FLOWS_QUERY = `query flows($hubId: ID!, $first: Int!, $after: String) {
  cmsHub(id: $hubId) {
    contentFlows(first: $first, after: $after) {
      edges { node { id label status updatedDate lastRunDate } }
      pageInfo { hasNextPage endCursor }
    }
  }
}`

/** One flow as the list query reports it. */
export type HubFlow = {
  id: string
  label: string
  /**
   * `ENABLED | DISABLED | QUARANTINED`, left as a string here. The grid maps
   * it; widening the type to the enum would make an unexpected fourth value a
   * parse failure rather than something to render honestly.
   */
  status?: string
  updatedDate?: string
  /** Null until the flow has run at least once — "never" is a real answer. */
  lastRunDate?: string
}

/** Why a hub's flows could not be read. Never conflated with "it has none". */
export type FlowsFailure =
  /** No personal access token for this hub's organization — a setup step. */
  | { reason: 'no-token' }
  /** A token exists and was refused. */
  | { reason: 'denied'; detail: string }
  /** Anything else: network, a 500, a malformed body. */
  | { reason: 'error'; detail: string }

export type HubFlowsResult = { ok: true; flows: HubFlow[] } | ({ ok: false } & FlowsFailure)

/** One page, flattened. `endCursor` is undefined when there is no next page. */
export type FlowPage = { flows: HubFlow[]; hasNextPage: boolean; endCursor?: string }

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

/**
 * The flows and the cursor out of one response body.
 *
 * A node with no id or no label is dropped rather than rendered as a blank
 * row: the grid matches on the label, so a flow without one cannot be matched
 * to anything and would only ever show as a cell nobody can explain.
 */
export function flowPageIn(body: unknown): FlowPage {
  const connection = deepGet(body, ['data', 'cmsHub', 'contentFlows'])
  const flows: HubFlow[] = []

  for (const node of nodes(connection)) {
    const id = str(deepGet(node, ['id']))
    const label = str(deepGet(node, ['label']))
    if (id === undefined || label === undefined) continue
    const status = str(deepGet(node, ['status']))
    const updatedDate = str(deepGet(node, ['updatedDate']))
    const lastRunDate = str(deepGet(node, ['lastRunDate']))
    flows.push({
      id,
      label,
      ...(status === undefined ? {} : { status }),
      ...(updatedDate === undefined ? {} : { updatedDate }),
      ...(lastRunDate === undefined ? {} : { lastRunDate }),
    })
  }

  const hasNextPage = deepGet(connection, ['pageInfo', 'hasNextPage']) === true
  const endCursor = str(deepGet(connection, ['pageInfo', 'endCursor']))
  return {
    flows,
    hasNextPage,
    ...(endCursor === undefined ? {} : { endCursor }),
  }
}

/**
 * Every flow on one hub, following the cursor to the end.
 *
 * `gql` is undefined when the organization has no token. That is reported as
 * `no-token` without a request being made — asking anyway would produce a
 * denial, and a denial is what a *wrong* token looks like.
 *
 * ⚠️ Stops when `hasNextPage` is false **or** the cursor repeats. A connection
 * that reports another page while handing back the same cursor is a server bug
 * we cannot fix from here, but it must not become an infinite loop in a panel
 * that fans out across fourteen hubs at once.
 */
export async function readHubFlows(
  gql: GqlFetch | undefined,
  hubId: string,
): Promise<HubFlowsResult> {
  if (gql === undefined) return { ok: false, reason: 'no-token' }

  const flows: HubFlow[] = []
  const seenCursors = new Set<string>()
  let after: string | undefined

  for (let page = 0; page < MAX_PAGES; page += 1) {
    let result
    try {
      result = await gql(FLOWS_QUERY, {
        hubId,
        first: PAGE_SIZE,
        ...(after === undefined ? {} : { after }),
      })
    } catch (error) {
      return { ok: false, reason: 'error', detail: messageOf(error) }
    }

    const errors = gqlErrors(result.body)
    if (isAuthError(errors)) {
      return {
        ok: false,
        reason: 'denied',
        detail: errors?.[0]?.message ?? 'the token was refused',
      }
    }
    if (errors !== undefined) {
      return { ok: false, reason: 'error', detail: errors[0]?.message ?? 'the query was refused' }
    }
    if (result.status >= 400) {
      return { ok: false, reason: 'error', detail: `HTTP ${result.status}` }
    }

    const { flows: pageFlows, hasNextPage, endCursor } = flowPageIn(result.body)
    flows.push(...pageFlows)

    if (!hasNextPage || endCursor === undefined || seenCursors.has(endCursor)) {
      return { ok: true, flows }
    }
    seenCursors.add(endCursor)
    after = endCursor
  }

  // Deliberately a success: the hub really does have these flows, and a grid
  // that renders 2,500 of them is more useful than one that renders an error.
  return { ok: true, flows }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
