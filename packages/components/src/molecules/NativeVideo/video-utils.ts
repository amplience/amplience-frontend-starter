import type {
  AmplienceVideoLink,
  MediaLoadPriority,
  VideoAspectRatio,
  VideoPlayback,
} from '@amplience/frontend-starter-types'

/** Default frame shape when content doesn't set one. */
export const DEFAULT_VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9'

/** "16:9" → "16 / 9". Falls back to 16:9. */
export function videoAspectRatioCss(ratio: VideoAspectRatio | undefined): string {
  const [w, h] = ratioParts(ratio)
  return `${w} / ${h}`
}

/** "16:9" → 1.7778. */
export function videoAspectRatioNumber(ratio: VideoAspectRatio | undefined): number {
  const [w, h] = ratioParts(ratio)
  return w / h
}

function ratioParts(ratio: VideoAspectRatio | undefined): readonly [number, number] {
  const [w, h] = (ratio ?? DEFAULT_VIDEO_ASPECT_RATIO).split(':').map(Number)
  return w !== undefined && h !== undefined && w > 0 && h > 0 ? [w, h] : [16, 9]
}

/** Context override, else the authored value, else `'player'`. */
export const resolvePlayback = (
  authored: VideoPlayback | undefined,
  override: VideoPlayback | undefined,
): VideoPlayback => override ?? authored ?? 'player'

/** Inverse of `mediaLoadingProps`. */
export const loadTierFromProps = ({
  priority,
  loading,
}: {
  priority?: boolean | undefined
  loading?: 'eager' | 'lazy' | undefined
}): MediaLoadPriority => (priority ? 'lcp' : loading === 'eager' ? 'eager' : 'lazy')

/** One `<source>` for a native `<video>`. */
export type VideoSource = {
  readonly src: string
  readonly type: string
  /** Skipped when the query doesn't match. */
  readonly media?: string
}

/** A DAM transcode profile: `https://{host}/v/{endpoint}/{name}/{profile}`. */
export type DamVideoProfile = {
  readonly profile: string
  readonly type: string
  readonly media?: string
}

/**
 * Profiles vary per account (the demo hub has no 720p); a 404 falls through to
 * the next `<source>`. Put your account's real profiles first.
 */
export const DEFAULT_DAM_VIDEO_PROFILES: readonly DamVideoProfile[] = [
  { profile: 'mp4_720p', type: 'video/mp4', media: '(max-width: 768px)' },
  { profile: 'mp4_1080p', type: 'video/mp4' },
  { profile: 'mp4_720p', type: 'video/mp4' },
  { profile: 'mp4_480p', type: 'video/mp4' },
]

/** https://{defaultHost}/v/{endpoint}/{encodedName} */
export function buildDamVideoBaseUrl(video: AmplienceVideoLink): string {
  return `https://${video.defaultHost}/v/${video.endpoint}/${encodeURIComponent(video.name)}`
}

/** `<source>` list for a DAM video. */
export function damVideoSources(
  video: AmplienceVideoLink,
  profiles: readonly DamVideoProfile[] = DEFAULT_DAM_VIDEO_PROFILES,
): VideoSource[] {
  const base = buildDamVideoBaseUrl(video)
  return profiles.map(({ profile, type, media }) => ({
    src: `${base}/${profile}`,
    type,
    ...(media !== undefined && { media }),
  }))
}

/** The profile-less video URL serves its thumbnail, and takes `w`. */
export function damVideoThumbnailUrl(video: AmplienceVideoLink, width = 1280): string {
  return `${buildDamVideoBaseUrl(video)}?w=${width}`
}

/** True when the visitor has asked the OS for reduced motion. SSR-safe. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
