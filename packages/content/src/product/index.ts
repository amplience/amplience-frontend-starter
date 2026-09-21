/**
 * Product source implementations and their shared contract suite.
 *
 * The port and its types live at the package root (`../product-port`,
 * `../product-types`), mirroring how `ContentClient` and its implementations
 * are split. `CmsProductSource` lands here next.
 */

export { StubProductSource } from './StubProductSource'
export type { StubProductSourceOptions } from './StubProductSource'
export { missingSkus, warnOnMissingSkus } from './warnings'
