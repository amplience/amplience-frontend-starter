/** Story samples: demo-hub DAM clip, Blender open movie, Vimeo sample, MDN CC0 loop. */
import type { DynamicVideoData, ExternalVideoData } from '@amplience/frontend-starter-types'

export const damVideo: DynamicVideoData = {
  mediaType: 'DynamicVideo',
  video: { name: 'Zoe_Saldana', endpoint: 'quadraticdemo', defaultHost: 'cdn.media.amplience.net' },
  title: 'Interview from the Amplience demo hub',
  aspectRatio: '16:9',
}

export const youTubeVideo: ExternalVideoData = {
  mediaType: 'ExternalVideo',
  url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  title: 'Big Buck Bunny — Blender Foundation open movie',
}

export const vimeoVideo: ExternalVideoData = {
  mediaType: 'ExternalVideo',
  url: 'https://vimeo.com/76979871',
  title: 'The new Vimeo player',
}

export const mp4Video: ExternalVideoData = {
  mediaType: 'ExternalVideo',
  url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  title: 'A flower opening',
}
