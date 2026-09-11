/**
 * @amplience/frontend-starter-content — public surface.
 *
 * The port and shared types live here; concrete implementations live under
 * subpaths (`./mock` and, since QL-43, `./sdk`). `resolveContentConfig` is
 * the one place environment becomes client configuration — compositions
 * pick an implementation from its result.
 */

export { FIXTURE_SITE_NAME, resolveContentConfig } from './config'
export type { ContentClientSelection } from './config'
export { resolveLocalized } from './localized'
export type { ContentClient } from './port'
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
