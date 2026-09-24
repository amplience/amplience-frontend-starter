/**
 * The `anyafinn` fixture set — Anya Finn.
 *
 * Fixtures are statically imported (not scanned from disk) so the mock works
 * in any runtime — Node Server Components, Storybook in the browser, the
 * Vercel edge runtime. Adding a fixture means adding it to the manifest below.
 *
 * On-disk shape is dc-cli enriched (`{ id, label, body }`); ADR-0008 covers
 * why, and `set.json` alongside the fixtures describes the set itself.
 */

import manifests from '../../../fixtures/anyafinn/_hierarchy/manifests.json' with { type: 'json' }
import siteFooterMenuCompany from '../../../fixtures/anyafinn/components/footer/site-footer-menu-company.json' with { type: 'json' }
import siteFooterMenuDelivery from '../../../fixtures/anyafinn/components/footer/site-footer-menu-delivery.json' with { type: 'json' }
import siteFooterMenuHelp from '../../../fixtures/anyafinn/components/footer/site-footer-menu-help.json' with { type: 'json' }
import siteFooterMenuItemCompanyCareers from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-company-careers.json' with { type: 'json' }
import siteFooterMenuItemCompanyFaqs from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-company-faqs.json' with { type: 'json' }
import siteFooterMenuItemCompanyModernSlavery from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-company-modern-slavery.json' with { type: 'json' }
import siteFooterMenuItemCompanyStory from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-company-story.json' with { type: 'json' }
import siteFooterMenuItemCompanySustainability from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-company-sustainability.json' with { type: 'json' }
import siteFooterMenuItemCompany from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-company.json' with { type: 'json' }
import siteFooterMenuItemDeliveryCollection from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-delivery-collection.json' with { type: 'json' }
import siteFooterMenuItemDeliveryInternational from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-delivery-international.json' with { type: 'json' }
import siteFooterMenuItemDeliveryReturns from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-delivery-returns.json' with { type: 'json' }
import siteFooterMenuItemDeliveryTrack from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-delivery-track.json' with { type: 'json' }
import siteFooterMenuItemDelivery from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-delivery.json' with { type: 'json' }
import siteFooterMenuItemHelpContact from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-help-contact.json' with { type: 'json' }
import siteFooterMenuItemHelpCustomerServices from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-help-customer-services.json' with { type: 'json' }
import siteFooterMenuItemHelpServices from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-help-services.json' with { type: 'json' }
import siteFooterMenuItemHelpStores from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-help-stores.json' with { type: 'json' }
import siteFooterMenuItemHelp from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-help.json' with { type: 'json' }
import siteFooterMenuItemShoppingApps from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-shopping-apps.json' with { type: 'json' }
import siteFooterMenuItemShoppingBlackFriday from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-shopping-black-friday.json' with { type: 'json' }
import siteFooterMenuItemShoppingBrands from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-shopping-brands.json' with { type: 'json' }
import siteFooterMenuItemShoppingCookies from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-shopping-cookies.json' with { type: 'json' }
import siteFooterMenuItemShoppingGiftCards from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-shopping-gift-cards.json' with { type: 'json' }
import siteFooterMenuItemShoppingPrivacy from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-shopping-privacy.json' with { type: 'json' }
import siteFooterMenuItemShoppingSecure from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-shopping-secure.json' with { type: 'json' }
import siteFooterMenuItemShoppingTerms from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-shopping-terms.json' with { type: 'json' }
import siteFooterMenuItemShopping from '../../../fixtures/anyafinn/components/footer/site-footer-menu-item-shopping.json' with { type: 'json' }
import siteFooterMenuShopping from '../../../fixtures/anyafinn/components/footer/site-footer-menu-shopping.json' with { type: 'json' }
import siteFooterRow1 from '../../../fixtures/anyafinn/components/footer/site-footer-row-1.json' with { type: 'json' }
import siteFooter from '../../../fixtures/anyafinn/components/footer/site-footer.json' with { type: 'json' }
import siteHeaderGroupIcons from '../../../fixtures/anyafinn/components/header/site-header-group-icons.json' with { type: 'json' }
import siteHeaderRow1 from '../../../fixtures/anyafinn/components/header/site-header-row-1.json' with { type: 'json' }
import siteHeaderRow2 from '../../../fixtures/anyafinn/components/header/site-header-row-2.json' with { type: 'json' }
import siteHeader from '../../../fixtures/anyafinn/components/header/site-header.json' with { type: 'json' }
import siteHierarchyMenuItemShopTheLook from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-item-shop-the-look.json' with { type: 'json' }
import siteHierarchyMenuMain from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-main.json' with { type: 'json' }
import siteIconButtonAccount from '../../../fixtures/anyafinn/components/header/site-icon-button-account.json' with { type: 'json' }
import siteIconButtonCart from '../../../fixtures/anyafinn/components/header/site-icon-button-cart.json' with { type: 'json' }
import siteLocaleSelector from '../../../fixtures/anyafinn/components/header/site-locale-selector.json' with { type: 'json' }
import siteLogo from '../../../fixtures/anyafinn/components/header/site-logo.json' with { type: 'json' }
import siteMenuToggleButton from '../../../fixtures/anyafinn/components/header/site-menu-toggle-button.json' with { type: 'json' }
import homeCardGrownUpGlitter from '../../../fixtures/anyafinn/components/home-card-grown-up-glitter.json' with { type: 'json' }
import homeCardOpulentDecadence from '../../../fixtures/anyafinn/components/home-card-opulent-decadence.json' with { type: 'json' }
import homeCardPiratecore from '../../../fixtures/anyafinn/components/home-card-piratecore.json' with { type: 'json' }
import homeHero from '../../../fixtures/anyafinn/components/home-hero.json' with { type: 'json' }
import homeShopTheLook from '../../../fixtures/anyafinn/components/home-shop-the-look.json' with { type: 'json' }
import productAuroraLoungeChairStory from '../../../fixtures/anyafinn/components/products/aurora-lounge-chair-story.json' with { type: 'json' }
import productTerraDiningTableStory from '../../../fixtures/anyafinn/components/products/terra-dining-table-story.json' with { type: 'json' }
import shopTheLookHero from '../../../fixtures/anyafinn/components/shop-the-look-hero.json' with { type: 'json' }
import shopTheLookMarkdown from '../../../fixtures/anyafinn/components/shop-the-look-markdown.json' with { type: 'json' }
import home from '../../../fixtures/anyafinn/pages/home.json' with { type: 'json' }
import productAuroraLoungeChair from '../../../fixtures/anyafinn/pages/products/aurora-lounge-chair.json' with { type: 'json' }
import productAuroraShelving from '../../../fixtures/anyafinn/pages/products/aurora-shelving.json' with { type: 'json' }
import productAuroraSideTable from '../../../fixtures/anyafinn/pages/products/aurora-side-table.json' with { type: 'json' }
import productCargoShorts from '../../../fixtures/anyafinn/pages/products/cargo-shorts.json'
import productCordPinafore from '../../../fixtures/anyafinn/pages/products/cord-pinafore.json'
import productCorduroyTrousers from '../../../fixtures/anyafinn/pages/products/corduroy-trousers.json'
import productFloralBlouse from '../../../fixtures/anyafinn/pages/products/floral-blouse.json'
import productKnittedBooties from '../../../fixtures/anyafinn/pages/products/knitted-booties.json'
import productLeatherTote from '../../../fixtures/anyafinn/pages/products/leather-tote.json'
import productLinenCampShirt from '../../../fixtures/anyafinn/pages/products/linen-camp-shirt.json'
import productLumenFloorLamp from '../../../fixtures/anyafinn/pages/products/lumen-floor-lamp.json' with { type: 'json' }
import productMaraWoolThrow from '../../../fixtures/anyafinn/pages/products/mara-hand-woven-wool-throw.json' with { type: 'json' }
import productMidiWrapDress from '../../../fixtures/anyafinn/pages/products/midi-wrap-dress.json'
import productOrganicBabygro from '../../../fixtures/anyafinn/pages/products/organic-babygro.json'
import productOxfordShirt from '../../../fixtures/anyafinn/pages/products/oxford-shirt.json'
import productPleatedSundress from '../../../fixtures/anyafinn/pages/products/pleated-sundress.json'
import productQuiltedBomber from '../../../fixtures/anyafinn/pages/products/quilted-bomber.json'
import productRibbedKnitTop from '../../../fixtures/anyafinn/pages/products/ribbed-knit-top.json'
import productSilkBlouse from '../../../fixtures/anyafinn/pages/products/silk-blouse.json'
import productSilkScarf from '../../../fixtures/anyafinn/pages/products/silk-scarf.json'
import productStripedRugbyShirt from '../../../fixtures/anyafinn/pages/products/striped-rugby-shirt.json'
import productTaperedChinos from '../../../fixtures/anyafinn/pages/products/tapered-chinos.json'
import productTerraDiningTable from '../../../fixtures/anyafinn/pages/products/terra-dining-table.json' with { type: 'json' }
import productVerdeCeramicPlanter from '../../../fixtures/anyafinn/pages/products/verde-ceramic-planter.json' with { type: 'json' }
import productWaxedFieldJacket from '../../../fixtures/anyafinn/pages/products/waxed-field-jacket.json'
import shopTheLook from '../../../fixtures/anyafinn/pages/shop-the-look.json' with { type: 'json' }
import homeMain from '../../../fixtures/anyafinn/slots/home-main.json' with { type: 'json' }
import productAuroraLoungeChairMainSlot from '../../../fixtures/anyafinn/slots/product-aurora-lounge-chair-main.json' with { type: 'json' }
import productTerraDiningTableMainSlot from '../../../fixtures/anyafinn/slots/product-terra-dining-table-main.json' with { type: 'json' }
import shopTheLookMain from '../../../fixtures/anyafinn/slots/shop-the-look-main.json' with { type: 'json' }
import type { EnrichedContentItem } from '../../types'
import type { FixtureSet } from '../set'

const fixtures: readonly EnrichedContentItem[] = [
  siteFooterMenuCompany,
  siteFooterMenuDelivery,
  siteFooterMenuHelp,
  siteFooterMenuItemCompanyCareers,
  siteFooterMenuItemCompanyFaqs,
  siteFooterMenuItemCompanyModernSlavery,
  siteFooterMenuItemCompanyStory,
  siteFooterMenuItemCompanySustainability,
  siteFooterMenuItemCompany,
  siteFooterMenuItemDeliveryCollection,
  siteFooterMenuItemDeliveryInternational,
  siteFooterMenuItemDeliveryReturns,
  siteFooterMenuItemDeliveryTrack,
  siteFooterMenuItemDelivery,
  siteFooterMenuItemHelpContact,
  siteFooterMenuItemHelpCustomerServices,
  siteFooterMenuItemHelpServices,
  siteFooterMenuItemHelpStores,
  siteFooterMenuItemHelp,
  siteFooterMenuItemShoppingApps,
  siteFooterMenuItemShoppingBlackFriday,
  siteFooterMenuItemShoppingBrands,
  siteFooterMenuItemShoppingCookies,
  siteFooterMenuItemShoppingGiftCards,
  siteFooterMenuItemShoppingPrivacy,
  siteFooterMenuItemShoppingSecure,
  siteFooterMenuItemShoppingTerms,
  siteFooterMenuItemShopping,
  siteFooterMenuShopping,
  siteFooterRow1,
  siteFooter,
  siteHeaderGroupIcons,
  siteHeaderRow1,
  siteHeaderRow2,
  siteHeader,
  siteHierarchyMenuItemShopTheLook,
  siteHierarchyMenuMain,
  siteIconButtonAccount,
  siteIconButtonCart,
  siteLocaleSelector,
  siteLogo,
  siteMenuToggleButton,
  homeCardGrownUpGlitter,
  homeCardOpulentDecadence,
  homeCardPiratecore,
  homeHero,
  homeShopTheLook,
  shopTheLookHero,
  shopTheLookMarkdown,
  home,
  shopTheLook,
  homeMain,
  shopTheLookMain,
  productAuroraLoungeChairStory,
  productTerraDiningTableStory,
  productAuroraLoungeChair,
  productAuroraShelving,
  productAuroraSideTable,
  productLumenFloorLamp,
  productMaraWoolThrow,
  productTerraDiningTable,
  productVerdeCeramicPlanter,
  productAuroraLoungeChairMainSlot,
  productTerraDiningTableMainSlot,
  productOxfordShirt,
  productLinenCampShirt,
  productTaperedChinos,
  productCorduroyTrousers,
  productWaxedFieldJacket,
  productQuiltedBomber,
  productSilkBlouse,
  productRibbedKnitTop,
  productMidiWrapDress,
  productPleatedSundress,
  productLeatherTote,
  productSilkScarf,
  productStripedRugbyShirt,
  productCargoShorts,
  productCordPinafore,
  productFloralBlouse,
  productOrganicBabygro,
  productKnittedBooties,
]

export const anyafinnSet: FixtureSet = {
  name: 'anyafinn',
  fixtures,
  hierarchies: manifests,
}
