/**
 * @amplience/quadratic-content — public surface.
 *
 * The port and shared types live here; concrete implementations live under
 * subpaths (`./mock` today, `./sdk` once QL-43 lands).
 */

export type { ContentClient } from './port'
export { CONTENT_LINK_SCHEMA, ContentClientError, isContentLink } from './types'
export type {
  ContentBody,
  ContentClientErrorKind,
  ContentItem,
  ContentLink,
  ContentMeta,
  ContentRequestOptions,
  EnrichedContentItem,
} from './types'
