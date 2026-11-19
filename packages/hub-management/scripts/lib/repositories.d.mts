// Hand-written declarations for the repository-folder helper, which stays plain
// ESM (.mjs) so `node scripts/hub-import.mjs` can import it without a TS
// loader. This lets the .ts test and typecheck see real types.

/** The staging folder name (the repository's label) for each configured repository id. */
export declare const repositoryFolders: <K extends string>(
  ids: Record<K, string>,
  repos: readonly { id: string; label: string }[],
) => Record<K, string>
