// Hand-written declarations for the publishing predicates, which stay plain
// ESM (.mjs) so `node scripts/hub-wipe.mjs` can import them without a TS
// loader. This lets the .ts test and typecheck see real types for the import.

/**
 * The parts of a management-SDK `ContentItem` these predicates read. Declared
 * structurally rather than importing the SDK type: the wipe passes real
 * resources, the tests pass literals, and both should typecheck.
 */
export type PublishableItem = {
  publishingStatus?: string | null
  _links?: Map<string, unknown> | Record<string, unknown> | null
}

/** Whether an item might still be served by Delivery (absent state ⇒ yes). */
export function mayBePublished(item: PublishableItem | null | undefined): boolean

/** Whether the API advertises an `unpublish` action on this item. */
export function canUnpublish(item: PublishableItem | null | undefined): boolean

/** Whether a failed unpublish reflects the environment, not the single item. */
export function isEnvironmentalFailure(error: unknown): boolean
