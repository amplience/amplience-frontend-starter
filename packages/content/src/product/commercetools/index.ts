/** The commercetools `ProductSource` adapter (ADR-0018). */

export { CommercetoolsClient } from './client'
export type { CommercetoolsClientConfig, FetchLike } from './client'
export { CommercetoolsProductSource } from './CommercetoolsProductSource'
export type { CommercetoolsProductSourceOptions } from './CommercetoolsProductSource'
export { makeCommercetoolsProductSource, resolveCommercetoolsConfig } from './config'
export type { CommercetoolsEnvConfig } from './config'
export { mapProjection } from './mapProjection'
