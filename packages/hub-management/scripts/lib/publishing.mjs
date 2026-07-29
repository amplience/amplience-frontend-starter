/**
 * Publishing-state predicates for the wipe script.
 *
 * Archiving a content item in Dynamic Content does *not* remove it from
 * Delivery. Archive is a management-side lifecycle change; the published
 * snapshot on the CDN is a separate artefact that only `unpublish` retracts.
 * A wipe that only archives therefore leaves every previous generation of
 * seeded content live on `<hub>.cdn.content.amplience.net` forever, where
 * schema-wide reads (the Filter API, hence `listBySchema`) keep returning it.
 *
 * The staging VSE hides this: it serves the current repository state, so a
 * developer running against a VSE sees the seed they expect while production
 * accumulates a copy per wipe/seed cycle.
 *
 * Deciding *whether* to unpublish an item is the part worth testing in
 * isolation, so it lives here as pure predicates over the management-SDK
 * resource; the wipe script owns the I/O around them.
 */

/**
 * Management-API publishing states that mean "nothing of this item is live in
 * Delivery" — `NONE` (never published) and `UNPUBLISHED` (already retracted).
 */
const NOT_LIVE = new Set(['NONE', 'UNPUBLISHED'])

/**
 * Whether an item might still be served by Delivery.
 *
 * `publishingStatus` is absent from some list responses. Absent is treated as
 * "might be published": a needless `unpublish` attempt is gated by
 * {@link canUnpublish} and costs one no-op, whereas wrongly skipping leaves
 * content live — the exact failure this module exists to prevent. The cost of
 * the pessimistic branch is that a wipe against an API that omits the field
 * re-attempts every item on every run instead of converging.
 */
export function mayBePublished(item) {
  const status = item?.publishingStatus
  if (status === undefined || status === null) return true
  return !NOT_LIVE.has(status)
}

/**
 * Whether the API advertises an `unpublish` action on this item.
 *
 * HAL links are the same "can I write?" signal the environment-manager
 * preflight uses: the API only offers the action when the item is live, the
 * hub has unpublish enabled, and the credentials carry the permission. Asking
 * the link is cheaper and more honest than inferring from state.
 *
 * `_links` is documented as a `Map` but the SDK builds resources with
 * `Object.assign`, so in practice it is a plain object. Both are read.
 */
export function canUnpublish(item) {
  const links = item?._links
  if (links === undefined || links === null) return false
  if (typeof links.get === 'function') return links.get('unpublish') !== undefined
  return Object.prototype.hasOwnProperty.call(links, 'unpublish')
}

/** HTTP status carried by a management-SDK rejection, when there is one. */
const statusOf = (error) => error?.response?.status ?? error?.status

/** The human-readable part of a rejection — the SDK rejects with bare strings. */
const messageOf = (error) => {
  if (typeof error === 'string') return error
  if (typeof error?.message === 'string') return error.message
  return ''
}

/**
 * Whether a failed unpublish reflects the *environment* rather than the item:
 * credentials without the permission, or a hub without unpublish enabled.
 *
 * The distinction drives the wipe's behaviour. A per-item failure is worth a
 * warning and a carry-on; an environmental one will repeat for every item, so
 * the caller stops attempting and reports once with something actionable.
 */
export function isEnvironmentalFailure(error) {
  const status = statusOf(error)
  if (status === 401 || status === 403) return true
  // The SDK rejects with "The unpublish action is not available, ensure you
  // have permission to perform this action." when the HAL link is missing.
  return /\bnot available\b|\bnot enabled\b|\bunsupported\b/i.test(messageOf(error))
}
