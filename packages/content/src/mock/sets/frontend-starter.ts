/**
 * The `frontend-starter` fixture set — introductory content mirroring the
 * repo docs, and the set a partner clones as a starting point.
 *
 * Fixtures are statically imported (not scanned from disk) so the mock works
 * in any runtime — Node Server Components, Storybook in the browser, the
 * Vercel edge runtime. Adding a fixture means adding it to the manifest below.
 *
 * On-disk shape is dc-cli enriched (`{ id, label, body }`); ADR-0008 covers
 * why, and `set.json` alongside the fixtures describes the set itself.
 */

import manifests from '../../../fixtures/frontend-starter/_hierarchy/manifests.json' with { type: 'json' }
import aboutHero from '../../../fixtures/frontend-starter/components/about-hero.json' with { type: 'json' }
import aboutMarkdown from '../../../fixtures/frontend-starter/components/about-markdown.json' with { type: 'json' }
import blogContentModellingBody from '../../../fixtures/frontend-starter/components/blog/content-modelling-body.json' with { type: 'json' }
import blogGettingStartedBody from '../../../fixtures/frontend-starter/components/blog/getting-started-body.json' with { type: 'json' }
import blogQuadraticAcceleratorBody from '../../../fixtures/frontend-starter/components/blog/quadratic-accelerator-body.json' with { type: 'json' }
import contributingHero from '../../../fixtures/frontend-starter/components/contributing-hero.json' with { type: 'json' }
import contributingMarkdown from '../../../fixtures/frontend-starter/components/contributing-markdown.json' with { type: 'json' }
import docsHero from '../../../fixtures/frontend-starter/components/docs-hero.json' with { type: 'json' }
import docsMarkdown from '../../../fixtures/frontend-starter/components/docs-markdown.json' with { type: 'json' }
import siteFooterMenuDocumentation from '../../../fixtures/frontend-starter/components/footer/site-footer-menu-documentation.json' with { type: 'json' }
import siteFooterMenuItemCommands from '../../../fixtures/frontend-starter/components/footer/site-footer-menu-item-commands.json' with { type: 'json' }
import siteFooterMenuItemContentTypes from '../../../fixtures/frontend-starter/components/footer/site-footer-menu-item-content-types.json' with { type: 'json' }
import siteFooterMenuItemContributing from '../../../fixtures/frontend-starter/components/footer/site-footer-menu-item-contributing.json' with { type: 'json' }
import siteFooterMenuItemDeploying from '../../../fixtures/frontend-starter/components/footer/site-footer-menu-item-deploying.json' with { type: 'json' }
import siteFooterMenuItemGettingStarted from '../../../fixtures/frontend-starter/components/footer/site-footer-menu-item-getting-started.json' with { type: 'json' }
import siteFooterMenuItemStorybook from '../../../fixtures/frontend-starter/components/footer/site-footer-menu-item-storybook.json' with { type: 'json' }
import siteFooterMenuItemTroubleshooting from '../../../fixtures/frontend-starter/components/footer/site-footer-menu-item-troubleshooting.json' with { type: 'json' }
import siteFooterMenuItemWorkingWithAHub from '../../../fixtures/frontend-starter/components/footer/site-footer-menu-item-working-with-a-hub.json' with { type: 'json' }
import siteFooterMenuProject from '../../../fixtures/frontend-starter/components/footer/site-footer-menu-project.json' with { type: 'json' }
import siteFooterRow1 from '../../../fixtures/frontend-starter/components/footer/site-footer-row-1.json' with { type: 'json' }
import siteFooter from '../../../fixtures/frontend-starter/components/footer/site-footer.json' with { type: 'json' }
import siteHeaderGroupIcons from '../../../fixtures/frontend-starter/components/header/site-header-group-icons.json' with { type: 'json' }
import siteHeaderRow1 from '../../../fixtures/frontend-starter/components/header/site-header-row-1.json' with { type: 'json' }
import siteHeader from '../../../fixtures/frontend-starter/components/header/site-header.json' with { type: 'json' }
import siteHierarchyMenuItemAbout from '../../../fixtures/frontend-starter/components/header/site-hierarchy-menu-item-about.json' with { type: 'json' }
import siteHierarchyMenuItemAccount from '../../../fixtures/frontend-starter/components/header/site-hierarchy-menu-item-account.json' with { type: 'json' }
import siteHierarchyMenuItemBlog from '../../../fixtures/frontend-starter/components/header/site-hierarchy-menu-item-blog.json' with { type: 'json' }
import siteHierarchyMenuItemDocsCommands from '../../../fixtures/frontend-starter/components/header/site-hierarchy-menu-item-docs-commands.json' with { type: 'json' }
import siteHierarchyMenuItemDocsContentTypes from '../../../fixtures/frontend-starter/components/header/site-hierarchy-menu-item-docs-content-types.json' with { type: 'json' }
import siteHierarchyMenuItemDocsContributing from '../../../fixtures/frontend-starter/components/header/site-hierarchy-menu-item-docs-contributing.json' with { type: 'json' }
import siteHierarchyMenuItemDocsDeploying from '../../../fixtures/frontend-starter/components/header/site-hierarchy-menu-item-docs-deploying.json' with { type: 'json' }
import siteHierarchyMenuItemDocsEditorSetup from '../../../fixtures/frontend-starter/components/header/site-hierarchy-menu-item-docs-editor-setup.json' with { type: 'json' }
import siteHierarchyMenuItemDocsGettingStarted from '../../../fixtures/frontend-starter/components/header/site-hierarchy-menu-item-docs-getting-started.json' with { type: 'json' }
import siteHierarchyMenuItemDocsStorybook from '../../../fixtures/frontend-starter/components/header/site-hierarchy-menu-item-docs-storybook.json' with { type: 'json' }
import siteHierarchyMenuItemDocsTheming from '../../../fixtures/frontend-starter/components/header/site-hierarchy-menu-item-docs-theming.json' with { type: 'json' }
import siteHierarchyMenuItemDocsTroubleshooting from '../../../fixtures/frontend-starter/components/header/site-hierarchy-menu-item-docs-troubleshooting.json' with { type: 'json' }
import siteHierarchyMenuItemDocsWorkingWithAHub from '../../../fixtures/frontend-starter/components/header/site-hierarchy-menu-item-docs-working-with-a-hub.json' with { type: 'json' }
import siteHierarchyMenuItemDocs from '../../../fixtures/frontend-starter/components/header/site-hierarchy-menu-item-docs.json' with { type: 'json' }
import siteHierarchyMenuItemStores from '../../../fixtures/frontend-starter/components/header/site-hierarchy-menu-item-stores.json' with { type: 'json' }
import siteHierarchyMenuMain from '../../../fixtures/frontend-starter/components/header/site-hierarchy-menu-main.json' with { type: 'json' }
import siteIconButtonCart from '../../../fixtures/frontend-starter/components/header/site-icon-button-cart.json' with { type: 'json' }
import siteIconButtonLocation from '../../../fixtures/frontend-starter/components/header/site-icon-button-location.json' with { type: 'json' }
import siteIconButtonUser from '../../../fixtures/frontend-starter/components/header/site-icon-button-user.json' with { type: 'json' }
import siteLocaleSelector from '../../../fixtures/frontend-starter/components/header/site-locale-selector.json' with { type: 'json' }
import siteLogo from '../../../fixtures/frontend-starter/components/header/site-logo.json' with { type: 'json' }
import siteMenuItemAbout from '../../../fixtures/frontend-starter/components/header/site-menu-item-about.json' with { type: 'json' }
import siteMenuItemBlog from '../../../fixtures/frontend-starter/components/header/site-menu-item-blog.json' with { type: 'json' }
import siteMenuItemDocsCommands from '../../../fixtures/frontend-starter/components/header/site-menu-item-docs-commands.json' with { type: 'json' }
import siteMenuItemDocsContentTypes from '../../../fixtures/frontend-starter/components/header/site-menu-item-docs-content-types.json' with { type: 'json' }
import siteMenuItemDocsContributing from '../../../fixtures/frontend-starter/components/header/site-menu-item-docs-contributing.json' with { type: 'json' }
import siteMenuItemDocsDeploying from '../../../fixtures/frontend-starter/components/header/site-menu-item-docs-deploying.json' with { type: 'json' }
import siteMenuItemDocsEditorSetup from '../../../fixtures/frontend-starter/components/header/site-menu-item-docs-editor-setup.json' with { type: 'json' }
import siteMenuItemDocsGettingStarted from '../../../fixtures/frontend-starter/components/header/site-menu-item-docs-getting-started.json' with { type: 'json' }
import siteMenuItemDocsStorybook from '../../../fixtures/frontend-starter/components/header/site-menu-item-docs-storybook.json' with { type: 'json' }
import siteMenuItemDocsTheming from '../../../fixtures/frontend-starter/components/header/site-menu-item-docs-theming.json' with { type: 'json' }
import siteMenuItemDocsTroubleshooting from '../../../fixtures/frontend-starter/components/header/site-menu-item-docs-troubleshooting.json' with { type: 'json' }
import siteMenuItemDocsWorkingWithAHub from '../../../fixtures/frontend-starter/components/header/site-menu-item-docs-working-with-a-hub.json' with { type: 'json' }
import siteMenuItemDocs from '../../../fixtures/frontend-starter/components/header/site-menu-item-docs.json' with { type: 'json' }
import siteMenuMain from '../../../fixtures/frontend-starter/components/header/site-menu-main.json' with { type: 'json' }
import siteMenuToggleButton from '../../../fixtures/frontend-starter/components/header/site-menu-toggle-button.json' with { type: 'json' }
import homeBenefits from '../../../fixtures/frontend-starter/components/home-benefits.json' with { type: 'json' }
import homeColumns2 from '../../../fixtures/frontend-starter/components/home-columns-2.json' with { type: 'json' }
import homeColumnsImage from '../../../fixtures/frontend-starter/components/home-columns-image.json' with { type: 'json' }
import homeColumnsMarkdown from '../../../fixtures/frontend-starter/components/home-columns-markdown.json' with { type: 'json' }
import homeColumns from '../../../fixtures/frontend-starter/components/home-columns.json' with { type: 'json' }
import homeGuideCardContributing from '../../../fixtures/frontend-starter/components/home-guide-card-contributing.json' with { type: 'json' }
import homeGuideCardDeploying from '../../../fixtures/frontend-starter/components/home-guide-card-deploying.json' with { type: 'json' }
import homeGuideCardEditorSetup from '../../../fixtures/frontend-starter/components/home-guide-card-editor-setup.json' with { type: 'json' }
import homeGuideCardGettingStarted from '../../../fixtures/frontend-starter/components/home-guide-card-getting-started.json' with { type: 'json' }
import homeGuideCardStorybook from '../../../fixtures/frontend-starter/components/home-guide-card-storybook.json' with { type: 'json' }
import homeGuideCardTheming from '../../../fixtures/frontend-starter/components/home-guide-card-theming.json' with { type: 'json' }
import homeGuideCardTroubleshooting from '../../../fixtures/frontend-starter/components/home-guide-card-troubleshooting.json' with { type: 'json' }
import homeGuideCardWorkingWithAHub from '../../../fixtures/frontend-starter/components/home-guide-card-working-with-a-hub.json' with { type: 'json' }
import homeGuides from '../../../fixtures/frontend-starter/components/home-guides.json' with { type: 'json' }
import homeHero from '../../../fixtures/frontend-starter/components/home-hero.json' with { type: 'json' }
import homeIntroImage from '../../../fixtures/frontend-starter/components/home-intro-image.json' with { type: 'json' }
import homeIntro from '../../../fixtures/frontend-starter/components/home-intro.json' with { type: 'json' }
import homeMarkdown from '../../../fixtures/frontend-starter/components/home-markdown.json' with { type: 'json' }
import homeMediaCard1 from '../../../fixtures/frontend-starter/components/home-media-card-1.json' with { type: 'json' }
import homeMediaCard2 from '../../../fixtures/frontend-starter/components/home-media-card-2.json' with { type: 'json' }
import homeMediaCard3 from '../../../fixtures/frontend-starter/components/home-media-card-3.json' with { type: 'json' }
import homeMediaCard4 from '../../../fixtures/frontend-starter/components/home-media-card-4.json' with { type: 'json' }
import homeMediaCard5 from '../../../fixtures/frontend-starter/components/home-media-card-5.json' with { type: 'json' }
import mediaVideoAmbient from '../../../fixtures/frontend-starter/components/media/video-ambient.json' with { type: 'json' }
import mediaVideoPlayer from '../../../fixtures/frontend-starter/components/media/video-player.json' with { type: 'json' }
import notFoundHero from '../../../fixtures/frontend-starter/components/not-found-hero.json' with { type: 'json' }
import aboutPage from '../../../fixtures/frontend-starter/pages/about.json' with { type: 'json' }
import blogContentModellingPage from '../../../fixtures/frontend-starter/pages/blog/content-modelling.json' with { type: 'json' }
import blogGettingStartedPage from '../../../fixtures/frontend-starter/pages/blog/getting-started.json' with { type: 'json' }
import blogQuadraticAcceleratorPage from '../../../fixtures/frontend-starter/pages/blog/quadratic-accelerator.json' with { type: 'json' }
import contributingPage from '../../../fixtures/frontend-starter/pages/contributing.json' with { type: 'json' }
import docsPage from '../../../fixtures/frontend-starter/pages/docs.json' with { type: 'json' }
import homePage from '../../../fixtures/frontend-starter/pages/home.json' with { type: 'json' }
import siteCustomCss from '../../../fixtures/frontend-starter/site-components/custom-css.json' with { type: 'json' }
import aboutMainSlot from '../../../fixtures/frontend-starter/slots/about-main.json' with { type: 'json' }
import blogContentModellingMainSlot from '../../../fixtures/frontend-starter/slots/blog-content-modelling-main.json' with { type: 'json' }
import blogGettingStartedMainSlot from '../../../fixtures/frontend-starter/slots/blog-getting-started-main.json' with { type: 'json' }
import blogQuadraticAcceleratorMainSlot from '../../../fixtures/frontend-starter/slots/blog-quadratic-accelerator-main.json' with { type: 'json' }
import contributingMainSlot from '../../../fixtures/frontend-starter/slots/contributing-main.json' with { type: 'json' }
import docsMainSlot from '../../../fixtures/frontend-starter/slots/docs-main.json' with { type: 'json' }
import homeMainSlot from '../../../fixtures/frontend-starter/slots/home-main.json' with { type: 'json' }
import notFoundMainSlot from '../../../fixtures/frontend-starter/slots/not-found-main.json' with { type: 'json' }
import type { EnrichedContentItem } from '../../types'
import { docsFixtures } from '../docs.generated'
import type { FixtureSet } from '../set'

/**
 * The full set of fixtures the mock can return. Order is not significant.
 *
 * The `as EnrichedContentItem` cast is the structural promise we make to the
 * type system; each JSON file is hand-authored to satisfy it. If we ever
 * generate fixtures or accept user-provided ones, this is the boundary to add
 * runtime validation at.
 */
const fixtures: readonly EnrichedContentItem[] = [
  siteHeader,
  siteHeaderRow1,
  siteLogo,
  siteIconButtonLocation,
  siteIconButtonUser,
  siteIconButtonCart,
  siteHeaderGroupIcons,
  siteMenuToggleButton,
  siteLocaleSelector,
  siteMenuMain,
  siteHierarchyMenuMain,
  siteHierarchyMenuItemBlog,
  siteHierarchyMenuItemAbout,
  siteHierarchyMenuItemDocs,
  siteHierarchyMenuItemDocsGettingStarted,
  siteHierarchyMenuItemDocsStorybook,
  siteHierarchyMenuItemDocsContentTypes,
  siteHierarchyMenuItemDocsWorkingWithAHub,
  siteHierarchyMenuItemDocsCommands,
  siteHierarchyMenuItemDocsDeploying,
  siteHierarchyMenuItemDocsTheming,
  siteHierarchyMenuItemDocsEditorSetup,
  siteHierarchyMenuItemDocsTroubleshooting,
  siteHierarchyMenuItemDocsContributing,
  siteHierarchyMenuItemStores,
  siteHierarchyMenuItemAccount,
  siteMenuItemBlog,
  siteMenuItemAbout,
  siteMenuItemDocs,
  siteMenuItemDocsGettingStarted,
  siteMenuItemDocsStorybook,
  siteMenuItemDocsContentTypes,
  siteMenuItemDocsWorkingWithAHub,
  siteMenuItemDocsCommands,
  siteMenuItemDocsDeploying,
  siteMenuItemDocsTheming,
  siteMenuItemDocsEditorSetup,
  siteMenuItemDocsTroubleshooting,
  siteMenuItemDocsContributing,
  siteFooter,
  siteFooterMenuDocumentation,
  siteFooterMenuProject,
  siteFooterMenuItemGettingStarted,
  siteFooterMenuItemWorkingWithAHub,
  siteFooterMenuItemCommands,
  siteFooterMenuItemDeploying,
  siteFooterMenuItemContributing,
  siteFooterMenuItemContentTypes,
  siteFooterMenuItemStorybook,
  siteFooterMenuItemTroubleshooting,
  siteFooterRow1,
  siteCustomCss,
  notFoundMainSlot,
  notFoundHero,
  homePage,
  homeMainSlot,
  homeHero,
  homeBenefits,
  homeIntro,
  homeIntroImage,
  homeColumns,
  homeColumns2,
  homeColumnsImage,
  homeColumnsMarkdown,
  homeMarkdown,
  homeMediaCard1,
  homeMediaCard2,
  homeMediaCard3,
  homeMediaCard4,
  homeMediaCard5,
  // Standalone video examples — not placed on a page; drop them into a slot
  // to see them rendered.
  mediaVideoPlayer,
  mediaVideoAmbient,
  homeGuides,
  homeGuideCardGettingStarted,
  homeGuideCardWorkingWithAHub,
  homeGuideCardEditorSetup,
  homeGuideCardStorybook,
  homeGuideCardTheming,
  homeGuideCardDeploying,
  homeGuideCardTroubleshooting,
  homeGuideCardContributing,
  aboutPage,
  aboutMainSlot,
  aboutHero,
  aboutMarkdown,
  contributingPage,
  contributingMainSlot,
  contributingHero,
  contributingMarkdown,
  docsPage,
  docsMainSlot,
  docsHero,
  docsMarkdown,
  ...docsFixtures,
  blogGettingStartedPage,
  blogGettingStartedMainSlot,
  blogGettingStartedBody,
  blogQuadraticAcceleratorPage,
  blogQuadraticAcceleratorMainSlot,
  blogQuadraticAcceleratorBody,
  blogContentModellingPage,
  blogContentModellingMainSlot,
  blogContentModellingBody,
]

export const frontendStarterSet: FixtureSet = {
  name: 'frontend-starter',
  fixtures,
  hierarchies: manifests,
}
