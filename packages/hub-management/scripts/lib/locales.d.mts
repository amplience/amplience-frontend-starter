// Hand-written declarations for the locale reconciler, which stays plain ESM
// (.mjs) so `node scripts/hub-import.mjs` can import it without a TS loader.
// This lets the .ts test and typecheck see real types for the import.

/** What `filterLocales` did to one item. */
export type LocaleFilterResult = {
  /** Whether any value was removed. */
  changed: boolean
  /** Locales that survived, across the whole item. */
  kept: Set<string>
  /** Authored locales the hub doesn't have. */
  dropped: Set<string>
  /** Paths to fields the filter emptied — a seed-stopping condition. */
  emptied: string[]
}

/** Drop every authored locale the hub doesn't have, in place. */
export declare const filterLocales: (
  item: unknown,
  hubLocales: readonly string[],
) => LocaleFilterResult

/** One line describing the reconciliation, or undefined when nothing changed. */
export declare const describeLocaleFilter: (
  result: Pick<LocaleFilterResult, 'kept' | 'dropped'>,
  authored: number,
) => string | undefined
