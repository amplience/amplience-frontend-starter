/**
 * Schema manifest — every content-type schema in this package, keyed by
 * schema ID, with its dc-cli validation level.
 *
 * One list, three consumers: the fixture-validation test (every fixture body
 * must validate against its schema), the INTERIM dc-cli import scripts, and
 * eventually the automation CLI's `schemas push` (QL-58) — all walk this
 * manifest rather than globbing the filesystem, so a schema that exists on
 * disk but isn't listed here is loudly absent everywhere at once.
 *
 * The JSON files live in the layout dc-cli imports directly:
 * `content-type-schemas/<name>.json` is the registration wrapper (schemaId +
 * validation level + relative body path) and
 * `content-type-schemas/schemas/<name>.json` is the JSON Schema body.
 */

import contentColumns from '../content-type-schemas/schemas/content_columns.json'
import contentFooterRow from '../content-type-schemas/schemas/content_footer-row.json'
import contentFooter from '../content-type-schemas/schemas/content_footer.json'
import contentGrid from '../content-type-schemas/schemas/content_grid.json'
import contentHeaderGroup from '../content-type-schemas/schemas/content_header-group.json'
import contentHeaderRow from '../content-type-schemas/schemas/content_header-row.json'
import contentHeader from '../content-type-schemas/schemas/content_header.json'
import contentHero from '../content-type-schemas/schemas/content_hero.json'
import contentIconButton from '../content-type-schemas/schemas/content_icon-button.json'
import contentImage from '../content-type-schemas/schemas/content_image.json'
import contentLogo from '../content-type-schemas/schemas/content_logo.json'
import contentMarkdownBlock from '../content-type-schemas/schemas/content_markdown-block.json'
import contentMediaCard from '../content-type-schemas/schemas/content_media-card.json'
import contentMenuItem from '../content-type-schemas/schemas/content_menu-item.json'
import contentMenu from '../content-type-schemas/schemas/content_menu.json'
import contentPage from '../content-type-schemas/schemas/content_page.json'
import partialsCta from '../content-type-schemas/schemas/partials_cta.json'
import partialsImage from '../content-type-schemas/schemas/partials_image.json'
import slotsSlot from '../content-type-schemas/schemas/slots_slot.json'

/**
 * dc-cli validation levels. CONTENT_TYPE and SLOT schemas become content
 * types; PARTIAL schemas exist only to be `$ref`'d by the others.
 */
export type SchemaValidationLevel = 'CONTENT_TYPE' | 'SLOT' | 'PARTIAL'

/** One entry per schema file the package carries. */
export type SchemaManifestEntry = {
  /** The schema's `$id` — also the URI content bodies dispatch on. */
  readonly schemaId: string
  /** The parsed JSON Schema body. */
  readonly schema: Record<string, unknown>
  /** How dc-cli registers it. */
  readonly validationLevel: SchemaValidationLevel
}

const entry = (
  schema: Record<string, unknown>,
  validationLevel: SchemaValidationLevel,
): SchemaManifestEntry => ({
  schemaId: schema.$id as string,
  schema,
  validationLevel,
})

/** Every schema in the package, partials included. */
export const schemaManifest: readonly SchemaManifestEntry[] = [
  entry(partialsImage, 'PARTIAL'),
  entry(partialsCta, 'PARTIAL'),
  entry(contentPage, 'CONTENT_TYPE'),
  entry(contentHero, 'CONTENT_TYPE'),
  entry(contentMarkdownBlock, 'CONTENT_TYPE'),
  entry(contentColumns, 'CONTENT_TYPE'),
  entry(contentGrid, 'CONTENT_TYPE'),
  entry(contentMediaCard, 'CONTENT_TYPE'),
  entry(contentImage, 'CONTENT_TYPE'),
  entry(slotsSlot, 'SLOT'),
  entry(contentHeader, 'CONTENT_TYPE'),
  entry(contentHeaderRow, 'CONTENT_TYPE'),
  entry(contentHeaderGroup, 'CONTENT_TYPE'),
  entry(contentLogo, 'CONTENT_TYPE'),
  entry(contentIconButton, 'CONTENT_TYPE'),
  entry(contentMenu, 'CONTENT_TYPE'),
  entry(contentMenuItem, 'CONTENT_TYPE'),
  entry(contentFooter, 'CONTENT_TYPE'),
  entry(contentFooterRow, 'CONTENT_TYPE'),
]

/** Manifest entries that register as content types (CONTENT_TYPE + SLOT). */
export const contentTypeSchemas: readonly SchemaManifestEntry[] = schemaManifest.filter(
  (e) => e.validationLevel !== 'PARTIAL',
)

/** Look up a manifest entry by schema ID. */
export const findSchema = (schemaId: string): SchemaManifestEntry | undefined =>
  schemaManifest.find((e) => e.schemaId === schemaId)
