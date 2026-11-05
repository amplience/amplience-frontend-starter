// Hand-written declarations for the products-repo helpers, which stay plain
// ESM (.mjs) so `node scripts/hub-import.mjs` can import them without a TS
// loader. This lets the .ts test and typecheck see real types.

export declare const PRODUCT_SCHEMA: string

/** The content type with the products repository added, when it is the product type. */
export declare const withProductsRepo: <
  T extends { contentTypeUri?: string; repositories?: string[] },
>(
  contentType: T,
  repoName: string | undefined,
) => T

/** Move product items from one staged directory to another; returns their ids. */
export declare const moveProductItems: (fromDir: string, toDir: string) => string[]

/** The ids among `ids` that the import map already maps. */
export declare const alreadyMapped: (
  ids: readonly string[],
  map: { contentItems?: [string, string][] } | undefined,
) => string[]
