import type { MediaLoadPriority } from '@amplience/quadratic-types'

/**
 * The next/image loading props for one tier — everything a component needs to
 * pass to `ContentMedia` (or `ArtDirectedMedia`) to realise it.
 */
export type MediaLoadingProps = {
  readonly priority?: true
  readonly fetchPriority?: 'high'
  readonly loading?: 'eager'
}

/**
 * Maps a `loadPriority` tier to next/image props (ADR-0021 §3). The only place
 * in the repo that constructs them, for three reasons.
 *
 * **The mapping isn't obvious from the prop names.** next/image decides lazy
 * loading as `!priority && !preload && (loading === 'lazy' || undefined)`, and
 * emits its preload `<link>` for `priority || preload`. So `loading="eager"`
 * *alone* is the middle tier: eager, discovered in the body, at the browser's
 * own priority, with no preload competing with the LCP.
 *
 * **`fetchPriority` has to be explicit.** next/image v16 no longer derives
 * `fetchpriority` from `priority`, so an LCP candidate without it lands at
 * default priority and fails the "LCP request discovery" audit.
 *
 * **Three prop combinations throw** — `priority` or `preload` with
 * `loading="lazy"`, and `priority` together with `preload`. Deriving all of
 * them from one closed tier makes those combinations unconstructible rather
 * than merely discouraged.
 *
 * Note that `priority` is deprecated as of next 16 in favour of `preload`,
 * which names the behaviour more honestly. Switching is one line here (plus the
 * test mocks that assert on it) and nothing at any call site — which is most of
 * why this function exists.
 *
 * A keyed table rather than a `switch` with a `never` guard: `Record<
 * MediaLoadPriority, …>` makes a new tier a compile error at the table instead
 * of at an unreachable `default` branch, so exhaustiveness costs no untestable
 * line (the guard elsewhere in the repo is a permanent coverage miss for
 * exactly that reason).
 */
const PROPS_BY_TIER = {
  lcp: { priority: true, fetchPriority: 'high' },
  eager: { loading: 'eager' },
  lazy: {},
} as const satisfies Record<MediaLoadPriority, MediaLoadingProps>

export const mediaLoadingProps = (tier: MediaLoadPriority = 'lazy'): MediaLoadingProps =>
  PROPS_BY_TIER[tier]
