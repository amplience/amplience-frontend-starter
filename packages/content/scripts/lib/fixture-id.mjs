/**
 * Fixture ids, derived from the set name and the file's path (ADR-0019).
 *
 * Derived rather than random so the same tree always yields the same ids: two
 * people regenerating get identical files, a changed id in a diff means a file
 * moved, and CI can prove uniqueness instead of trusting it. It also lets a
 * set's id list be computed from disk alone, which is what makes a per-set hub
 * wipe possible without asking the hub anything.
 *
 * Plain ESM so `node scripts/*.mjs` can import it without a TS loader;
 * `fixture-id.d.mts` gives the .ts guard test real types.
 */

import { createHash } from 'node:crypto'

/**
 * A UUID-shaped string derived from a seed.
 *
 * SHA-256 rather than SHA-1: nothing here rests on collision resistance — the
 * seeds are our own file paths, not attacker-controlled input — but SHA-1 trips
 * every SAST scanner, and "it's fine, read the argument" is a judgement each
 * reviewer would have to make again. The stronger hash costs nothing.
 *
 * The version nibble stays 5 even though a real v5 is SHA-1 by definition. The
 * shape is what dc-cli and DC have accepted for months; a v8 would be the more
 * honest label but an unproven one, and the id is an opaque source key either
 * way.
 */
export const uuidFrom = (seed) => {
  const h = createHash('sha256').update(seed).digest('hex').slice(0, 32).split('')
  h[12] = '5' // version nibble
  h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) // variant bits
  const s = h.join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`
}

/**
 * The id for a fixture, from its set and its path within that set.
 *
 * `relPath` is relative to the set directory, either separator, with or without
 * the `.json` extension — `pages/home.json` and `pages/home` seed identically,
 * so a caller building a path and a caller reading one agree.
 */
export const fixtureIdFor = (setName, relPath) =>
  uuidFrom(`${setName}/${relPath.replace(/\\/g, '/').replace(/\.json$/, '')}`)
