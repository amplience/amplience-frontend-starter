'use client'

import clsx from 'clsx'
import NextImage from 'next/image'
import { useEffect, useRef, useState, type CSSProperties } from 'react'

import type {
  ExternalVideoData,
  MediaLoadPriority,
  VideoPlayback,
} from '@amplience/frontend-starter-types'

import { Icon } from '../../atoms/Icon/Icon'
import { mediaLoadingProps } from '../ContentMedia/mediaLoadingProps'
import { AmbientToggle } from '../NativeVideo/AmbientToggle'
import { NativeVideo } from '../NativeVideo/NativeVideo'
import { useAmbientPlayback, type AmbientTrigger } from '../NativeVideo/useAmbientPlayback'
import { videoAspectRatioCss, videoAspectRatioNumber } from '../NativeVideo/video-utils'
import styles from './ExternalVideo.module.css'
import {
  embedUrl,
  isPlayingMessage,
  parseVideoUrl,
  playerCommand,
  playerSubscribeMessages,
  VIMEO_EMBED_ORIGIN,
  YOUTUBE_EMBED_ORIGIN,
  youTubeThumbnailUrl,
  type ParsedVideoUrl,
} from './parse-video-url'

export type ExternalVideoProps = {
  video: ExternalVideoData
  /** After any context override. */
  playback: VideoPlayback
  ambientTrigger?: AmbientTrigger
  loadPriority?: MediaLoadPriority
  /** next/image `sizes` for the poster. Defaults to 100vw. */
  sizes?: string
  className?: string
}

type EmbeddedVideo = Extract<ParsedVideoUrl, { provider: 'youtube' | 'vimeo' }>

const IFRAME_ALLOW = 'autoplay; encrypted-media; fullscreen; picture-in-picture'
// YouTube requires a Referer from embeds; set it explicitly in case the site's policy strips it.
const IFRAME_REFERRER_POLICY = 'strict-origin-when-cross-origin'
/** An ambient embed that hasn't reported playing by now is dropped for its poster. */
export const AMBIENT_EMBED_TIMEOUT_MS = 8000

/**
 * ExternalVideo molecule — YouTube, Vimeo or a direct `.mp4` (ADR-0025).
 * Players load the provider embed only on click; ambient embeds load when on screen.
 */
export function ExternalVideo({
  video,
  playback,
  ambientTrigger = 'autoplay',
  loadPriority = 'lazy',
  sizes = '100vw',
  className,
}: ExternalVideoProps) {
  const parsed = parseVideoUrl(video.url)

  if (parsed === undefined) {
    console.warn('[ExternalVideo] unsupported video URL — skipping render', { url: video.url })
    return null
  }

  if (parsed.provider === 'file') {
    return (
      <NativeVideo
        sources={[{ src: parsed.src, type: 'video/mp4' }]}
        playback={playback}
        title={video.title}
        ambientTrigger={ambientTrigger}
        loadPriority={loadPriority}
        {...(video.posterUrl !== undefined && { poster: video.posterUrl })}
        {...(video.aspectRatio !== undefined && { aspectRatio: video.aspectRatio })}
        {...(className !== undefined && { className })}
      />
    )
  }

  return (
    <EmbeddedPlayer
      // Reset `started` when the video changes, so a new player doesn't autoplay.
      key={`${video.url}|${playback}`}
      parsed={parsed}
      video={video}
      playback={playback}
      ambientTrigger={ambientTrigger}
      loadPriority={loadPriority}
      sizes={sizes}
      {...(className !== undefined && { className })}
    />
  )
}

function EmbeddedPlayer({
  parsed,
  video,
  playback,
  ambientTrigger,
  loadPriority,
  sizes,
  className,
}: {
  parsed: EmbeddedVideo
  video: ExternalVideoData
  playback: VideoPlayback
  ambientTrigger: AmbientTrigger
  loadPriority: MediaLoadPriority
  sizes: string
  className?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const ambient = playback === 'ambient'
  const { paused, shouldPlay, toggle } = useAmbientPlayback(rootRef, ambient, ambientTrigger)
  // Once mounted, the embed stays mounted; ambient pauses go over postMessage.
  const [started, setStarted] = useState(false)
  if (ambient && shouldPlay && !started) setStarted(true)

  // Messages sent before load are dropped; YouTube listens a beat after load, hence the retry.
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const frame = iframeRef.current?.contentWindow
    if (!ambient || !loaded || !frame) return
    const { message, origin } = playerCommand(parsed.provider, shouldPlay ? 'play' : 'pause')
    frame.postMessage(message, origin)
    if (shouldPlay) return
    const retry = setTimeout(() => frame.postMessage(message, origin), 1000)
    return () => clearTimeout(retry)
  }, [ambient, loaded, shouldPlay, parsed.provider])

  // An ambient embed stays invisible until the provider reports it's actually playing, so a
  // sign-in or bot-check screen (which an inert embed can't be clicked through) never shows.
  const [confirmed, setConfirmed] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const frame = iframeRef.current?.contentWindow
    if (!ambient || !loaded || confirmed || !frame) return
    const origin = parsed.provider === 'youtube' ? YOUTUBE_EMBED_ORIGIN : VIMEO_EMBED_ORIGIN
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame || event.origin !== origin) return
      if (isPlayingMessage(parsed.provider, event.data)) setConfirmed(true)
    }
    window.addEventListener('message', onMessage)
    // Both players ignore messages until they're ready, so keep asking.
    const subscribe = () => {
      for (const message of playerSubscribeMessages(parsed.provider))
        frame.postMessage(message, origin)
    }
    subscribe()
    const ping = setInterval(subscribe, 500)
    return () => {
      window.removeEventListener('message', onMessage)
      clearInterval(ping)
    }
  }, [ambient, loaded, confirmed, parsed.provider])

  useEffect(() => {
    if (!ambient || !loaded || confirmed || !shouldPlay) return
    const timer = setTimeout(() => setFailed(true), AMBIENT_EMBED_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [ambient, loaded, confirmed, shouldPlay])

  const poster =
    video.posterUrl ?? (parsed.provider === 'youtube' ? youTubeThumbnailUrl(parsed.id) : undefined)
  const style = {
    '--video-aspect-ratio': videoAspectRatioCss(video.aspectRatio),
    '--video-ratio': videoAspectRatioNumber(video.aspectRatio),
  } as CSSProperties

  const posterEl = poster !== undefined && (
    <NextImage
      src={poster}
      alt=""
      fill
      sizes={sizes}
      className={styles.poster}
      {...mediaLoadingProps(loadPriority)}
    />
  )

  return (
    <div
      ref={rootRef}
      className={clsx('ExternalVideo', styles.root, className)}
      data-playback={playback}
      data-provider={parsed.provider}
      style={style}
    >
      {ambient ? (
        <>
          {posterEl}
          {started && !failed && (
            // Decorative: the toggle is the only control.
            <div className={styles.frame} data-confirmed={confirmed || undefined} inert>
              <iframe
                ref={iframeRef}
                className={styles.iframe}
                src={embedUrl(parsed, 'ambient')}
                title={video.title}
                allow={IFRAME_ALLOW}
                referrerPolicy={IFRAME_REFERRER_POLICY}
                tabIndex={-1}
                onLoad={() => setLoaded(true)}
              />
            </div>
          )}
          {ambientTrigger === 'autoplay' && !failed && (
            <AmbientToggle paused={paused} onToggle={toggle} />
          )}
        </>
      ) : started ? (
        <iframe
          className={styles.iframe}
          src={embedUrl(parsed, 'player')}
          title={video.title}
          allow={IFRAME_ALLOW}
          referrerPolicy={IFRAME_REFERRER_POLICY}
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          className={styles.facade}
          aria-label={`Play video: ${video.title}`}
          onClick={() => setStarted(true)}
        >
          {posterEl}
          <span className={styles.playIcon} aria-hidden="true">
            <Icon name="play" size={28} />
          </span>
        </button>
      )}
    </div>
  )
}
