// Hand-written declarations for the content-pull rules, which stay plain ESM
// (.mjs) so `node scripts/hub-pull.mjs` imports them without a TS loader.

/** A content item as the Management API returns it. Only the fields read here are named. */
export type HubItem = {
  id: string
  label: string
  locale?: string
  status?: string
  contentRepositoryId?: string
  hierarchy?: { root?: boolean; parentId?: string }
  body?: Record<string, unknown> & { _meta?: Record<string, unknown> }
}

/** A fixture on disk: `{ id, label, locale?, body }`. */
export type Fixture = {
  id: string
  label: string
  locale?: string
  body: Record<string, unknown> & {
    _meta: {
      name: string
      schema: string
      deliveryKeys?: { values: { value: string }[] }
      hierarchy?: { root: boolean; parentId?: string; position?: string }
      deliveryId: string
    }
  }
}

export type Repos = { content?: string; slots?: string; siteComponents?: string }

export type SetDefinition = {
  name: string
  label: string
  description: string
  defaultBrand: string
  defaultLocale: string
  authoredLocales: string[]
  generatedDocs: false
}

export type HierarchyManifests = Record<
  string,
  { root: string; children: Record<string, string[]> }
>

export declare const PAGE_SCHEMAS: ReadonlySet<string>

export declare const linkedIds: (body: unknown) => string[]

export declare const deliveryKeysOf: (meta: unknown) => string[]

export declare const collectItems: (
  candidates: readonly HubItem[],
  options: { from: string; fetchItem: (id: string) => Promise<HubItem | undefined> },
) => Promise<{
  items: HubItem[]
  roots: number
  missing: { from: string; id: string }[]
  archived: { from: string; id: string; label: string }[]
}>

export declare const slugify: (text: unknown) => string

export declare const routeItem: (
  item: HubItem,
  repos: Repos,
) => 'components' | 'slots' | 'pages' | 'site-components'

export declare const keysFor: (
  keys: readonly string[],
  options: { from: string; to: string },
) => { keys: string[]; dropped: string[]; rebased: string[] }

export declare const toFixture: (
  item: HubItem,
  options: { from: string; to: string },
) => { fixture: Fixture; keys: string[]; dropped: string[]; rebased: string[] }

export declare const assignPaths: (
  entries: readonly { fixture: Fixture; keys: string[]; dir: string }[],
  options: { to: string },
) => Map<string, string>

export declare const buildHierarchyManifests: (fixtures: readonly Fixture[]) => {
  manifests: HierarchyManifests
  warnings: string[]
}

export declare const countLocales: (fixtures: readonly Fixture[]) => Map<string, number>

export declare const chooseLocales: (
  counts: Map<string, number>,
  options?: { hubLocales?: readonly string[]; defaultLocale?: string | undefined },
) => { defaultLocale: string; authoredLocales: string[] }

export declare const damEndpoints: (fixtures: readonly Fixture[]) => string[]

export declare const planPull: (
  items: readonly HubItem[],
  options: {
    from: string
    to: string
    repos: Repos
    knownSchemas?: ReadonlySet<string>
    hubLocales?: readonly string[]
    defaultLocale?: string | undefined
    label?: string | undefined
    description?: string | undefined
    defaultBrand?: string
  },
) => {
  files: { path: string; fixture: Fixture }[]
  manifests: HierarchyManifests
  set: SetDefinition
  endpoints: string[]
  errors: string[]
  warnings: string[]
}
