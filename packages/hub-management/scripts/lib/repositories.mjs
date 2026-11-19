/**
 * Repository folders for the content import.
 *
 * The content step stages a set into one directory and makes one dc-cli call
 * without `--baseRepo`. dc-cli then treats each top-level folder as a
 * repository — matched by its *label* — and builds a single dependency tree
 * across all of them, so it imports leaves first and resolves circular links
 * itself, whichever repositories the linked items live in.
 *
 * The environment names repositories by id, so the seed looks their labels up
 * and stages under those. Matching by label is dc-cli's rule, not ours, which
 * is why a label it can't match unambiguously fails here, before anything is
 * imported.
 */

/** True when `label` can be used as a single directory name. */
const isFolderName = (label) =>
  typeof label === 'string' &&
  label.trim() !== '' &&
  label !== '.' &&
  label !== '..' &&
  !/[/\\]/.test(label)

/**
 * The staging folder name — the repository's label — for each configured
 * repository id.
 *
 * @param ids   `{ AMPLIENCE_REPO_CONTENT: '<id>', … }` — only configured ones.
 * @param repos the hub's repositories, as `dc-cli content-repository list --json` prints them.
 * @returns     the same keys, each mapped to its repository's label.
 * @throws      when an id isn't on the hub, or its label is shared or unusable.
 */
export const repositoryFolders = (ids, repos) => {
  const folders = {}
  for (const [envVar, id] of Object.entries(ids)) {
    const repo = repos.find((r) => r.id === id)
    if (repo === undefined) {
      throw new Error(`${envVar} is "${id}", but this hub has no repository with that id.`)
    }
    const sharing = repos.filter((r) => r.label === repo.label)
    if (sharing.length > 1) {
      throw new Error(
        `${sharing.length} repositories on this hub are labelled "${repo.label}". dc-cli matches ` +
          'repositories by label, so it cannot tell them apart — rename one in Dynamic Content.',
      )
    }
    if (!isFolderName(repo.label)) {
      throw new Error(
        `The repository for ${envVar} is labelled "${repo.label}", which can't be used as a ` +
          'folder name (dc-cli matches repositories by folder name) — rename it in Dynamic Content.',
      )
    }
    folders[envVar] = repo.label
  }
  return folders
}
