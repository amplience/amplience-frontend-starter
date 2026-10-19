/**
 * Where fixtures live, and what happens when two claim the same label.
 *
 * Flows and listeners each have two homes:
 *
 *   flows/            checked in — the showcase set, reviewed in a pull request
 *   flows/local/      gitignored — pulled from a customer or sandbox hub
 *
 * A pull lands in `local/` unless asked otherwise, so promoting something into
 * the repository is a deliberate act rather than the default. That matters more
 * than it sounds: a flow pulled from a customer hub can carry their brand names
 * in instruction prose, and an extension instance's `env` can carry their
 * credentials. Opting *in* to committing is the safe direction for a mistake.
 *
 * Push reads both, because a locally-pulled flow is still a flow you want to
 * push. Identity is still the label, so a label in both homes is refused rather
 * than resolved by precedence — "which copy won" is not a question anyone
 * should have to ask at a demo.
 */

import path from 'node:path'

/** The gitignored subdirectory of each fixture directory. */
export const LOCAL_DIR = 'local'

/** Where a pull should write, given the base directory and the flag. */
export function pullTarget(baseDir, { shared = false } = {}) {
  return shared ? baseDir : path.join(baseDir, LOCAL_DIR)
}

/**
 * Merge the checked-in and local fixture sets.
 *
 * Each entry is `{ label, source, value }` — `source` only so a refusal can
 * name the two files rather than just the label.
 */
export function mergeFixtures(shared = [], local = []) {
  const seen = new Map()
  const clashes = []

  for (const entry of [...shared, ...local]) {
    const existing = seen.get(entry.label)
    if (existing === undefined) {
      seen.set(entry.label, entry)
      continue
    }
    clashes.push(
      `"${entry.label}" is defined twice — ${existing.source} and ${entry.source}. ` +
        `The label is the identity, so there is no answer to which one should be pushed. ` +
        `Rename one, or delete the copy you do not want.`,
    )
  }

  if (clashes.length > 0) throw new Error(clashes.join('\n\n'))
  return [...seen.values()]
}
