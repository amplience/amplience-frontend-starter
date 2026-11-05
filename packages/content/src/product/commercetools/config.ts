/**
 * Environment → `CommercetoolsProductSource` — the adapter's one env read.
 *
 * Kept beside the adapter rather than in the package's `config.ts`, because
 * it only runs when a deployment has chosen `PRODUCT_SOURCE=commercetools`:
 * a CMS-only deployment must not need, or be told about, any CTP_ variable.
 *
 * Names follow commercetools' own `CTP_` convention (their SDKs, CLI and
 * sample apps), so a Merchant Center "environment variables" download pastes
 * in as-is — and they cannot collide with Quadratic 1.0's `CT_` exports.
 * The region default matches 1.0. Missing credentials throw at boot, listing
 * every missing name at once.
 */

import { CommercetoolsClient } from './client'
import type { FetchLike } from './client'
import type { CommercetoolsProductSourceOptions } from './CommercetoolsProductSource'
import { CommercetoolsProductSource } from './CommercetoolsProductSource'

type Env = Record<string, string | undefined>

const globals = globalThis as { process?: { env?: Env } }

/** Quadratic 1.0's region, so its credentials work with no extra config. */
const DEFAULT_REGION = 'europe-west1.gcp'

const REQUIRED = ['CTP_PROJECT_KEY', 'CTP_CLIENT_ID', 'CTP_CLIENT_SECRET'] as const

export type CommercetoolsEnvConfig = {
  readonly projectKey: string
  readonly clientId: string
  readonly clientSecret: string
  readonly apiUrl: string
  readonly authUrl: string
  readonly scopes?: string
  readonly slugLocale?: string
  readonly priceCountry?: string
  readonly brandAttributes?: readonly string[]
  readonly shortDescriptionAttribute?: string
  readonly cacheTtlMs?: number
}

const value = (env: Env, name: string): string | undefined => {
  const v = env[name]?.trim()
  return v === undefined || v === '' ? undefined : v
}

export const resolveCommercetoolsConfig = (
  env: Env = globals.process?.env ?? {},
): CommercetoolsEnvConfig => {
  const projectKey = value(env, 'CTP_PROJECT_KEY')
  const clientId = value(env, 'CTP_CLIENT_ID')
  const clientSecret = value(env, 'CTP_CLIENT_SECRET')
  if (projectKey === undefined || clientId === undefined || clientSecret === undefined) {
    const missing = REQUIRED.filter((name) => value(env, name) === undefined)
    throw new Error(
      `PRODUCT_SOURCE=commercetools needs ${missing.join(', ')}. ` +
        `See the commercetools section of apps/web/.env.example.`,
    )
  }

  const region = value(env, 'CTP_REGION') ?? DEFAULT_REGION
  const ttlSeconds = value(env, 'CTP_CACHE_TTL_SECONDS')
  const ttl = ttlSeconds === undefined ? undefined : Number(ttlSeconds)
  if (ttl !== undefined && (!Number.isFinite(ttl) || ttl < 0)) {
    throw new Error(`CTP_CACHE_TTL_SECONDS="${ttlSeconds}" is not a non-negative number.`)
  }
  const brands = value(env, 'CTP_BRAND_ATTRIBUTES')
    ?.split(',')
    .map((b) => b.trim())
    .filter((b) => b.length > 0)

  const optional = {
    scopes: value(env, 'CTP_SCOPES'),
    slugLocale: value(env, 'CTP_SLUG_LOCALE'),
    priceCountry: value(env, 'CTP_PRICE_COUNTRY'),
    brandAttributes: brands && brands.length > 0 ? brands : undefined,
    shortDescriptionAttribute: value(env, 'CTP_SHORT_DESCRIPTION_ATTRIBUTE'),
    cacheTtlMs: ttl === undefined ? undefined : ttl * 1000,
  }

  return {
    projectKey,
    clientId,
    clientSecret,
    apiUrl: value(env, 'CTP_API_URL') ?? `https://api.${region}.commercetools.com`,
    authUrl: value(env, 'CTP_AUTH_URL') ?? `https://auth.${region}.commercetools.com`,
    // exactOptionalPropertyTypes: drop the unset ones rather than spread undefined.
    ...(Object.fromEntries(
      Object.entries(optional).filter(([, v]) => v !== undefined),
    ) as Partial<CommercetoolsEnvConfig>),
  }
}

/** Build the source from a resolved config. `fetch` is injectable for tests. */
export const makeCommercetoolsProductSource = (
  config: CommercetoolsEnvConfig = resolveCommercetoolsConfig(),
  fetch?: FetchLike,
): CommercetoolsProductSource => {
  const {
    slugLocale,
    priceCountry,
    brandAttributes,
    shortDescriptionAttribute,
    cacheTtlMs,
    ...clientConfig
  } = config
  const client = new CommercetoolsClient({ ...clientConfig, ...(fetch ? { fetch } : {}) })
  const options: CommercetoolsProductSourceOptions = {
    client,
    ...(slugLocale ? { slugLocale } : {}),
    ...(priceCountry ? { priceCountry } : {}),
    ...(brandAttributes ? { brandAttributes } : {}),
    ...(shortDescriptionAttribute ? { shortDescriptionAttribute } : {}),
    ...(cacheTtlMs !== undefined ? { cacheTtlMs } : {}),
  }
  return new CommercetoolsProductSource(options)
}
