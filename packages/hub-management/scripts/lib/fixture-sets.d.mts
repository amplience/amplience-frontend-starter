// Hand-written declarations for the fixture-set reader, which stays plain ESM
// (.mjs) so the import and wipe scripts can share it without a TS loader. This
// lets the .ts tests and typecheck see real types for the import.

/** Where the sets live. */
export declare const fixturesRoot: string

/** The set used when nothing says otherwise. */
export declare const DEFAULT_FIXTURE_SET: string

/** Directories inside a set that hold content items, in seed order. */
export declare const ITEM_DIRS: readonly string[]

/** A set on disk: its definition, and the ids of every item in it. */
export type FixtureSetOnDisk = {
  name: string
  dir: string
  definition: {
    name: string
    label?: string
    description?: string
    defaultBrand?: string
    defaultLocale?: string
    authoredLocales?: string[]
    generatedDocs?: boolean
  }
  ids: Set<string>
}

/** Every set on disk, sorted. `root` is for tests. */
export declare const availableSets: (root?: string) => string[]

/** One set, read. Throws when the directory name and `set.json` disagree. */
export declare const readSet: (name: string, root?: string) => FixtureSetOnDisk

/** Every set on disk, read. */
export declare const readAllSets: (root?: string) => FixtureSetOnDisk[]

/** Which set a command is about. Throws, naming what's available, on a miss. */
export declare const resolveSetName: (
  requested: string | undefined,
  options?: { fallback?: string; root?: string },
) => string

/** `--flag value` or `--flag=value`, anywhere in `argv`. */
export declare const flagValue: (argv: readonly string[], name: string) => string | undefined

/** Is a bare `--flag` present? */
export declare const hasFlag: (argv: readonly string[], name: string) => boolean

/** The first bare argument, skipping flags and any value following `--set`. */
export declare const positional: (argv: readonly string[]) => string | undefined
