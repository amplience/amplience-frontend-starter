// Hand-written declarations for the provenance classifier, which stays plain
// ESM (.mjs) so `node scripts/hub-wipe.mjs` can import it without a TS loader.
// This lets the .ts test and typecheck see real types for the import.

/**
 * The parts of a hub item this module needs. `status` is absent on an item that
 * was never asked for one, which counts as live — the common case, and the safe
 * reading when the caller didn't say.
 */
export type HubItem = { id: string; label?: string; status?: string }

/** A fixture set on disk, and the ids of the items in it. */
export type SetOnDisk = { name: string; ids: ReadonlySet<string> }

/** `[sourceId, hubItemId]`, as dc-cli's map records them. */
export type ContentItemPair = readonly [string, string]

export type Classified = {
  /** Items whose source fixture is on disk now, by set name. */
  bySet: Map<string, HubItem[]>
  /** In the map, but the source isn't on disk any more. */
  orphaned: HubItem[]
  /** Never in the map — authored in the DC UI. */
  custom: HubItem[]
}

/** Which selection a wipe is scoped to. At most one is set. */
export type WipeSelector = { set?: string; custom?: boolean; orphaned?: boolean }

export declare const classifyHubItems: (
  hubItems: readonly HubItem[],
  contentItemPairs: readonly ContentItemPair[],
  sets: readonly SetOnDisk[],
) => Classified

/** Counts of live items only; archived ones are reported apart, never bucketed. */
export declare const summarise: (classified: Classified) => {
  bySet: Record<string, number>
  orphaned: number
  custom: number
  total: number
  archived: number
}

/** The items a selection would act on, or undefined for an unknown set. */
export declare const selectForWipe: (
  classified: Classified,
  selector: WipeSelector,
) => HubItem[] | undefined

/** Whether a selection could be put back from the repository. */
export declare const isRegenerable: (selector: WipeSelector) => boolean
