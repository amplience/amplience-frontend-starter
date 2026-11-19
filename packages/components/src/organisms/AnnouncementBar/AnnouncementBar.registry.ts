import type { ComponentRegistryEntry } from '@amplience/frontend-starter-types'

import { AnnouncementBar, type AnnouncementBarProps } from './AnnouncementBar'

/** The schema URI this entry dispatches (ADR-0010 §3 — no aliasing). */
export const ANNOUNCEMENT_BAR_SCHEMA = 'https://quadratic.amplience.com/v2/content/announcement-bar'

/**
 * The announcement-bar delivery body — AnnouncementBar props plus the content
 * envelope. `id` and `localeBasePath` are excluded: the adapter supplies them
 * (the id from the envelope, the prefix from the render context).
 */
export type AnnouncementBarSchema = Omit<AnnouncementBarProps, 'id' | 'localeBasePath'> & {
  readonly _meta?: { readonly deliveryId?: string }
}

/**
 * Registry entry for the announcement-bar schema. The adapter strips the
 * `_meta` envelope but keeps its delivery id, which keys a visitor's
 * dismissal so it survives edits to everything except the message.
 */
export const announcementBarRegistryEntry: ComponentRegistryEntry<
  AnnouncementBarSchema,
  AnnouncementBarProps
> = {
  component: AnnouncementBar,
  propsFromSchema: ({ _meta, ...props }, ctx) => ({
    ...props,
    ...(_meta?.deliveryId !== undefined && { id: _meta.deliveryId }),
    localeBasePath: ctx.localeBasePath ?? '',
  }),
}
