/**
 * Home page — slot renderer (QL-23).
 *
 * Fetches the home-main slot with depth='all' so all content-link references
 * are resolved inline. Each component is dispatched to its molecule by
 * `_meta.schema`; unknown schemas fall back to a Placeholder so the page
 * never hard-crashes on an unrecognised content type.
 *
 * When the SDK adapter lands (QL-43), the only change here is swapping
 * `makeMockContentClient` → `makeSdkContentClient` on the import line.
 */

import { ColumnsBlock } from '@amplience/quadratic-components/columns-block'
import type { ColumnsBlockProps } from '@amplience/quadratic-components/columns-block'
import { Container } from '@amplience/quadratic-components/container'
import { Divider } from '@amplience/quadratic-components/divider'
import { GridBlock } from '@amplience/quadratic-components/grid-block'
import type { GridBlockProps } from '@amplience/quadratic-components/grid-block'
import { HeroBlock } from '@amplience/quadratic-components/hero-block'
import type { HeroBlockProps } from '@amplience/quadratic-components/hero-block'
import { ImageBlock } from '@amplience/quadratic-components/image-block'
import type { ImageBlockProps } from '@amplience/quadratic-components/image-block'
import { MarkdownBlock } from '@amplience/quadratic-components/markdown-block'
import type { MarkdownBlockProps } from '@amplience/quadratic-components/markdown-block'
import { MediaCard } from '@amplience/quadratic-components/media-card'
import type { MediaCardProps } from '@amplience/quadratic-components/media-card'
import { Placeholder } from '@amplience/quadratic-components/placeholder'
import { Stack } from '@amplience/quadratic-components/stack'
import { Typography } from '@amplience/quadratic-components/typography'
import type { ContentBody } from '@amplience/quadratic-content'
import { makeMockContentClient } from '@amplience/quadratic-content/mock'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single resolved component from the slot — schema + arbitrary CMS props. */
type SlotItem = ContentBody<Record<string, unknown>>

/** The home-main slot body after depth='all' resolution. */
type SlotBody = {
  components: SlotItem[]
}

// ---------------------------------------------------------------------------
// Schema constants
// ---------------------------------------------------------------------------

const SCHEMA = {
  HERO: 'https://quadratic.amplience.com/v2/content/hero',
  IMAGE: 'https://quadratic.amplience.com/v2/content/image',
  COLUMNS: 'https://quadratic.amplience.com/v2/content/columns',
  GRID: 'https://quadratic.amplience.com/v2/content/grid',
  MEDIA_CARD: 'https://quadratic.amplience.com/v2/content/media-card',
  MARKDOWN_BLOCK: 'https://quadratic.amplience.com/v2/content/markdown-block',
} as const

// ---------------------------------------------------------------------------
// Component dispatcher
// ---------------------------------------------------------------------------

/**
 * Maps a resolved content item to its React molecule.
 *
 * Props are cast per schema — we trust the CMS/fixture to supply the correct
 * shape for each content type. This boundary is where a future Zod schema
 * validator would live (ADR-0010 open question).
 */

type RenderContext = {
  /** When true, block-level wrappers (section, Container) are suppressed. */
  bare?: boolean
}

function renderBlock(item: SlotItem, index: number, ctx: RenderContext = {}): React.ReactNode {
  const { _meta, ...props } = item
  const { schema, deliveryId } = _meta
  const key = deliveryId ?? `${schema}-${index}`

  switch (schema) {
    case SCHEMA.HERO:
      return <HeroBlock key={key} {...(props as HeroBlockProps)} />

    case SCHEMA.IMAGE:
      return <ImageBlock key={key} {...(props as ImageBlockProps)} bare={ctx.bare ?? false} />

    case SCHEMA.COLUMNS: {
      const { items, ...columnsProps } = props as { items?: SlotItem[] } & Omit<
        ColumnsBlockProps,
        'children'
      >
      return (
        <ColumnsBlock key={key} {...columnsProps}>
          {(items ?? []).map((child, i) => renderBlock(child, i, { bare: true }))}
        </ColumnsBlock>
      )
    }

    case SCHEMA.GRID: {
      const { items, ...gridProps } = props as { items?: SlotItem[] } & Omit<
        GridBlockProps,
        'children'
      >
      return (
        <GridBlock key={key} {...gridProps}>
          {(items ?? []).map((child, i) => renderBlock(child, i, { bare: true }))}
        </GridBlock>
      )
    }

    case SCHEMA.MEDIA_CARD:
      return <MediaCard key={key} {...(props as MediaCardProps)} />

    case SCHEMA.MARKDOWN_BLOCK:
      return <MarkdownBlock key={key} {...(props as MarkdownBlockProps)} bare={ctx.bare ?? false} />

    default:
      return <Placeholder key={key} text={`Content type "${schema}" has no renderer yet.`} />
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const client = makeMockContentClient()

export default async function HomePage() {
  const slot = await client.getByKey<SlotBody>('home/main', { depth: 'all' })

  return (
    <>
      {slot.components.map((item, i) => renderBlock(item, i))}

      <main style={{ padding: 'var(--site-gutter) 0' }}>
        <Container gutter>
          <Stack>
            <Typography variant="h2">Content tree (debug)</Typography>
            <Divider />
            <details>
              <summary>Resolved slot — home/main</summary>
              <pre>{JSON.stringify(slot, null, 2)}</pre>
            </details>
          </Stack>
        </Container>
      </main>
    </>
  )
}
