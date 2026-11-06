/**
 * The slices of the commercetools HTTP API payloads this adapter reads.
 *
 * Hand-written and deliberately partial: the official SDK types run to
 * thousands of lines and would make every field look load-bearing. Fields are
 * optional wherever commercetools makes them optional, so the mapper is forced
 * to handle their absence rather than trusting a type that lies.
 *
 * Reference: https://docs.commercetools.com/api/projects/productProjections
 */

/** `{ "en": "…", "en-GB": "…" }` — keys are IETF language tags. */
export type LocalizedString = Readonly<Record<string, string>>

export type CtTypedMoney = {
  readonly centAmount: number
  readonly currencyCode: string
  readonly fractionDigits?: number
}

export type CtPrice = {
  readonly id?: string
  readonly value: CtTypedMoney
  readonly country?: string
  readonly channel?: { readonly id: string }
  readonly customerGroup?: { readonly id: string }
  readonly validFrom?: string
  readonly validUntil?: string
  readonly discounted?: { readonly value: CtTypedMoney }
}

export type CtImage = {
  readonly url: string
  readonly label?: string
  readonly dimensions?: { readonly w?: number; readonly h?: number }
}

export type CtAttribute = {
  readonly name: string
  readonly value: unknown
}

export type CtVariant = {
  readonly id?: number
  readonly sku?: string
  readonly key?: string
  readonly prices?: readonly CtPrice[]
  /** Present only when price-selection parameters were supplied. */
  readonly price?: CtPrice
  readonly images?: readonly CtImage[]
  readonly attributes?: readonly CtAttribute[]
}

export type CtReference = { readonly typeId: string; readonly id: string }

export type CtProductProjection = {
  readonly id: string
  readonly key?: string
  readonly productType: CtReference
  readonly name: LocalizedString
  readonly slug: LocalizedString
  readonly description?: LocalizedString
  readonly categories?: readonly CtReference[]
  readonly masterVariant: CtVariant
  readonly variants?: readonly CtVariant[]
  readonly published?: boolean
  readonly createdAt?: string
  /** Category id → merchandiser's sort key, compared as a string. */
  readonly categoryOrderHints?: Readonly<Record<string, string>>
}

export type CtCategory = {
  readonly id: string
  readonly key?: string
  readonly slug: LocalizedString
  readonly name?: LocalizedString
  readonly ancestors?: readonly CtReference[]
}

export type CtAttributeDefinition = {
  readonly name: string
  readonly label?: LocalizedString
}

export type CtProductType = {
  readonly id: string
  readonly key?: string
  readonly name?: string
  readonly attributes?: readonly CtAttributeDefinition[]
}
