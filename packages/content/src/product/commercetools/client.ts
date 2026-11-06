/**
 * A minimal commercetools HTTP API client — token, GET, paging. Nothing else.
 *
 * Plain `fetch` rather than `@commercetools/platform-sdk`: the adapter makes
 * read-only GETs against four endpoints, and the SDK would bring a middleware
 * stack, a second auth implementation and a large type surface to do it. This
 * package also compiles without DOM or node types (see `config.ts`), so
 * `fetch` is reached through `globalThis` and typed locally — and injectable,
 * which is what lets the tests serve recorded responses without a network.
 *
 * Errors map onto the package's one taxonomy, `ContentClientError`, so a
 * route cannot tell a commercetools failure from a CMS one and doesn't need
 * to: the loud-failure cards (ADR-0010) already discriminate on `kind`.
 */

import { ContentClientError } from '../../types'

/** The slice of the Fetch API this client uses. */
export type FetchLike = (
  url: string,
  init?: {
    readonly method?: string
    readonly headers?: Record<string, string>
    readonly body?: string
  },
) => Promise<{
  readonly ok: boolean
  readonly status: number
  json(): Promise<unknown>
  text(): Promise<string>
}>

export type CommercetoolsClientConfig = {
  readonly projectKey: string
  readonly clientId: string
  readonly clientSecret: string
  /** e.g. `https://api.europe-west1.gcp.commercetools.com` — no project key. */
  readonly apiUrl: string
  /** e.g. `https://auth.europe-west1.gcp.commercetools.com` */
  readonly authUrl: string
  /**
   * Space-separated OAuth scopes. Optional: omitted, the token carries every
   * scope the API client was created with. Supplying it narrows the token,
   * which is worth doing when the client was created with write scopes.
   */
  readonly scopes?: string
  /** Defaults to `globalThis.fetch`. */
  readonly fetch?: FetchLike
}

type Token = { readonly value: string; readonly expiresAt: number }

/** Refresh this long before commercetools says the token expires. */
const EXPIRY_MARGIN_MS = 60_000

/** commercetools' maximum page size for query endpoints. */
export const MAX_PAGE_SIZE = 500

/** commercetools rejects `offset` past this; cursor paging takes over. */
const MAX_OFFSET = 10_000

/** Pages fetched at once — enough to hide latency, few enough to stay polite. */
const PAGE_CONCURRENCY = 4

type Globals = {
  fetch?: FetchLike
  btoa?: (data: string) => string
}
const globals = globalThis as Globals

export type QueryParams = Record<string, string | number | boolean | readonly string[] | undefined>

/** A `PagedQueryResponse` — the envelope every commercetools query returns. */
export type PagedQueryResponse<T> = {
  readonly limit: number
  readonly offset: number
  readonly count: number
  readonly total?: number
  readonly results: readonly T[]
}

export class CommercetoolsClient {
  readonly #config: CommercetoolsClientConfig
  readonly #fetch: FetchLike
  #token: Token | undefined
  #pendingToken: Promise<Token> | undefined

  constructor(config: CommercetoolsClientConfig) {
    const fetchImpl = config.fetch ?? globals.fetch?.bind(globalThis)
    if (!fetchImpl) {
      throw new Error(
        'CommercetoolsClient needs a fetch implementation; none was found on globalThis.',
      )
    }
    this.#config = {
      ...config,
      apiUrl: config.apiUrl.replace(/\/+$/, ''),
      authUrl: config.authUrl.replace(/\/+$/, ''),
    }
    this.#fetch = fetchImpl
  }

  /**
   * GET a project-scoped path (`/product-projections`) and parse the JSON.
   *
   * A 401 is retried once with a fresh token — a token revoked or expired
   * early is the one auth failure that fixes itself — and anything else is
   * mapped straight to a typed error.
   */
  async get<T>(path: string, params: QueryParams = {}): Promise<T> {
    return await this.#request<T>('GET', path, params)
  }

  /** POST a JSON body to a project-scoped path (`/products/search`). */
  async post<T>(path: string, body: unknown, params: QueryParams = {}): Promise<T> {
    return await this.#request<T>('POST', path, params, JSON.stringify(body))
  }

  async #request<T>(
    method: 'GET' | 'POST',
    path: string,
    params: QueryParams,
    body?: string,
  ): Promise<T> {
    const url = `${this.#config.apiUrl}/${encodeURIComponent(this.#config.projectKey)}${path}${toQuery(params)}`

    let response = await this.#send(method, url, await this.#bearer(), body)
    if (response.status === 401) {
      this.#token = undefined
      response = await this.#send(method, url, await this.#bearer(), body)
    }
    if (!response.ok) throw await toError(response, path)
    return (await parseJson(response, path)) as T
  }

  /**
   * Every result of a query endpoint, paged at the maximum size.
   *
   * The first page asks for `total`; the rest are fetched a few at a time in
   * parallel, which is what keeps a 4,000-product sandbox to two round trips
   * rather than nine. Sorted by `id` so pages are stable while paging.
   *
   * commercetools caps offset paging at 10,000 results. Beyond that this
   * switches to cursor paging (`id > last`), which is sequential but has no
   * ceiling.
   */
  async getAll<T extends { readonly id: string }>(
    path: string,
    params: QueryParams = {},
  ): Promise<readonly T[]> {
    const page = (offset: number, withTotal: boolean) =>
      this.get<PagedQueryResponse<T>>(path, {
        sort: 'id asc',
        ...params,
        limit: MAX_PAGE_SIZE,
        offset,
        withTotal,
      })

    const first = await page(0, true)
    const total = first.total ?? first.count
    if (first.count < MAX_PAGE_SIZE || total <= MAX_PAGE_SIZE) return first.results
    // Cursor paging needs `id` order, so it starts again rather than continue
    // from a first page that may have been sorted differently.
    if (total > MAX_OFFSET) return await this.#getAllByCursor(path, params)

    const offsets: number[] = []
    for (let offset = MAX_PAGE_SIZE; offset < total; offset += MAX_PAGE_SIZE) offsets.push(offset)

    const rest: (readonly T[])[] = new Array<readonly T[]>(offsets.length)
    let next = 0
    const worker = async () => {
      while (next < offsets.length) {
        const index = next++
        rest[index] = (await page(offsets[index]!, false)).results
      }
    }
    await Promise.all(Array.from({ length: Math.min(PAGE_CONCURRENCY, offsets.length) }, worker))
    return [...first.results, ...rest.flat()]
  }

  async #getAllByCursor<T extends { readonly id: string }>(
    path: string,
    params: QueryParams,
  ): Promise<readonly T[]> {
    const results: T[] = []
    const where = typeof params.where === 'string' ? params.where : undefined
    for (;;) {
      const last = results[results.length - 1]
      const cursor = last === undefined ? undefined : `id > "${last.id}"`
      const clauses = [where && `(${where})`, cursor].filter(Boolean).join(' and ')
      const { results: page } = await this.get<PagedQueryResponse<T>>(path, {
        ...params,
        sort: 'id asc',
        ...(clauses ? { where: clauses } : {}),
        limit: MAX_PAGE_SIZE,
        withTotal: false,
      })
      results.push(...page)
      if (page.length < MAX_PAGE_SIZE) return results
    }
  }

  async #send(method: 'GET' | 'POST', url: string, bearer: string, body?: string) {
    try {
      return await this.#fetch(url, {
        method,
        headers: {
          Authorization: bearer,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body }),
      })
    } catch (cause) {
      throw new ContentClientError('network', `commercetools request failed: ${url}`, cause)
    }
  }

  async #bearer(): Promise<string> {
    const now = Date.now()
    if (this.#token && this.#token.expiresAt > now) return `Bearer ${this.#token.value}`

    // One in-flight token request shared by concurrent callers, so a page that
    // fans out several reads on a cold start doesn't mint several tokens.
    this.#pendingToken ??= this.#requestToken().finally(() => {
      this.#pendingToken = undefined
    })
    this.#token = await this.#pendingToken
    return `Bearer ${this.#token.value}`
  }

  /** The client-credentials flow — the same grant Quadratic 1.0 uses. */
  async #requestToken(): Promise<Token> {
    const { authUrl, clientId, clientSecret, scopes } = this.#config
    const body = encodePairs([
      ['grant_type', 'client_credentials'],
      ...(scopes ? ([['scope', scopes]] as const) : []),
    ])

    const encode = globals.btoa
    if (!encode) throw new Error('CommercetoolsClient needs btoa; none was found on globalThis.')

    let response
    try {
      response = await this.#fetch(`${authUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${encode(`${clientId}:${clientSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body,
      })
    } catch (cause) {
      throw new ContentClientError('network', 'commercetools token request failed', cause)
    }

    if (!response.ok) {
      // 400 is what the auth API returns for bad client credentials, so it is
      // an auth failure here, not a malformed request.
      const kind = response.status === 400 || response.status === 401 ? 'unauthorised' : 'unknown'
      // The auth API's own reason (`invalid_client`, `invalid_scope`, …) is
      // what tells a revoked client apart from a wrong region or scope.
      const detail = await response.text().catch(() => '')
      throw new ContentClientError(
        kind,
        `commercetools token request for client ${clientId.slice(0, 4)}… to ${authUrl} was refused (${response.status})` +
          `${detail ? `: ${detail.slice(0, 300)}` : ''}. Check CTP_CLIENT_ID, CTP_CLIENT_SECRET and CTP_AUTH_URL.`,
      )
    }

    const data = (await parseJson(response, '/oauth/token')) as {
      access_token?: unknown
      expires_in?: unknown
    }
    if (typeof data.access_token !== 'string' || typeof data.expires_in !== 'number') {
      throw new ContentClientError('malformed', 'commercetools token response had no access_token.')
    }
    // `expires_in` is seconds (48h by default).
    return {
      value: data.access_token,
      expiresAt: Date.now() + Math.max(0, data.expires_in * 1000 - EXPIRY_MARGIN_MS),
    }
  }
}

/**
 * `a=1&b=2`, percent-encoded. Hand-rolled because `URLSearchParams` is a
 * DOM/node global and this package compiles against ES2022 alone.
 */
const encodePairs = (pairs: readonly (readonly [string, string])[]): string =>
  pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')

/** Query string, with repeated keys for array values (`expand=a&expand=b`). */
export const toQuery = (params: QueryParams): string => {
  const pairs: (readonly [string, string])[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    if (Array.isArray(value)) for (const v of value as readonly string[]) pairs.push([key, v])
    else pairs.push([key, String(value)])
  }
  return pairs.length > 0 ? `?${encodePairs(pairs)}` : ''
}

const parseJson = async (
  response: { json(): Promise<unknown> },
  path: string,
): Promise<unknown> => {
  try {
    return await response.json()
  } catch (cause) {
    throw new ContentClientError('malformed', `commercetools returned non-JSON for ${path}`, cause)
  }
}

const toError = async (
  response: { status: number; text(): Promise<string> },
  path: string,
): Promise<ContentClientError> => {
  const detail = await response.text().catch(() => '')
  const message = `commercetools ${path} → ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`
  if (response.status === 401 || response.status === 403) {
    return new ContentClientError('unauthorised', message)
  }
  if (response.status === 404) return new ContentClientError('not-found', message)
  if (response.status === 400) return new ContentClientError('malformed', message)
  return new ContentClientError(response.status >= 500 ? 'network' : 'unknown', message)
}
