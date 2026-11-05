/**
 * The deployment's product source (ADR-0018) — composed once, here.
 *
 * Mirrors `content-client.ts`: the environment names a source, this module
 * constructs it, and every product route shares the one instance. Choosing an
 * implementation is a composition act, like the registry (ADR-0010) and the
 * content client (ADR-0008) — the routes above it only ever see the
 * `ProductSource` port.
 *
 * Module-level construction is deliberate. The source is stateless over
 * immutable config, and an unrecognised `PRODUCT_SOURCE` throws at boot —
 * loud at composition time rather than a failure card on every product page.
 * There is no silent fallback: a typo in a future PIM deployment must not
 * degrade to an empty CMS catalogue that looks like "no products published".
 *
 * `CmsProductSource` composes over the active `ContentClient`, so it inherits
 * the mock/SDK ladder for free: a fresh clone with no `.env` serves products
 * from fixtures, and a configured hub serves them from Amplience, with no
 * change here.
 *
 * `commercetools` reads its own `CTP_*` variables, and only when chosen — a
 * CMS deployment never needs them. Missing credentials throw at boot, for the
 * same reason an unknown source name does.
 */

import type { ProductSource } from '@amplience/frontend-starter-content'
import { CmsProductSource } from '@amplience/frontend-starter-content/product'
import { makeCommercetoolsProductSource } from '@amplience/frontend-starter-content/product/commercetools'

import { client, siteName } from './content-client'

/** Sources this deployment knows how to build. */
const SOURCES = ['cms', 'commercetools'] as const

type SourceName = (typeof SOURCES)[number]

const isSourceName = (value: string): value is SourceName => SOURCES.some((name) => name === value)

/**
 * Resolve `PRODUCT_SOURCE`, defaulting to the one that always works.
 *
 * Unset means `cms`, which needs no credentials of its own — that is what
 * keeps products working on a clone. Anything unrecognised is a
 * configuration error, not a preference.
 */
const resolveSourceName = (raw: string | undefined): SourceName => {
  const value = raw?.trim().toLowerCase()
  if (value === undefined || value === '') return 'cms'
  if (!isSourceName(value)) {
    throw new Error(
      `PRODUCT_SOURCE="${value}" is not a known product source. ` +
        `Expected one of: ${SOURCES.join(', ')}.`,
    )
  }
  return value
}

export const productSourceName: SourceName = resolveSourceName(process.env.PRODUCT_SOURCE)

const buildSource = (name: SourceName): ProductSource => {
  switch (name) {
    case 'commercetools':
      return makeCommercetoolsProductSource()
    case 'cms':
      return new CmsProductSource({ client, siteName })
  }
}

export const productSource: ProductSource = buildSource(productSourceName)

/** Exported for the unit test — the resolution rule, without the module singleton. */
export { resolveSourceName }
