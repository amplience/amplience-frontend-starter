// Hand-written declarations for the fixture-location rules, which stay plain
// ESM (.mjs) so the scripts import them without a TS loader.

/** The gitignored subdirectory of each fixture directory. */
export const LOCAL_DIR: string

export type FixtureEntry<T = unknown> = {
  /** The identity — a flow's or listener's exact label. */
  label: string
  /** Only used to name both files when two entries clash. */
  source: string
  value: T
}

/** Where a pull should write: the local subdirectory unless `shared`. */
export function pullTarget(baseDir: string, options?: { shared?: boolean }): string

/** Merge checked-in and local fixtures, throwing when a label is in both. */
export function mergeFixtures<T>(
  shared?: FixtureEntry<T>[],
  local?: FixtureEntry<T>[],
): FixtureEntry<T>[]
