/**
 * youtube.com rather than youtube-nocookie.com: nocookie can't see a visitor's
 * YouTube session, which makes the "Sign in to confirm you're not a bot" check likelier.
 */
export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube.com'
export const VIMEO_EMBED_ORIGIN = 'https://player.vimeo.com'

/** What an ExternalVideo URL points at. */
export type ParsedVideoUrl =
  | { readonly provider: 'youtube'; readonly id: string; readonly start?: number }
  | { readonly provider: 'vimeo'; readonly id: string; readonly hash?: string }
  | { readonly provider: 'file'; readonly src: string }

const YOUTUBE_ID = /^[\w-]{11}$/
const VIMEO_ID = /^\d+$/

/** "90", "1m30s", "1h2m3s" → seconds. */
function parseStart(value: string | null): number | undefined {
  if (!value) return undefined
  if (/^\d+$/.test(value)) return Number(value)
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value)
  if (!match || match[0] === '') return undefined
  const [, h = '0', m = '0', s = '0'] = match
  return Number(h) * 3600 + Number(m) * 60 + Number(s)
}

function parseYouTube(url: URL): ParsedVideoUrl | undefined {
  const host = url.hostname.replace(/^(www\.|m\.)/, '')
  const segments = url.pathname.split('/').filter(Boolean)
  let id: string | undefined
  if (host === 'youtu.be') id = segments[0]
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (segments[0] === 'watch') id = url.searchParams.get('v') ?? undefined
    else if (['embed', 'shorts', 'live', 'v'].includes(segments[0] ?? '')) id = segments[1]
  } else return undefined

  // `videoseries` is a playlist that happens to be 11 characters.
  if (id === undefined || id === 'videoseries' || !YOUTUBE_ID.test(id)) return undefined
  const start = parseStart(url.searchParams.get('t') ?? url.searchParams.get('start'))
  return { provider: 'youtube', id, ...(start !== undefined && start > 0 && { start }) }
}

function parseVimeo(url: URL): ParsedVideoUrl | undefined {
  const host = url.hostname.replace(/^www\./, '')
  const segments = url.pathname.split('/').filter(Boolean)
  let id: string | undefined
  let hash: string | undefined
  if (host === 'player.vimeo.com' && segments[0] === 'video') {
    id = segments[1]
    hash = url.searchParams.get('h') ?? undefined
  } else if (host === 'vimeo.com') {
    // /123, /123/hash (unlisted), /channels/x/123, /showcase/1/video/456
    const afterVideo = segments.findIndex(
      (s, i) => i > 0 && segments[i - 1] === 'video' && VIMEO_ID.test(s),
    )
    const index = afterVideo !== -1 ? afterVideo : segments.findIndex((s) => VIMEO_ID.test(s))
    id = index === -1 ? undefined : segments[index]
    const next = index === -1 ? undefined : segments[index + 1]
    if (next !== undefined && /^[\da-f]+$/i.test(next)) hash = next
  } else return undefined

  if (id === undefined || !VIMEO_ID.test(id)) return undefined
  return { provider: 'vimeo', id, ...(hash !== undefined && { hash }) }
}

/** https YouTube/Vimeo link or `.mp4`, else undefined. Keep in step with the schema `pattern`. */
export function parseVideoUrl(raw: string | undefined): ParsedVideoUrl | undefined {
  if (!raw) return undefined
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:') return undefined
  const parsed = parseYouTube(url) ?? parseVimeo(url)
  if (parsed) return parsed
  if (/\.mp4$/i.test(url.pathname)) return { provider: 'file', src: url.toString() }
  return undefined
}

/** Where a parsed video should be embedded, for the given playback. */
export function embedUrl(
  video: Extract<ParsedVideoUrl, { provider: 'youtube' | 'vimeo' }>,
  playback: 'player' | 'ambient',
): string {
  if (video.provider === 'youtube') {
    const params = new URLSearchParams(
      playback === 'ambient'
        ? {
            // `loop` needs a playlist of itself.
            autoplay: '1',
            mute: '1',
            loop: '1',
            playlist: video.id,
            controls: '0',
            disablekb: '1',
            playsinline: '1',
            rel: '0',
            enablejsapi: '1',
          }
        : // Mounted on click, so play straight away.
          { autoplay: '1', playsinline: '1', rel: '0' },
    )
    if (video.start !== undefined) params.set('start', String(video.start))
    return `${YOUTUBE_EMBED_ORIGIN}/embed/${video.id}?${params.toString()}`
  }

  const params = new URLSearchParams(
    playback === 'ambient' ? { background: '1', autopause: '0' } : { autoplay: '1' },
  )
  if (video.hash !== undefined) params.set('h', video.hash)
  return `${VIMEO_EMBED_ORIGIN}/video/${video.id}?${params.toString()}`
}

/** postMessage payload + target origin to play/pause an embed. */
export function playerCommand(
  provider: 'youtube' | 'vimeo',
  command: 'play' | 'pause',
): { readonly message: string; readonly origin: string } {
  if (provider === 'youtube') {
    return {
      message: JSON.stringify({
        event: 'command',
        func: command === 'play' ? 'playVideo' : 'pauseVideo',
        args: [],
      }),
      origin: YOUTUBE_EMBED_ORIGIN,
    }
  }
  return { message: JSON.stringify({ method: command }), origin: VIMEO_EMBED_ORIGIN }
}

/** Messages that ask an embed to report its playback state back to the page. */
export function playerSubscribeMessages(provider: 'youtube' | 'vimeo'): readonly string[] {
  if (provider === 'youtube') {
    return [JSON.stringify({ event: 'listening', id: 1, channel: 'widget' })]
  }
  // timeupdate too, in case playback started before the page subscribed.
  return ['play', 'playing', 'timeupdate'].map((value) =>
    JSON.stringify({ method: 'addEventListener', value }),
  )
}

/** True when a message from an embed reports that the video is actually playing. */
export function isPlayingMessage(provider: 'youtube' | 'vimeo', data: unknown): boolean {
  let message: unknown = data
  if (typeof data === 'string') {
    try {
      message = JSON.parse(data)
    } catch {
      return false
    }
  }
  if (typeof message !== 'object' || message === null) return false
  const { event, info } = message as { event?: unknown; info?: unknown }
  if (provider === 'vimeo') return event === 'play' || event === 'playing' || event === 'timeupdate'
  // YouTube player state 1 = playing.
  if (event === 'onStateChange') return info === 1
  if (event === 'infoDelivery' || event === 'initialDelivery') {
    return (info as { playerState?: unknown } | null)?.playerState === 1
  }
  return false
}

/** `hqdefault` always exists (unlike `maxresdefault`). */
export const youTubeThumbnailUrl = (id: string): string =>
  `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
