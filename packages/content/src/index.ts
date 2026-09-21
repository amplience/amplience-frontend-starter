/**
 * @amplience/frontend-starter-content — public surface.
 *
 * Two ports live here — `ContentClient` (ADR-0008) and `ProductSource`
 * (ADR-0018) — with their shared types; concrete implementations live under
 * subpaths (`./mock` and, since QL-43, `./sdk`). `resolveContentConfig` is
 * the one place environment becomes client configuration — compositions
 * pick an implementation from its result.
 */

export { FIXTURE_SITE_NAME, resolveContentConfig } from './config'
export type { ContentClientSelection } from './config'
export { resolveLocalized } from './localized'
export type { ContentClient } from './port'
export type { ProductSource } from './product-port'
export { NO_CAPABILITIES } from './product-types'
export type {
  Product,
  ProductAttribute,
  ProductImage,
  ProductListOptions,
  ProductListResult,
  ProductPrice,
  ProductStatus,
  SourceCapabilities,
} from './product-types'
export {
  CONTENT_LINK_SCHEMA,
  ContentClientError,
  IMAGE_LINK_SCHEMA,
  isContentClientError,
  isContentLink,
  isMediaImageLink,
  mediaImageUrl,
} from './types'
export type {
  ContentBody,
  ContentClientErrorKind,
  ContentItem,
  ContentLink,
  ContentMeta,
  ContentRequestOptions,
  EnrichedContentItem,
  MediaImageLink,
} from './types'
