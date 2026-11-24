// Hand-written declarations for the product-picker helpers, which stay plain
// ESM (.mjs) so `node scripts/hub-import.mjs` can import them without a TS
// loader. This lets the .ts test and typecheck see real types.

export declare const PRODUCT_CAROUSEL_SCHEMA: string
export declare const MULTI_PIM_PRODUCT_CAROUSEL_SCHEMA: string
export declare const MULTI_PIM_CONTENT_TYPE_FILE: string

/** A hub's entry in amplience.config.json — only the fields read here. */
export type HubEntry = {
  commercetools?: {
    projectKey?: string
    clientId?: string
    clientSecret?: string
    region?: string
    language?: string
  }
  /** The hub's main product source — see `ProductSourceName`. */
  mainPim?: string
  multiPimDemo?: boolean
}

/** A site's PRODUCT_SOURCE, and a hub's `mainPim`. */
export type ProductSourceName = 'cms' | 'commercetools'

export declare const PRODUCT_SOURCES: readonly ProductSourceName[]

export type CommercetoolsSettings = {
  project: string
  clientId: string
  clientSecret: string
  language: string
  authUrl: string
  apiUrl: string
  scope: string
}

export declare const commercetoolsSettings: (
  hubEntry: HubEntry | undefined,
) => CommercetoolsSettings | undefined

export declare const mainPim: (hubEntry: HubEntry | undefined) => ProductSourceName

export declare const needsCommercetools: (definitionText: string) => boolean

export declare const seedsContentType: (file: string, hubEntry: HubEntry | undefined) => boolean

export declare const withProductPickers: <T>(
  schema: T,
  options: { mainPim: ProductSourceName; commercetools: boolean },
) => T
