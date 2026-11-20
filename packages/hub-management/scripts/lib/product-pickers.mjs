/**
 * Per-hub product pickers — which editor a carousel's product field gets, and
 * which product-related types and extensions a hub is seeded with.
 *
 * Driven by the hub's entry in amplience.config.json:
 *
 *   "commercetools": { "projectKey", "clientId", "clientSecret", "region"? }
 *       Seeds the commercetools eComm Toolkit extension with these credentials
 *       and gives the product carousel's `products` field the commercetools
 *       picker. Without it the field gets the Amplience PIM picker instead.
 *       The secret reaches editors' browsers (the toolkit calls commercetools
 *       from there), so use an API client that can only read published
 *       products and categories.
 *
 * Every hub is seeded with the Amplience PIM extension: it needs no
 * credentials, because it reads the hub's own Product items as the signed-in
 * editor. It stores SKUs, which is what the `cms` product source reads.
 *
 *   "multiPimDemo": true
 *       Registers the Multi-PIM Product Carousel content type — a demo tool
 *       for hubs whose sites use different product sources. Off by default,
 *       so a real client's hub only ever has the one carousel.
 *
 * The multi-PIM *schema* is always seeded (schemas are invisible to editors
 * and the content-blocks palette lists it); only its content type is gated.
 */

export const PRODUCT_CAROUSEL_SCHEMA = 'https://quadratic.amplience.com/v2/content/product-carousel'
export const MULTI_PIM_PRODUCT_CAROUSEL_SCHEMA =
  'https://quadratic.amplience.com/v2/content/multi-pim-product-carousel'

/** The content-type file that only opted-in hubs register. */
export const MULTI_PIM_CONTENT_TYPE_FILE = 'content_multi-pim-product-carousel.json'

/** commercetools' own region default, which Quadratic 1.0's projects use. */
const DEFAULT_REGION = 'europe-west1.gcp'

/**
 * A toolkit product-picker editor, which stores product references as strings.
 * `name` is the extension's: one per product source, defined in extensions/.
 */
const toolkitPicker = (name) => ({
  name,
  params: {
    label: 'Search by keyword or category',
    view: 'product',
    data: 'product',
    type: 'strings',
  },
})

/** Stores commercetools product ids. */
const COMMERCETOOLS_PICKER = toolkitPicker('ecomm-toolkit-commercetools')

/** Stores SKUs of Product items authored in Amplience. */
const AMPLIENCE_PICKER = toolkitPicker('ecomm-toolkit-amplience')

/**
 * The hub's commercetools settings as `${commercetools:…}` token values, or
 * `undefined` when it has none (or an incomplete block — no half-configured
 * picker).
 */
export const commercetoolsSettings = (hubEntry) => {
  const ct = hubEntry?.commercetools
  if (!ct?.projectKey || !ct.clientId || !ct.clientSecret) return undefined
  const region = ct.region || DEFAULT_REGION
  return {
    project: ct.projectKey,
    clientId: ct.clientId,
    clientSecret: ct.clientSecret,
    language: ct.language || 'en',
    authUrl: `https://auth.${region}.commercetools.com/oauth/token`,
    apiUrl: `https://api.${region}.commercetools.com`,
    scope: `view_published_products:${ct.projectKey} view_categories:${ct.projectKey}`,
  }
}

/** Whether an extension definition needs commercetools settings to resolve. */
export const needsCommercetools = (definitionText) => definitionText.includes('${commercetools:')

/** Whether this hub registers a content-type file. */
export const seedsContentType = (file, hubEntry) =>
  file !== MULTI_PIM_CONTENT_TYPE_FILE || hubEntry?.multiPimDemo === true

/**
 * A schema with this hub's product pickers applied. Only the two carousel
 * schemas change:
 *
 *   - product carousel: `products` gets the commercetools picker on a
 *     commercetools hub, and the Amplience PIM picker otherwise;
 *   - multi-PIM carousel: its Amplience list gets the Amplience PIM picker, and
 *     its commercetools list the commercetools one — or is removed on a hub
 *     without commercetools, along with the per-source tabs, which would
 *     otherwise hold a single list.
 *
 * Every other schema is returned unchanged.
 */
export const withProductPickers = (schema, { commercetools }) => {
  if (schema?.$id === PRODUCT_CAROUSEL_SCHEMA) {
    const picker = commercetools ? COMMERCETOOLS_PICKER : AMPLIENCE_PICKER
    const products = { ...schema.properties.products, 'ui:extension': picker }
    return { ...schema, properties: { ...schema.properties, products } }
  }
  if (schema?.$id === MULTI_PIM_PRODUCT_CAROUSEL_SCHEMA) {
    const { 'ui:component': tabs, ...field } = schema.properties.products
    const lists = {
      ...field.properties,
      cms: { ...field.properties.cms, 'ui:extension': AMPLIENCE_PICKER },
    }
    if (commercetools) {
      lists.commercetools = { ...lists.commercetools, 'ui:extension': COMMERCETOOLS_PICKER }
      const products = { ...field, 'ui:component': tabs, properties: lists }
      return { ...schema, properties: { ...schema.properties, products } }
    }
    // One list left, so no tabs: just the Amplience list.
    delete lists.commercetools
    const products = { ...field, properties: lists }
    return { ...schema, properties: { ...schema.properties, products } }
  }
  return schema
}
