'use client'

import clsx from 'clsx'
import { useEffect, useRef, type CSSProperties } from 'react'

import type {
  MediaLoadPriority,
  VideoAspectRatio,
  VideoPlayback,
} from '@amplience/frontend-starter-types'

import { AmbientToggle } from './AmbientToggle'
import styles from './NativeVideo.module.css'
import { useAmbientPlayback, type AmbientTrigger } from './useAmbientPlayback'
import { videoAspectRatioCss, type VideoSource } from './video-utils'

export type NativeVideoProps = {
  /** Tried in order. */
  sources: readonly VideoSource[]
  /** Image shown before playback starts. */
  poster?: string
  /** Accessible name (player mode; ambient is decorative). */
  title?: string
  playback: VideoPlayback
  /** Frame shape. Defaults to 16:9. */
  aspectRatio?: VideoAspectRatio
  /** `'hover'` inside links; `'autoplay'` (default) shows a pause button. */
  ambientTrigger?: AmbientTrigger
  /** ADR-0021 tier. `'lcp'` preloads the poster. */
  loadPriority?: MediaLoadPriority
  className?: string
}

/** A `<video>` in a fixed-ratio frame — behind DynamicVideo and ExternalVideo's `.mp4`. */
export function NativeVideo({
  sources,
  poster,
  title,
  playback,
  aspectRatio,
  ambientTrigger = 'autoplay',
  loadPriority = 'lazy',
  className,
}: NativeVideoProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const ambient = playback === 'ambient'
  const { paused, shouldPlay, toggle } = useAmbientPlayback(ref, ambient, ambientTrigger)

  useEffect(() => {
    const video = ref.current
    if (!ambient || video === null) return
    if (shouldPlay) {
      // React doesn't reliably set the `muted` property, and unmuted can't autoplay.
      video.muted = true
      video.play()?.catch(() => undefined)
    } else {
      video.pause()
    }
  }, [ambient, shouldPlay])

  if (sources.length === 0) return null

  const style = { '--video-aspect-ratio': videoAspectRatioCss(aspectRatio) } as CSSProperties
  // A <video> doesn't re-select when its <source>s change, so new sources remount it.
  const sourceKey = sources.map(({ src, media }) => `${src}|${media ?? ''}`).join(',')
  const sourceEls = sources.map(({ src, type, media }) => (
    <source key={`${src}|${media ?? ''}`} src={src} type={type} {...(media && { media })} />
  ))

  return (
    <div
      className={clsx('NativeVideo', styles.root, className)}
      data-playback={playback}
      style={style}
    >
      {/* React hoists this into <head>. */}
      {poster !== undefined && loadPriority === 'lcp' && (
        <link rel="preload" as="image" href={poster} fetchPriority="high" />
      )}
      {ambient ? (
        <video
          key={sourceKey}
          ref={ref}
          className={styles.video}
          muted
          loop
          playsInline
          disablePictureInPicture
          // play() fetches the rest, only once it's allowed to start.
          preload={loadPriority === 'lazy' ? 'none' : 'metadata'}
          aria-hidden="true"
          tabIndex={-1}
          {...(poster !== undefined && { poster })}
        >
          {sourceEls}
        </video>
      ) : (
        // No captions modelled yet (ADR-0025).
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          key={sourceKey}
          ref={ref}
          className={styles.video}
          controls
          playsInline
          preload={loadPriority === 'lazy' ? 'none' : 'metadata'}
          {...(title && { 'aria-label': title })}
          {...(poster !== undefined && { poster })}
        >
          {sourceEls}
        </video>
      )}
      {ambient && ambientTrigger === 'autoplay' && (
        <AmbientToggle paused={paused} onToggle={toggle} />
      )}
    </div>
  )
}
