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

import aboutHero from '../../fixtures/base-site/components/about-hero.json' with { type: 'json' }
import aboutMarkdown from '../../fixtures/base-site/components/about-markdown.json' with { type: 'json' }
import blogContentModellingBody from '../../fixtures/base-site/components/blog/content-modelling-body.json' with { type: 'json' }
import blogGettingStartedBody from '../../fixtures/base-site/components/blog/getting-started-body.json' with { type: 'json' }
import blogQuadraticAcceleratorBody from '../../fixtures/base-site/components/blog/quadratic-accelerator-body.json' with { type: 'json' }
import contributingHero from '../../fixtures/base-site/components/contributing-hero.json' with { type: 'json' }
import contributingMarkdown from '../../fixtures/base-site/components/contributing-markdown.json' with { type: 'json' }
import docsHero from '../../fixtures/base-site/components/docs-hero.json' with { type: 'json' }
import docsMarkdown from '../../fixtures/base-site/components/docs-markdown.json' with { type: 'json' }
import siteFooterMenuCompany from '../../fixtures/base-site/components/footer/site-footer-menu-company.json' with { type: 'json' }
import siteFooterMenuDelivery from '../../fixtures/base-site/components/footer/site-footer-menu-delivery.json' with { type: 'json' }
import siteFooterMenuHelp from '../../fixtures/base-site/components/footer/site-footer-menu-help.json' with { type: 'json' }
import siteFooterMenuItemCompanyCareers from '../../fixtures/base-site/components/footer/site-footer-menu-item-company-careers.json' with { type: 'json' }
import siteFooterMenuItemCompanyFaqs from '../../fixtures/base-site/components/footer/site-footer-menu-item-company-faqs.json' with { type: 'json' }
import siteFooterMenuItemCompanyModernSlavery from '../../fixtures/base-site/components/footer/site-footer-menu-item-company-modern-slavery.json' with { type: 'json' }
import siteFooterMenuItemCompanyStory from '../../fixtures/base-site/components/footer/site-footer-menu-item-company-story.json' with { type: 'json' }
import siteFooterMenuItemCompanySustainability from '../../fixtures/base-site/components/footer/site-footer-menu-item-company-sustainability.json' with { type: 'json' }
import siteFooterMenuItemCompany from '../../fixtures/base-site/components/footer/site-footer-menu-item-company.json' with { type: 'json' }
import siteFooterMenuItemDeliveryCollection from '../../fixtures/base-site/components/footer/site-footer-menu-item-delivery-collection.json' with { type: 'json' }
import siteFooterMenuItemDeliveryInternational from '../../fixtures/base-site/components/footer/site-footer-menu-item-delivery-international.json' with { type: 'json' }
import siteFooterMenuItemDeliveryReturns from '../../fixtures/base-site/components/footer/site-footer-menu-item-delivery-returns.json' with { type: 'json' }
import siteFooterMenuItemDeliveryTrack from '../../fixtures/base-site/components/footer/site-footer-menu-item-delivery-track.json' with { type: 'json' }
import siteFooterMenuItemDelivery from '../../fixtures/base-site/components/footer/site-footer-menu-item-delivery.json' with { type: 'json' }
import siteFooterMenuItemHelpContact from '../../fixtures/base-site/components/footer/site-footer-menu-item-help-contact.json' with { type: 'json' }
import siteFooterMenuItemHelpCustomerServices from '../../fixtures/base-site/components/footer/site-footer-menu-item-help-customer-services.json' with { type: 'json' }
import siteFooterMenuItemHelpServices from '../../fixtures/base-site/components/footer/site-footer-menu-item-help-services.json' with { type: 'json' }
import siteFooterMenuItemHelpStores from '../../fixtures/base-site/components/footer/site-footer-menu-item-help-stores.json' with { type: 'json' }
import siteFooterMenuItemHelp from '../../fixtures/base-site/components/footer/site-footer-menu-item-help.json' with { type: 'json' }
import siteFooterMenuItemShoppingApps from '../../fixtures/base-site/components/footer/site-footer-menu-item-shopping-apps.json' with { type: 'json' }
import siteFooterMenuItemShoppingBlackFriday from '../../fixtures/base-site/components/footer/site-footer-menu-item-shopping-black-friday.json' with { type: 'json' }
import siteFooterMenuItemShoppingBrands from '../../fixtures/base-site/components/footer/site-footer-menu-item-shopping-brands.json' with { type: 'json' }
import siteFooterMenuItemShoppingCookies from '../../fixtures/base-site/components/footer/site-footer-menu-item-shopping-cookies.json' with { type: 'json' }
import siteFooterMenuItemShoppingGiftCards from '../../fixtures/base-site/components/footer/site-footer-menu-item-shopping-gift-cards.json' with { type: 'json' }
import siteFooterMenuItemShoppingPrivacy from '../../fixtures/base-site/components/footer/site-footer-menu-item-shopping-privacy.json' with { type: 'json' }
import siteFooterMenuItemShoppingSecure from '../../fixtures/base-site/components/footer/site-footer-menu-item-shopping-secure.json' with { type: 'json' }
import siteFooterMenuItemShoppingTerms from '../../fixtures/base-site/components/footer/site-footer-menu-item-shopping-terms.json' with { type: 'json' }
import siteFooterMenuItemShopping from '../../fixtures/base-site/components/footer/site-footer-menu-item-shopping.json' with { type: 'json' }
import siteFooterMenuShopping from '../../fixtures/base-site/components/footer/site-footer-menu-shopping.json' with { type: 'json' }
import siteFooterRow1 from '../../fixtures/base-site/components/footer/site-footer-row-1.json' with { type: 'json' }
import siteFooter from '../../fixtures/base-site/components/footer/site-footer.json' with { type: 'json' }
import siteHeaderGroupIcons from '../../fixtures/base-site/components/header/site-header-group-icons.json' with { type: 'json' }
import siteHeaderRow1 from '../../fixtures/base-site/components/header/site-header-row-1.json' with { type: 'json' }
import siteHeaderRow2 from '../../fixtures/base-site/components/header/site-header-row-2.json' with { type: 'json' }
import siteHeader from '../../fixtures/base-site/components/header/site-header.json' with { type: 'json' }
import siteHierarchyMenuItemAbout from '../../fixtures/base-site/components/header/site-hierarchy-menu-item-about.json' with { type: 'json' }
import siteHierarchyMenuItemAccount from '../../fixtures/base-site/components/header/site-hierarchy-menu-item-account.json' with { type: 'json' }
import siteHierarchyMenuItemBlog from '../../fixtures/base-site/components/header/site-hierarchy-menu-item-blog.json' with { type: 'json' }
import siteHierarchyMenuItemDocs from '../../fixtures/base-site/components/header/site-hierarchy-menu-item-docs.json' with { type: 'json' }
import siteHierarchyMenuItemKidsBaby from '../../fixtures/base-site/components/header/site-hierarchy-menu-item-kids-baby.json' with { type: 'json' }
import siteHierarchyMenuItemKidsBoys from '../../fixtures/base-site/components/header/site-hierarchy-menu-item-kids-boys.json' with { type: 'json' }
import siteHierarchyMenuItemKidsGirls from '../../fixtures/base-site/components/header/site-hierarchy-menu-item-kids-girls.json' with { type: 'json' }
import siteHierarchyMenuItemKids from '../../fixtures/base-site/components/header/site-hierarchy-menu-item-kids.json' with { type: 'json' }
import siteHierarchyMenuItemMensJackets from '../../fixtures/base-site/components/header/site-hierarchy-menu-item-mens-jackets.json' with { type: 'json' }
import siteHierarchyMenuItemMensShirts from '../../fixtures/base-site/components/header/site-hierarchy-menu-item-mens-shirts.json' with { type: 'json' }
import siteHierarchyMenuItemMensTrousers from '../../fixtures/base-site/components/header/site-hierarchy-menu-item-mens-trousers.json' with { type: 'json' }
import siteHierarchyMenuItemMens from '../../fixtures/base-site/components/header/site-hierarchy-menu-item-mens.json' with { type: 'json' }
import siteHierarchyMenuItemStores from '../../fixtures/base-site/components/header/site-hierarchy-menu-item-stores.json' with { type: 'json' }
import siteHierarchyMenuItemWomensAccessories from '../../fixtures/base-site/components/header/site-hierarchy-menu-item-womens-accessories.json' with { type: 'json' }
import siteHierarchyMenuItemWomensDresses from '../../fixtures/base-site/components/header/site-hierarchy-menu-item-womens-dresses.json' with { type: 'json' }
import siteHierarchyMenuItemWomensTops from '../../fixtures/base-site/components/header/site-hierarchy-menu-item-womens-tops.json' with { type: 'json' }
import siteHierarchyMenuItemWomens from '../../fixtures/base-site/components/header/site-hierarchy-menu-item-womens.json' with { type: 'json' }
import siteHierarchyMenuMain from '../../fixtures/base-site/components/header/site-hierarchy-menu-main.json' with { type: 'json' }
import siteIconButtonCart from '../../fixtures/base-site/components/header/site-icon-button-cart.json' with { type: 'json' }
import siteIconButtonLocation from '../../fixtures/base-site/components/header/site-icon-button-location.json' with { type: 'json' }
import siteIconButtonUser from '../../fixtures/base-site/components/header/site-icon-button-user.json' with { type: 'json' }
import siteLocaleSelector from '../../fixtures/base-site/components/header/site-locale-selector.json' with { type: 'json' }
import siteLogo from '../../fixtures/base-site/components/header/site-logo.json' with { type: 'json' }
import siteMenuItemAbout from '../../fixtures/base-site/components/header/site-menu-item-about.json' with { type: 'json' }
import siteMenuItemBlog from '../../fixtures/base-site/components/header/site-menu-item-blog.json' with { type: 'json' }
import siteMenuItemDocs from '../../fixtures/base-site/components/header/site-menu-item-docs.json' with { type: 'json' }
import siteMenuItemKidsBaby from '../../fixtures/base-site/components/header/site-menu-item-kids-baby.json' with { type: 'json' }
import siteMenuItemKidsBoys from '../../fixtures/base-site/components/header/site-menu-item-kids-boys.json' with { type: 'json' }
import siteMenuItemKidsGirls from '../../fixtures/base-site/components/header/site-menu-item-kids-girls.json' with { type: 'json' }
import siteMenuItemKids from '../../fixtures/base-site/components/header/site-menu-item-kids.json' with { type: 'json' }
import siteMenuItemMensJackets from '../../fixtures/base-site/components/header/site-menu-item-mens-jackets.json' with { type: 'json' }
import siteMenuItemMensShirts from '../../fixtures/base-site/components/header/site-menu-item-mens-shirts.json' with { type: 'json' }
import siteMenuItemMensTrousers from '../../fixtures/base-site/components/header/site-menu-item-mens-trousers.json' with { type: 'json' }
import siteMenuItemMens from '../../fixtures/base-site/components/header/site-menu-item-mens.json' with { type: 'json' }
import siteMenuItemWomensAccessories from '../../fixtures/base-site/components/header/site-menu-item-womens-accessories.json' with { type: 'json' }
import siteMenuItemWomensDresses from '../../fixtures/base-site/components/header/site-menu-item-womens-dresses.json' with { type: 'json' }
import siteMenuItemWomensTops from '../../fixtures/base-site/components/header/site-menu-item-womens-tops.json' with { type: 'json' }
import siteMenuItemWomens from '../../fixtures/base-site/components/header/site-menu-item-womens.json' with { type: 'json' }
import siteMenuMain from '../../fixtures/base-site/components/header/site-menu-main.json' with { type: 'json' }
import siteMenuToggleButton from '../../fixtures/base-site/components/header/site-menu-toggle-button.json' with { type: 'json' }
import homeColumns2 from '../../fixtures/base-site/components/home-columns-2.json' with { type: 'json' }
import homeColumnsImage from '../../fixtures/base-site/components/home-columns-image.json' with { type: 'json' }
import homeColumnsMarkdown from '../../fixtures/base-site/components/home-columns-markdown.json' with { type: 'json' }
import homeColumns from '../../fixtures/base-site/components/home-columns.json' with { type: 'json' }
import homeGrid from '../../fixtures/base-site/components/home-grid.json' with { type: 'json' }
import homeHero from '../../fixtures/base-site/components/home-hero.json' with { type: 'json' }
import homeImage from '../../fixtures/base-site/components/home-image.json' with { type: 'json' }
import homeIntroImage from '../../fixtures/base-site/components/home-intro-image.json' with { type: 'json' }
import homeIntro from '../../fixtures/base-site/components/home-intro.json' with { type: 'json' }
import homeMarkdown from '../../fixtures/base-site/components/home-markdown.json' with { type: 'json' }
import homeMediaCard1 from '../../fixtures/base-site/components/home-media-card-1.json' with { type: 'json' }
import homeMediaCard2 from '../../fixtures/base-site/components/home-media-card-2.json' with { type: 'json' }
import homeMediaCard3 from '../../fixtures/base-site/components/home-media-card-3.json' with { type: 'json' }
import homeMediaCard4 from '../../fixtures/base-site/components/home-media-card-4.json' with { type: 'json' }
import homeMediaCard5 from '../../fixtures/base-site/components/home-media-card-5.json' with { type: 'json' }
import notFoundHero from '../../fixtures/base-site/components/not-found-hero.json' with { type: 'json' }
import aboutPage from '../../fixtures/base-site/pages/about.json' with { type: 'json' }
import blogContentModellingPage from '../../fixtures/base-site/pages/blog/content-modelling.json' with { type: 'json' }
import blogGettingStartedPage from '../../fixtures/base-site/pages/blog/getting-started.json' with { type: 'json' }
import blogQuadraticAcceleratorPage from '../../fixtures/base-site/pages/blog/quadratic-accelerator.json' with { type: 'json' }
import contributingPage from '../../fixtures/base-site/pages/contributing.json' with { type: 'json' }
import docsPage from '../../fixtures/base-site/pages/docs.json' with { type: 'json' }
import homePage from '../../fixtures/base-site/pages/home.json' with { type: 'json' }
import siteCustomCss from '../../fixtures/base-site/site-components/custom-css.json' with { type: 'json' }
import aboutMainSlot from '../../fixtures/base-site/slots/about-main.json' with { type: 'json' }
import blogContentModellingMainSlot from '../../fixtures/base-site/slots/blog-content-modelling-main.json' with { type: 'json' }
import blogGettingStartedMainSlot from '../../fixtures/base-site/slots/blog-getting-started-main.json' with { type: 'json' }
import blogQuadraticAcceleratorMainSlot from '../../fixtures/base-site/slots/blog-quadratic-accelerator-main.json' with { type: 'json' }
import contributingMainSlot from '../../fixtures/base-site/slots/contributing-main.json' with { type: 'json' }
import docsMainSlot from '../../fixtures/base-site/slots/docs-main.json' with { type: 'json' }
import homeMainSlot from '../../fixtures/base-site/slots/home-main.json' with { type: 'json' }
import notFoundMainSlot from '../../fixtures/base-site/slots/not-found-main.json' with { type: 'json' }
import type { EnrichedContentItem } from '../types'
import { docsFixtures } from './docs.generated'

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
  siteHeaderRow2,
  siteLogo,
  siteIconButtonLocation,
  siteIconButtonUser,
  siteIconButtonCart,
  siteHeaderGroupIcons,
  siteMenuToggleButton,
  siteLocaleSelector,
  siteMenuMain,
  siteHierarchyMenuMain,
  siteHierarchyMenuItemMens,
  siteHierarchyMenuItemMensShirts,
  siteHierarchyMenuItemMensTrousers,
  siteHierarchyMenuItemMensJackets,
  siteHierarchyMenuItemWomens,
  siteHierarchyMenuItemWomensDresses,
  siteHierarchyMenuItemWomensTops,
  siteHierarchyMenuItemWomensAccessories,
  siteHierarchyMenuItemKids,
  siteHierarchyMenuItemKidsBoys,
  siteHierarchyMenuItemKidsGirls,
  siteHierarchyMenuItemKidsBaby,
  siteHierarchyMenuItemBlog,
  siteHierarchyMenuItemAbout,
  siteHierarchyMenuItemDocs,
  siteHierarchyMenuItemStores,
  siteHierarchyMenuItemAccount,
  siteMenuItemMens,
  siteMenuItemMensShirts,
  siteMenuItemMensTrousers,
  siteMenuItemMensJackets,
  siteMenuItemWomens,
  siteMenuItemWomensDresses,
  siteMenuItemWomensTops,
  siteMenuItemWomensAccessories,
  siteMenuItemKids,
  siteMenuItemKidsBoys,
  siteMenuItemKidsGirls,
  siteMenuItemKidsBaby,
  siteMenuItemBlog,
  siteMenuItemAbout,
  siteMenuItemDocs,
  siteFooter,
  siteFooterRow1,
  siteFooterMenuDelivery,
  siteFooterMenuHelp,
  siteFooterMenuShopping,
  siteFooterMenuCompany,
  siteFooterMenuItemDelivery,
  siteFooterMenuItemDeliveryTrack,
  siteFooterMenuItemDeliveryCollection,
  siteFooterMenuItemDeliveryReturns,
  siteFooterMenuItemDeliveryInternational,
  siteFooterMenuItemHelp,
  siteFooterMenuItemHelpCustomerServices,
  siteFooterMenuItemHelpContact,
  siteFooterMenuItemHelpStores,
  siteFooterMenuItemHelpServices,
  siteFooterMenuItemShopping,
  siteFooterMenuItemShoppingGiftCards,
  siteFooterMenuItemShoppingBrands,
  siteFooterMenuItemShoppingTerms,
  siteFooterMenuItemShoppingSecure,
  siteFooterMenuItemShoppingPrivacy,
  siteFooterMenuItemShoppingCookies,
  siteFooterMenuItemShoppingApps,
  siteFooterMenuItemShoppingBlackFriday,
  siteFooterMenuItemCompany,
  siteFooterMenuItemCompanyStory,
  siteFooterMenuItemCompanyCareers,
  siteFooterMenuItemCompanySustainability,
  siteFooterMenuItemCompanyModernSlavery,
  siteFooterMenuItemCompanyFaqs,
  siteCustomCss,
  notFoundMainSlot,
  notFoundHero,
  homePage,
  homeMainSlot,
  homeHero,
  homeImage,
  homeGrid,
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

/** Lookup by delivery key (e.g. `"base-site/homepage"`). Undefined when no fixture matches. */
export const findByKey = (key: string): EnrichedContentItem | undefined => maps.byKey.get(key)

/** All loaded fixtures, for tests and introspection. */
export const allFixtures = (): readonly EnrichedContentItem[] => fixtures
