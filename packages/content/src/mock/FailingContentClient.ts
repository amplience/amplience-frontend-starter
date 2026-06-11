/**
 * A ContentClient that always fails — the test double for the renderer's
 * content-fetch failure paths (QL-37).
 *
 * Delivery failures surface as typed `ContentClientError`s regardless of
 * adapter (ADR-0008), so route-level failure handling can be exercised per
 * error kind without an SDK, a hub, or a network. The SDK adapter (QL-43)
 * maps real transport errors onto the same kinds; nothing downstream
 * changes.
 */

import type { ContentClient } from '../port'
import type { ContentClientErrorKind, ContentItem, ContentRequestOptions } from '../types'
import { ContentClientError } from '../types'

/**
 * Build a client whose every read rejects with a `ContentClientError` of the
 * given kind. The message defaults to a kind-appropriate stand-in for what a
 * real adapter would report.
 */
export const makeFailingContentClient = (
  kind: ContentClientErrorKind,
  message?: string,
): ContentClient => {
  const defaultMessages: Record<ContentClientErrorKind, string> = {
    'not-found': 'No content matches the requested key or id.',
    unauthorised: 'The content service rejected this deployment’s credentials.',
    network: 'The content service could not be reached.',
    malformed: 'The content service returned a response that could not be parsed.',
    unknown: 'The content service failed for an unknown reason.',
  }

  const fail = (): Promise<never> =>
    Promise.reject(new ContentClientError(kind, message ?? defaultMessages[kind]))

  return {
    getByKey: <T = unknown>(_key: string, _opts?: ContentRequestOptions): Promise<ContentItem<T>> =>
      fail(),
    getById: <T = unknown>(_id: string, _opts?: ContentRequestOptions): Promise<ContentItem<T>> =>
      fail(),
  }
}
