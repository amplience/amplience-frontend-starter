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

/**
 * Ask which set to use — only with a TTY, more than one set, and none named.
 * Resolves to undefined when it declines to ask, or the user takes the default.
 */
export declare const promptForSet: (
  available: readonly string[],
  fallback: string | undefined,
  options?: { question?: string; always?: boolean },
) => Promise<string | undefined>

/** What was asked for, else the environment, else a prompt, else the default. */
export declare const chooseSet: (
  requested: string | undefined,
  options?: { fallback?: string; root?: string },
) => Promise<string>

/** A `--flag value` option, telling "absent" apart from "given bare". */
export declare const readFlag: (
  argv: readonly string[],
  name: string,
) => { present: boolean; value: string | undefined }

/** `--flag value` or `--flag=value`, anywhere in `argv`; undefined if absent or bare. */
export declare const flagValue: (argv: readonly string[], name: string) => string | undefined

/**
 * The set `--set` names; undefined only when `--set` is absent. A bare `--set`
 * prompts at a terminal and throws elsewhere — it never falls through silently.
 */
export declare const setFromArgv: (
  argv: readonly string[],
  options?: { example?: string; question?: string; fallback?: string; root?: string },
) => Promise<string | undefined>

/** Is a bare `--flag` present? */
export declare const hasFlag: (argv: readonly string[], name: string) => boolean

/** The first bare argument, skipping flags and any value following `--set`. */
export declare const positional: (argv: readonly string[]) => string | undefined
