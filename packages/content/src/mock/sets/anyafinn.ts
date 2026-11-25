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
import blogGrownUpGlitterBody from '../../../fixtures/anyafinn/components/blog/grown-up-glitter-body.json' with { type: 'json' }
import blogGrownUpGlitterMoreLooks from '../../../fixtures/anyafinn/components/blog/grown-up-glitter-more-looks.json' with { type: 'json' }
import blogOpulentDecadenceBody from '../../../fixtures/anyafinn/components/blog/opulent-decadence-body.json' with { type: 'json' }
import blogOpulentDecadenceMoreLooks from '../../../fixtures/anyafinn/components/blog/opulent-decadence-more-looks.json' with { type: 'json' }
import blogPiratecoreBody from '../../../fixtures/anyafinn/components/blog/piratecore-body.json' with { type: 'json' }
import blogPiratecoreMoreLooks from '../../../fixtures/anyafinn/components/blog/piratecore-more-looks.json' with { type: 'json' }
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
import siteHierarchyMenuItemHomeware from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-item-homeware.json' with { type: 'json' }
import siteHierarchyMenuItemMensJackets from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-item-mens-jackets.json' with { type: 'json' }
import siteHierarchyMenuItemMensJeans from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-item-mens-jeans.json' with { type: 'json' }
import siteHierarchyMenuItemMensKnitwear from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-item-mens-knitwear.json' with { type: 'json' }
import siteHierarchyMenuItemMensShirts from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-item-mens-shirts.json' with { type: 'json' }
import siteHierarchyMenuItemMensShoes from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-item-mens-shoes.json' with { type: 'json' }
import siteHierarchyMenuItemMensTrousers from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-item-mens-trousers.json' with { type: 'json' }
import siteHierarchyMenuItemMens from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-item-mens.json' with { type: 'json' }
import siteHierarchyMenuItemSale from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-item-sale.json' with { type: 'json' }
import siteHierarchyMenuItemShopTheLook from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-item-shop-the-look.json' with { type: 'json' }
import siteHierarchyMenuItemWomensBoots from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-item-womens-boots.json' with { type: 'json' }
import siteHierarchyMenuItemWomensJackets from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-item-womens-jackets.json' with { type: 'json' }
import siteHierarchyMenuItemWomensJeans from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-item-womens-jeans.json' with { type: 'json' }
import siteHierarchyMenuItemWomensKnitwear from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-item-womens-knitwear.json' with { type: 'json' }
import siteHierarchyMenuItemWomensTops from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-item-womens-tops.json' with { type: 'json' }
import siteHierarchyMenuItemWomensTrousers from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-item-womens-trousers.json' with { type: 'json' }
import siteHierarchyMenuItemWomens from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-item-womens.json' with { type: 'json' }
import siteHierarchyMenuMain from '../../../fixtures/anyafinn/components/header/site-hierarchy-menu-main.json' with { type: 'json' }
import siteIconButtonAccount from '../../../fixtures/anyafinn/components/header/site-icon-button-account.json' with { type: 'json' }
import siteIconButtonCart from '../../../fixtures/anyafinn/components/header/site-icon-button-cart.json' with { type: 'json' }
import siteLocaleSelector from '../../../fixtures/anyafinn/components/header/site-locale-selector.json' with { type: 'json' }
import siteLogo from '../../../fixtures/anyafinn/components/header/site-logo.json' with { type: 'json' }
import siteMenuToggleButton from '../../../fixtures/anyafinn/components/header/site-menu-toggle-button.json' with { type: 'json' }
import homeCardDepartmentHome from '../../../fixtures/anyafinn/components/home-card-department-home.json' with { type: 'json' }
import homeCardDepartmentMens from '../../../fixtures/anyafinn/components/home-card-department-mens.json' with { type: 'json' }
import homeCardDepartmentSale from '../../../fixtures/anyafinn/components/home-card-department-sale.json' with { type: 'json' }
import homeCardDepartmentWomens from '../../../fixtures/anyafinn/components/home-card-department-womens.json' with { type: 'json' }
import homeCardGrownUpGlitter from '../../../fixtures/anyafinn/components/home-card-grown-up-glitter.json' with { type: 'json' }
import homeCardOpulentDecadence from '../../../fixtures/anyafinn/components/home-card-opulent-decadence.json' with { type: 'json' }
import homeCardPiratecore from '../../../fixtures/anyafinn/components/home-card-piratecore.json' with { type: 'json' }
import homeClosingHero from '../../../fixtures/anyafinn/components/home-closing-hero.json' with { type: 'json' }
import homeDepartments from '../../../fixtures/anyafinn/components/home-departments.json' with { type: 'json' }
import homeEditorialImage from '../../../fixtures/anyafinn/components/home-editorial-image.json' with { type: 'json' }
import homeEditorialMarkdown from '../../../fixtures/anyafinn/components/home-editorial-markdown.json' with { type: 'json' }
import homeEditorial from '../../../fixtures/anyafinn/components/home-editorial.json' with { type: 'json' }
import homeHero from '../../../fixtures/anyafinn/components/home-hero.json' with { type: 'json' }
import homeNewIn from '../../../fixtures/anyafinn/components/home-new-in.json' with { type: 'json' }
import homeServiceCollect from '../../../fixtures/anyafinn/components/home-service-collect.json' with { type: 'json' }
import homeServiceDelivery from '../../../fixtures/anyafinn/components/home-service-delivery.json' with { type: 'json' }
import homeServiceReturns from '../../../fixtures/anyafinn/components/home-service-returns.json' with { type: 'json' }
import homeServices from '../../../fixtures/anyafinn/components/home-services.json' with { type: 'json' }
import homeShopTheLook from '../../../fixtures/anyafinn/components/home-shop-the-look.json' with { type: 'json' }
import productSuedeTrenchCoatKhakiStory from '../../../fixtures/anyafinn/components/products/suede-trench-coat-khaki-story.json' with { type: 'json' }
import productTerraStoneEffectCoffeeTableStory from '../../../fixtures/anyafinn/components/products/terra-stone-effect-coffee-table-story.json' with { type: 'json' }
import shopTheLookGrid from '../../../fixtures/anyafinn/components/shop-the-look-grid.json' with { type: 'json' }
import shopTheLookHero from '../../../fixtures/anyafinn/components/shop-the-look-hero.json' with { type: 'json' }
import shopTheLookMarkdown from '../../../fixtures/anyafinn/components/shop-the-look-markdown.json' with { type: 'json' }
import storyCta from '../../../fixtures/anyafinn/components/story/story-cta.json' with { type: 'json' }
import storyHero from '../../../fixtures/anyafinn/components/story/story-hero.json' with { type: 'json' }
import storyHomeImage from '../../../fixtures/anyafinn/components/story/story-home-image.json' with { type: 'json' }
import storyHomeMarkdown from '../../../fixtures/anyafinn/components/story/story-home-markdown.json' with { type: 'json' }
import storyHome from '../../../fixtures/anyafinn/components/story/story-home.json' with { type: 'json' }
import storyIntro from '../../../fixtures/anyafinn/components/story/story-intro.json' with { type: 'json' }
import storyValueFair from '../../../fixtures/anyafinn/components/story/story-value-fair.json' with { type: 'json' }
import storyValueFewerBetter from '../../../fixtures/anyafinn/components/story/story-value-fewer-better.json' with { type: 'json' }
import storyValueMended from '../../../fixtures/anyafinn/components/story/story-value-mended.json' with { type: 'json' }
import storyValues from '../../../fixtures/anyafinn/components/story/story-values.json' with { type: 'json' }
import pageBlogGrownUpGlitter from '../../../fixtures/anyafinn/pages/blog/grown-up-glitter.json' with { type: 'json' }
import pageBlogOpulentDecadence from '../../../fixtures/anyafinn/pages/blog/opulent-decadence.json' with { type: 'json' }
import pageBlogPiratecore from '../../../fixtures/anyafinn/pages/blog/piratecore.json' with { type: 'json' }
import pageCompanyStory from '../../../fixtures/anyafinn/pages/company/story.json' with { type: 'json' }
import home from '../../../fixtures/anyafinn/pages/home.json' with { type: 'json' }
import product2ftPreLitFlockedChristmasTreeWithBurlapBase from '../../../fixtures/anyafinn/pages/products/anyafinn-2ft-pre-lit-flocked-christmas-tree-with-burlap-base.json' with { type: 'json' }
import productButtonCardiganBeige from '../../../fixtures/anyafinn/pages/products/anyafinn-button-cardigan-beige.json' with { type: 'json' }
import productCasualWideLegStripeTrousersMulti from '../../../fixtures/anyafinn/pages/products/anyafinn-casual-wide-leg-stripe-trousers-multi.json' with { type: 'json' }
import productCheckShirtMulti from '../../../fixtures/anyafinn/pages/products/anyafinn-check-shirt-multi.json' with { type: 'json' }
import productChelseaBootBrown from '../../../fixtures/anyafinn/pages/products/anyafinn-chelsea-boot-brown.json' with { type: 'json' }
import productChinosBrown from '../../../fixtures/anyafinn/pages/products/anyafinn-chinos-brown.json' with { type: 'json' }
import productChinosPetrol from '../../../fixtures/anyafinn/pages/products/anyafinn-chinos-petrol.json' with { type: 'json' }
import productClassicShirtLightBlue from '../../../fixtures/anyafinn/pages/products/anyafinn-classic-shirt-light-blue.json' with { type: 'json' }
import productCoOrdFunnelNeckDenimJacketMidWash from '../../../fixtures/anyafinn/pages/products/anyafinn-co-ord-funnel-neck-denim-jacket-mid-wash.json' with { type: 'json' }
import productCollaredArgyleCardiganPinkBurgundy from '../../../fixtures/anyafinn/pages/products/anyafinn-collared-argyle-cardigan-pink-burgundy.json' with { type: 'json' }
import productCrewNeckDoubleLayerCardiganWithWoolGrey from '../../../fixtures/anyafinn/pages/products/anyafinn-crew-neck-double-layer-cardigan-with-wool-grey.json' with { type: 'json' }
import productCrewNeckJumperDarkRed from '../../../fixtures/anyafinn/pages/products/anyafinn-crew-neck-jumper-dark-red.json' with { type: 'json' }
import productCrewNeckStitchInterestJumperGreen from '../../../fixtures/anyafinn/pages/products/anyafinn-crew-neck-stitch-interest-jumper-green.json' with { type: 'json' }
import productEmbossedFloorLamp from '../../../fixtures/anyafinn/pages/products/anyafinn-embossed-floor-lamp.json' with { type: 'json' }
import productFlorenceHighRiseSkinnyJeansDarkWash from '../../../fixtures/anyafinn/pages/products/anyafinn-florence-high-rise-skinny-jeans-dark-wash.json' with { type: 'json' }
import productHalfZipSweatshirtBlue from '../../../fixtures/anyafinn/pages/products/anyafinn-half-zip-sweatshirt-blue.json' with { type: 'json' }
import productHighWaistFlareJeansMidWash from '../../../fixtures/anyafinn/pages/products/anyafinn-high-waist-flare-jeans-mid-wash.json' with { type: 'json' }
import productKneeHighPointedToeRealSuedeHeeledBootsTan from '../../../fixtures/anyafinn/pages/products/anyafinn-knee-high-pointed-toe-real-suede-heeled-boots-tan.json' with { type: 'json' }
import productLaceUpBootsBrown from '../../../fixtures/anyafinn/pages/products/anyafinn-lace-up-boots-brown.json' with { type: 'json' }
import productLaceUpHikerBootBlack from '../../../fixtures/anyafinn/pages/products/anyafinn-lace-up-hiker-boot-black.json' with { type: 'json' }
import productLaceUpShoesGrey from '../../../fixtures/anyafinn/pages/products/anyafinn-lace-up-shoes-grey.json' with { type: 'json' }
import productLeatherJacketBeige from '../../../fixtures/anyafinn/pages/products/anyafinn-leather-jacket-beige.json' with { type: 'json' }
import productLindenCoffeeTableOak from '../../../fixtures/anyafinn/pages/products/anyafinn-linden-coffee-table-oak.json' with { type: 'json' }
import productLoafersBrown from '../../../fixtures/anyafinn/pages/products/anyafinn-loafers-brown.json' with { type: 'json' }
import productLodgeCheckSuperSoftThrow from '../../../fixtures/anyafinn/pages/products/anyafinn-lodge-check-super-soft-throw.json' with { type: 'json' }
import productLonglineQuiltedPaddedCoatBlack from '../../../fixtures/anyafinn/pages/products/anyafinn-longline-quilted-padded-coat-black.json' with { type: 'json' }
import productLonglineWaterproofHoodedCoatBlack from '../../../fixtures/anyafinn/pages/products/anyafinn-longline-waterproof-hooded-coat-black.json' with { type: 'json' }
import productLonglineZipHoodieBrown from '../../../fixtures/anyafinn/pages/products/anyafinn-longline-zip-hoodie-brown.json' with { type: 'json' }
import productLowTopTrainersBrown from '../../../fixtures/anyafinn/pages/products/anyafinn-low-top-trainers-brown.json' with { type: 'json' }
import productLowTopTrainersOlive from '../../../fixtures/anyafinn/pages/products/anyafinn-low-top-trainers-olive.json' with { type: 'json' }
import productMarlowCoffeeTableWithWavyEdgeDetail from '../../../fixtures/anyafinn/pages/products/anyafinn-marlow-coffee-table-with-wavy-edge-detail.json' with { type: 'json' }
import productNaturalScallopEasyFitLightShade from '../../../fixtures/anyafinn/pages/products/anyafinn-natural-scallop-easy-fit-light-shade.json' with { type: 'json' }
import productPleatedTableLamp from '../../../fixtures/anyafinn/pages/products/anyafinn-pleated-table-lamp.json' with { type: 'json' }
import productQuiltedDownJacketGrey from '../../../fixtures/anyafinn/pages/products/anyafinn-quilted-down-jacket-grey.json' with { type: 'json' }
import productRetroRunnerTrainersBlue from '../../../fixtures/anyafinn/pages/products/anyafinn-retro-runner-trainers-blue.json' with { type: 'json' }
import productSlimJeansBlue from '../../../fixtures/anyafinn/pages/products/anyafinn-slim-jeans-blue.json' with { type: 'json' }
import productSlimJeansDarkBlue from '../../../fixtures/anyafinn/pages/products/anyafinn-slim-jeans-dark-blue.json' with { type: 'json' }
import productStretchDenimWesternJacketWhite from '../../../fixtures/anyafinn/pages/products/anyafinn-stretch-denim-western-jacket-white.json' with { type: 'json' }
import productStretchTailoredWideLegTrousersBlack from '../../../fixtures/anyafinn/pages/products/anyafinn-stretch-tailored-wide-leg-trousers-black.json' with { type: 'json' }
import productStripeJumperBlue from '../../../fixtures/anyafinn/pages/products/anyafinn-stripe-jumper-blue.json' with { type: 'json' }
import productSuedeTrenchCoatKhaki from '../../../fixtures/anyafinn/pages/products/anyafinn-suede-trench-coat-khaki.json' with { type: 'json' }
import productTailoredOvercoatBrown from '../../../fixtures/anyafinn/pages/products/anyafinn-tailored-overcoat-brown.json' with { type: 'json' }
import productTerraStoneEffectCoffeeTable from '../../../fixtures/anyafinn/pages/products/anyafinn-terra-stone-effect-coffee-table.json' with { type: 'json' }
import productTexturedWideLegTrouserCoOrdNavy from '../../../fixtures/anyafinn/pages/products/anyafinn-textured-wide-leg-trouser-co-ord-navy.json' with { type: 'json' }
import productWaterResistantFunnelNeckJacketLightBeige from '../../../fixtures/anyafinn/pages/products/anyafinn-water-resistant-funnel-neck-jacket-light-beige.json' with { type: 'json' }
import productWavyTieredEasyFitLightShade from '../../../fixtures/anyafinn/pages/products/anyafinn-wavy-tiered-easy-fit-light-shade.json' with { type: 'json' }
import productWideLegDrawcordWaistJeansDarkWash from '../../../fixtures/anyafinn/pages/products/anyafinn-wide-leg-drawcord-waist-jeans-dark-wash.json' with { type: 'json' }
import productZipFunnelNeckSweatshirtPink from '../../../fixtures/anyafinn/pages/products/anyafinn-zip-funnel-neck-sweatshirt-pink.json' with { type: 'json' }
import shopTheLook from '../../../fixtures/anyafinn/pages/shop-the-look.json' with { type: 'json' }
import slotBlogGrownUpGlitterMain from '../../../fixtures/anyafinn/slots/blog-grown-up-glitter-main.json' with { type: 'json' }
import slotBlogOpulentDecadenceMain from '../../../fixtures/anyafinn/slots/blog-opulent-decadence-main.json' with { type: 'json' }
import slotBlogPiratecoreMain from '../../../fixtures/anyafinn/slots/blog-piratecore-main.json' with { type: 'json' }
import homeMain from '../../../fixtures/anyafinn/slots/home-main.json' with { type: 'json' }
import productSuedeTrenchCoatKhakiMainSlot from '../../../fixtures/anyafinn/slots/product-suede-trench-coat-khaki-main.json' with { type: 'json' }
import productTerraStoneEffectCoffeeTableMainSlot from '../../../fixtures/anyafinn/slots/product-terra-stone-effect-coffee-table-main.json' with { type: 'json' }
import shopTheLookMain from '../../../fixtures/anyafinn/slots/shop-the-look-main.json' with { type: 'json' }
import slotStoryMain from '../../../fixtures/anyafinn/slots/story-main.json' with { type: 'json' }
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
  siteHierarchyMenuItemMens,
  siteHierarchyMenuItemMensJackets,
  siteHierarchyMenuItemMensKnitwear,
  siteHierarchyMenuItemMensShirts,
  siteHierarchyMenuItemMensTrousers,
  siteHierarchyMenuItemMensJeans,
  siteHierarchyMenuItemMensShoes,
  siteHierarchyMenuItemWomens,
  siteHierarchyMenuItemWomensJackets,
  siteHierarchyMenuItemWomensKnitwear,
  siteHierarchyMenuItemWomensTops,
  siteHierarchyMenuItemWomensTrousers,
  siteHierarchyMenuItemWomensJeans,
  siteHierarchyMenuItemWomensBoots,
  siteHierarchyMenuItemHomeware,
  siteHierarchyMenuItemSale,
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
  blogGrownUpGlitterBody,
  blogGrownUpGlitterMoreLooks,
  blogOpulentDecadenceBody,
  blogOpulentDecadenceMoreLooks,
  blogPiratecoreBody,
  blogPiratecoreMoreLooks,
  homeCardDepartmentHome,
  homeCardDepartmentSale,
  homeCardDepartmentMens,
  homeCardDepartmentWomens,
  homeClosingHero,
  homeDepartments,
  homeEditorialImage,
  homeEditorialMarkdown,
  homeEditorial,
  homeNewIn,
  homeServiceCollect,
  homeServiceDelivery,
  homeServiceReturns,
  homeServices,
  shopTheLookGrid,
  storyCta,
  storyHero,
  storyHomeImage,
  storyHomeMarkdown,
  storyHome,
  storyIntro,
  storyValueFair,
  storyValueFewerBetter,
  storyValueMended,
  storyValues,
  pageBlogGrownUpGlitter,
  pageBlogOpulentDecadence,
  pageBlogPiratecore,
  pageCompanyStory,
  slotBlogGrownUpGlitterMain,
  slotBlogOpulentDecadenceMain,
  slotBlogPiratecoreMain,
  slotStoryMain,
  productSuedeTrenchCoatKhakiStory,
  productSuedeTrenchCoatKhakiMainSlot,
  productSuedeTrenchCoatKhaki,
  productLonglineQuiltedPaddedCoatBlack,
  productLonglineWaterproofHoodedCoatBlack,
  productWaterResistantFunnelNeckJacketLightBeige,
  productCoOrdFunnelNeckDenimJacketMidWash,
  productStretchDenimWesternJacketWhite,
  productTexturedWideLegTrouserCoOrdNavy,
  productWideLegDrawcordWaistJeansDarkWash,
  productCrewNeckDoubleLayerCardiganWithWoolGrey,
  productTerraStoneEffectCoffeeTableStory,
  productTerraStoneEffectCoffeeTableMainSlot,
  productTerraStoneEffectCoffeeTable,
  productMarlowCoffeeTableWithWavyEdgeDetail,
  productLindenCoffeeTableOak,
  productEmbossedFloorLamp,
  productPleatedTableLamp,
  productWavyTieredEasyFitLightShade,
  productNaturalScallopEasyFitLightShade,
  productLodgeCheckSuperSoftThrow,
  product2ftPreLitFlockedChristmasTreeWithBurlapBase,
  productCrewNeckStitchInterestJumperGreen,
  productCollaredArgyleCardiganPinkBurgundy,
  productLonglineZipHoodieBrown,
  productZipFunnelNeckSweatshirtPink,
  productHalfZipSweatshirtBlue,
  productStretchTailoredWideLegTrousersBlack,
  productCasualWideLegStripeTrousersMulti,
  productHighWaistFlareJeansMidWash,
  productFlorenceHighRiseSkinnyJeansDarkWash,
  productKneeHighPointedToeRealSuedeHeeledBootsTan,
  productChelseaBootBrown,
  productLaceUpHikerBootBlack,
  productTailoredOvercoatBrown,
  productQuiltedDownJacketGrey,
  productLeatherJacketBeige,
  productCrewNeckJumperDarkRed,
  productButtonCardiganBeige,
  productStripeJumperBlue,
  productCheckShirtMulti,
  productClassicShirtLightBlue,
  productChinosBrown,
  productChinosPetrol,
  productSlimJeansBlue,
  productSlimJeansDarkBlue,
  productLowTopTrainersBrown,
  productLowTopTrainersOlive,
  productRetroRunnerTrainersBlue,
  productLaceUpBootsBrown,
  productLaceUpShoesGrey,
  productLoafersBrown,
]

export const anyafinnSet: FixtureSet = {
  name: 'anyafinn',
  fixtures,
  hierarchies: manifests,
}
