import type {
  ContentImageData,
  ContentMediaData,
  ContentVideoData,
} from '@amplience/frontend-starter-types'

/** ManualImage or DynamicImage. */
export const isImageMedia = (media: ContentMediaData): media is ContentImageData =>
  media.mediaType === 'DynamicImage' || media.mediaType === 'ManualImage'

/** DynamicVideo or ExternalVideo. */
export const isVideoMedia = (media: ContentMediaData): media is ContentVideoData =>
  media.mediaType === 'DynamicVideo' || media.mediaType === 'ExternalVideo'
