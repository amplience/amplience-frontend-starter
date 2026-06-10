/**
 * Loads the base-site fixtures at import time and builds lookup maps.
 *
 * Fixtures are statically imported (not scanned from disk) so the mock works
 * in any runtime — Node Server Components, Storybook in the browser, the
 * Vercel edge runtime. Adding a fixture means adding it to the manifest below.
 *
 * On-disk shape is dc-cli enriched (`{ id, label, body }`); see
 * `../../fixtures/base-site/README.md` for the format and ADR-0008 for why.
 */

import homeColumnsImage from '../../fixtures/base-site/components/home-columns-image.json' with { type: 'json' }
import homeColumnsMarkdown from '../../fixtures/base-site/components/home-columns-markdown.json' with { type: 'json' }
import homeColumns from '../../fixtures/base-site/components/home-columns.json' with { type: 'json' }
import homeGrid from '../../fixtures/base-site/components/home-grid.json' with { type: 'json' }
import homeHero from '../../fixtures/base-site/components/home-hero.json' with { type: 'json' }
import homeImage from '../../fixtures/base-site/components/home-image.json' with { type: 'json' }
import homeMarkdown from '../../fixtures/base-site/components/home-markdown.json' with { type: 'json' }
import homeMediaCard1 from '../../fixtures/base-site/components/home-media-card-1.json' with { type: 'json' }
import homeMediaCard2 from '../../fixtures/base-site/components/home-media-card-2.json' with { type: 'json' }
import homeMediaCard3 from '../../fixtures/base-site/components/home-media-card-3.json' with { type: 'json' }
import homeMediaCard4 from '../../fixtures/base-site/components/home-media-card-4.json' with { type: 'json' }
import homeMediaCard5 from '../../fixtures/base-site/components/home-media-card-5.json' with { type: 'json' }
import homePage from '../../fixtures/base-site/pages/home.json' with { type: 'json' }
import homeMainSlot from '../../fixtures/base-site/slots/home-main.json' with { type: 'json' }
import type { EnrichedContentItem } from '../types'

/**
 * The full set of fixtures the mock can return. Order is not significant.
 *
 * The `as EnrichedContentItem` cast is the structural promise we make to the
 * type system; each JSON file is hand-authored to satisfy it. If we ever
 * generate fixtures or accept user-provided ones, this is the boundary to add
 * runtime validation at.
 */
const fixtures: readonly EnrichedContentItem[] = [
  homePage,
  homeMainSlot,
  homeHero,
  homeImage,
  homeGrid,
  homeColumns,
  homeColumnsImage,
  homeColumnsMarkdown,
  homeMarkdown,
  homeMediaCard1,
  homeMediaCard2,
  homeMediaCard3,
  homeMediaCard4,
  homeMediaCard5,
]

/** Build `id → item` and `deliveryKey → item` maps from the fixture set. */
const buildMaps = (
  items: readonly EnrichedContentItem[],
): {
  readonly byId: ReadonlyMap<string, EnrichedContentItem>
  readonly byKey: ReadonlyMap<string, EnrichedContentItem>
} => {
  const byId = new Map<string, EnrichedContentItem>()
  const byKey = new Map<string, EnrichedContentItem>()
  for (const item of items) {
    byId.set(item.id, item)
    const keys = item.body._meta.deliveryKeys?.values ?? []
    for (const k of keys) byKey.set(k.value, item)
  }
  return { byId, byKey }
}

const maps = buildMaps(fixtures)

/** Lookup by delivery ID (UUID). Undefined when no fixture matches. */
export const findById = (id: string): EnrichedContentItem | undefined => maps.byId.get(id)

/** Lookup by delivery key (e.g. `"home"`). Undefined when no fixture matches. */
export const findByKey = (key: string): EnrichedContentItem | undefined => maps.byKey.get(key)

/** All loaded fixtures, for tests and introspection. */
export const allFixtures = (): readonly EnrichedContentItem[] => fixtures
