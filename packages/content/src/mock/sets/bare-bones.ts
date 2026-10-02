/**
 * The `bare-bones` fixture set — the minimum a site needs.
 *
 * A header and footer (one logo each) and a homepage with a single block. No
 * navigation hierarchy: a starting point to build on, not a demo.
 *
 * Fixtures are statically imported for the same reason as the other sets; see
 * `./frontend-starter.ts`.
 */

import siteFooterRow1 from '../../../fixtures/bare-bones/components/footer/site-footer-row-1.json' with { type: 'json' }
import siteFooter from '../../../fixtures/bare-bones/components/footer/site-footer.json' with { type: 'json' }
import siteHeaderRow1 from '../../../fixtures/bare-bones/components/header/site-header-row-1.json' with { type: 'json' }
import siteHeader from '../../../fixtures/bare-bones/components/header/site-header.json' with { type: 'json' }
import siteLogo from '../../../fixtures/bare-bones/components/header/site-logo.json' with { type: 'json' }
import homeMarkdown from '../../../fixtures/bare-bones/components/home-markdown.json' with { type: 'json' }
import home from '../../../fixtures/bare-bones/pages/home.json' with { type: 'json' }
import homeMain from '../../../fixtures/bare-bones/slots/home-main.json' with { type: 'json' }
import type { EnrichedContentItem } from '../../types'
import type { FixtureSet } from '../set'

const fixtures: readonly EnrichedContentItem[] = [
  siteFooterRow1,
  siteFooter,
  siteHeaderRow1,
  siteHeader,
  siteLogo,
  homeMarkdown,
  home,
  homeMain,
]

export const bareBonesSet: FixtureSet = {
  name: 'bare-bones',
  fixtures,
  hierarchies: {},
}
