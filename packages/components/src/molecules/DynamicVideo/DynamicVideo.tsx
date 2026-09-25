import type {
  DynamicVideoData,
  MediaLoadPriority,
  VideoPlayback,
} from '@amplience/frontend-starter-types'

import { buildDiBaseUrl } from '../DynamicImage/di-utils'
import { NativeVideo } from '../NativeVideo/NativeVideo'
import type { AmbientTrigger } from '../NativeVideo/useAmbientPlayback'
import {
  damVideoSources,
  damVideoThumbnailUrl,
  type DamVideoProfile,
} from '../NativeVideo/video-utils'

export type DynamicVideoProps = {
  video: DynamicVideoData
  /** After any context override. */
  playback: VideoPlayback
  ambientTrigger?: AmbientTrigger
  loadPriority?: MediaLoadPriority
  /** Defaults to `DEFAULT_DAM_VIDEO_PROFILES`. */
  profiles?: readonly DamVideoProfile[]
  className?: string
}

const POSTER_WIDTH = 1600

/** DynamicVideo molecule — a DAM video; poster defaults to its DAM thumbnail. */
export function DynamicVideo({
  video,
  playback,
  ambientTrigger,
  loadPriority,
  profiles,
  className,
}: DynamicVideoProps) {
  const link = video.video
  if (!link?.name || !link?.endpoint || !link?.defaultHost) return null

  const posterLink = video.poster
  const poster =
    posterLink?.name && posterLink.endpoint && posterLink.defaultHost
      ? `${buildDiBaseUrl(posterLink)}?w=${POSTER_WIDTH}`
      : damVideoThumbnailUrl(link, POSTER_WIDTH)

  return (
    <NativeVideo
      sources={damVideoSources(link, profiles)}
      poster={poster}
      playback={playback}
      {...(video.title !== undefined && { title: video.title })}
      {...(video.aspectRatio !== undefined && { aspectRatio: video.aspectRatio })}
      {...(ambientTrigger !== undefined && { ambientTrigger })}
      {...(loadPriority !== undefined && { loadPriority })}
      {...(className !== undefined && { className })}
    />
  )
}
