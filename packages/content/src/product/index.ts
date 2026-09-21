/**
 * Product source implementations and their shared contract suite.
 *
 * The port and its types live at the package root (`../product-port`,
 * `../product-types`), mirroring how `ContentClient` and its implementations
 * are split. `CmsProductSource` lands here next.
 */

export { catalogueFromItems, deliveryKeyFromMeta, warnOnDuplicateSlugs } from './catalogue'
export type { Catalogue, CatalogueEntry } from './catalogue'
export { CmsProductSource, PRODUCT_SCHEMA } from './CmsProductSource'
export type { CmsProductSourceOptions } from './CmsProductSource'
export { mapProduct } from './mapProduct'
export { StubProductSource } from './StubProductSource'
export type { StubProductSourceOptions } from './StubProductSource'
export { missingSkus, warnOnMissingSkus } from './warnings'
