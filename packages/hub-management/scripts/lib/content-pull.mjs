/**
 * Turning a hub's content into a fixture set — the reverse of the content step
 * in hub-import.mjs.
 *
 * A site on a hub is the items whose delivery keys sit under `<site>/`, plus
 * everything they link to, plus the hierarchy nodes beneath any of those. That
 * closure becomes a set: each item cut back to the `{ id, label, locale?, body }`
 * a fixture holds, its keys moved to the new set's namespace, filed by the
 * directory the seed imports it from, and the hierarchy manifest rebuilt from
 * `parentId`. Ids stay the hub's here; `pnpm fixtures:ids` re-mints them from
 * the paths afterwards, which is also what makes a pulled set safe to seed
 * back — it creates new items rather than adopting the source ones.
 *
 * Every rule lives here and none of the I/O, so the rules are testable without
 * a hub. hub-pull.mjs owns the round-trips.
 *
 * Plain ESM so `node scripts/hub-pull.mjs` can import it without a TS loader;
 * `content-pull.d.mts` gives the .ts test real types.
 */

const SCHEMA_ROOT = 'https://quadratic.amplience.com/v2'

/** Content-repo schemas that are routable pages, so live in `pages/`. */
export const PAGE_SCHEMAS = new Set([
  `${SCHEMA_ROOT}/content/page`,
  `${SCHEMA_ROOT}/content/blog-article`,
  `${SCHEMA_ROOT}/content/product`,
])

const LINK_SCHEMA_SUFFIXES = ['#/definitions/content-link', '#/definitions/content-reference']

const isObject = (node) => node !== null && typeof node === 'object' && !Array.isArray(node)

const isLink = (node) =>
  isObject(node) &&
  typeof node.id === 'string' &&
  typeof node._meta?.schema === 'string' &&
  LINK_SCHEMA_SUFFIXES.some((suffix) => node._meta.schema.endsWith(suffix))

/** Depth-first visit of every object in a tree. */
const visit = (node, fn) => {
  if (Array.isArray(node)) {
    for (const child of node) visit(child, fn)
    return
  }
  if (!isObject(node)) return
  fn(node)
  for (const value of Object.values(node)) visit(value, fn)
}

/** Ids of every item a body links to, by content-link or content-reference. */
export const linkedIds = (body) => {
  const ids = new Set()
  visit(body, (node) => {
    if (isLink(node)) ids.add(node.id)
  })
  return [...ids]
}

/** Every delivery key on an item — multi-key form plus the legacy single key. */
export const deliveryKeysOf = (meta) => {
  const keys = []
  for (const entry of meta?.deliveryKeys?.values ?? []) {
    if (typeof entry?.value === 'string') keys.push(entry.value)
  }
  if (typeof meta?.deliveryKey === 'string' && !keys.includes(meta.deliveryKey)) {
    keys.push(meta.deliveryKey)
  }
  return keys
}

const parentOf = (item) => item.body?._meta?.hierarchy?.parentId ?? item.hierarchy?.parentId

const isActive = (item) => item.status === undefined || item.status === 'ACTIVE'

/**
 * The items that make up the site under `<from>/`.
 *
 * `candidates` are the active items already listed from the site's
 * repositories; a link to anything else is fetched with `fetchItem` (resolving
 * undefined when the hub has no such item). Hierarchy children carry no link
 * from their parent, so they are added by `parentId`, to a fixed point —
 * a child can itself link to more content.
 */
export const collectItems = async (candidates, { from, fetchItem }) => {
  const prefix = `${from}/`
  const known = new Map(candidates.map((item) => [item.id, item]))
  const included = new Map()
  const missing = []
  const archived = []

  const queue = candidates.filter((item) =>
    deliveryKeysOf(item.body?._meta).some((key) => key.startsWith(prefix)),
  )
  const roots = queue.length

  const lookup = async (id) => {
    if (!known.has(id)) known.set(id, (await fetchItem(id)) ?? null)
    return known.get(id) ?? undefined
  }

  for (;;) {
    while (queue.length > 0) {
      const item = queue.shift()
      if (included.has(item.id)) continue
      included.set(item.id, item)
      for (const id of linkedIds(item.body)) {
        if (included.has(id)) continue
        const target = await lookup(id)
        if (target === undefined) missing.push({ from: item.id, id })
        else if (!isActive(target)) archived.push({ from: item.id, id, label: target.label })
        else queue.push(target)
      }
    }
    const children = [...known.values()].filter(
      (item) =>
        item !== null &&
        isActive(item) &&
        !included.has(item.id) &&
        included.has(parentOf(item) ?? ''),
    )
    if (children.length === 0) break
    queue.push(...children)
  }

  return { items: [...included.values()], roots, missing, archived }
}

/** Lower-case, ASCII, hyphenated — safe as a path segment on any filesystem. */
export const slugify = (text) =>
  String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')

/** Which set directory an item is seeded from. */
export const routeItem = (item, repos) => {
  if (repos.slots !== undefined && item.contentRepositoryId === repos.slots) return 'slots'
  if (repos.siteComponents !== undefined && item.contentRepositoryId === repos.siteComponents) {
    return 'site-components'
  }
  return PAGE_SCHEMAS.has(item.body?._meta?.schema) ? 'pages' : 'components'
}

/** `<site>/rest` → `<to>/rest`. */
const rebase = (key, to) => `${to}/${key.slice(key.indexOf('/') + 1)}`

/**
 * The keys an item takes into the set.
 *
 * Furniture shared between sites carries one key per site, so only the
 * `<from>/` ones are kept and the rest dropped. An item with no `<from>/` key
 * at all is still part of the site — it was reached by a link — so its keys
 * are moved into `<to>/` rather than dropped: the frontend finds a hierarchy by
 * its root's key, wherever the header's link points.
 */
export const keysFor = (keys, { from, to }) => {
  const own = keys.filter((key) => key.startsWith(`${from}/`))
  if (own.length > 0) {
    return {
      keys: own.map((key) => rebase(key, to)),
      dropped: keys.filter((k) => !own.includes(k)),
      rebased: [],
    }
  }
  const rebased = keys.filter((key) => key.includes('/'))
  return {
    keys: [...new Set(rebased.map((key) => rebase(key, to)))],
    dropped: keys.filter((key) => !key.includes('/')),
    rebased,
  }
}

/** One hub item as a fixture: hub bookkeeping dropped, keys moved into `<to>/`. */
export const toFixture = (item, { from, to }) => {
  const source = item.body?._meta ?? {}
  const meta = { name: source.name ?? item.label, schema: source.schema }

  const { keys, dropped, rebased } = keysFor(deliveryKeysOf(source), { from, to })
  if (keys.length > 0) meta.deliveryKeys = { values: keys.map((value) => ({ value })) }

  const hierarchy = { ...item.hierarchy, ...source.hierarchy }
  if (Object.keys(hierarchy).length > 0) {
    meta.hierarchy = { root: hierarchy.root === true }
    if (typeof hierarchy.parentId === 'string') meta.hierarchy.parentId = hierarchy.parentId
    if (typeof hierarchy.position === 'string') meta.hierarchy.position = hierarchy.position
  }
  meta.deliveryId = item.id

  const fields = JSON.parse(JSON.stringify(item.body ?? {}))
  delete fields._meta
  const fixture = { id: item.id, label: item.label }
  if (typeof item.locale === 'string') fixture.locale = item.locale
  fixture.body = { _meta: meta, ...fields }
  return { fixture, keys, dropped, rebased }
}

/**
 * A path for every fixture, relative to the set directory.
 *
 * Keyed items take their key (`<to>/products/coat` → `pages/products/coat.json`),
 * the rest their label. The path is the id seed, so order is fixed before
 * naming and clashes are settled case-insensitively — macOS would merge
 * `Hero.json` and `hero.json` into one file.
 */
export const assignPaths = (entries, { to }) => {
  const sortKey = ({ dir, keys, fixture }) =>
    [dir, keys.length > 0 ? `0${keys[0]}` : `1${fixture.label}`, fixture.id].join('\u0000')
  const ordered = [...entries].sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1))

  const taken = new Set()
  const paths = new Map()
  for (const entry of ordered) {
    const fromKey =
      entry.keys.length > 0
        ? entry.keys[0]
            .slice(to.length + 1)
            .split('/')
            .map(slugify)
            .filter(Boolean)
            .join('/')
        : ''
    const stem = `${entry.dir}/${fromKey || slugify(entry.fixture.label) || 'item'}`
    let rel = `${stem}.json`
    for (let n = 2; taken.has(rel.toLowerCase()); n++) rel = `${stem}-${n}.json`
    taken.add(rel.toLowerCase())
    paths.set(entry.fixture.id, rel)
  }
  return paths
}

/**
 * `_hierarchy/manifests.json` — per root, keyed by the root's delivery key,
 * each parent's children ordered by `position`. Leaves get no entry, matching
 * the hand-built manifests.
 */
export const buildHierarchyManifests = (fixtures) => {
  const warnings = []
  const byParent = new Map()
  for (const fixture of fixtures) {
    const parentId = fixture.body._meta.hierarchy?.parentId
    if (parentId === undefined) continue
    if (!byParent.has(parentId)) byParent.set(parentId, [])
    byParent.get(parentId).push(fixture)
  }

  const order = (a, b) => {
    const pa = a.body._meta.hierarchy?.position
    const pb = b.body._meta.hierarchy?.position
    if (pa !== pb) {
      if (pa === undefined) return 1
      if (pb === undefined) return -1
      return pa < pb ? -1 : 1
    }
    return a.label.localeCompare(b.label)
  }

  const manifests = {}
  for (const root of fixtures.filter((f) => f.body._meta.hierarchy?.root === true)) {
    const key = root.body._meta.deliveryKeys?.values[0]?.value
    if (key === undefined) {
      warnings.push(`Hierarchy root "${root.label}" has no delivery key, so it has no manifest.`)
      continue
    }
    const children = {}
    const walk = (id) => {
      const kids = (byParent.get(id) ?? []).sort(order)
      if (kids.length === 0) return
      const positions = kids.map((k) => k.body._meta.hierarchy?.position)
      if (new Set(positions).size !== positions.length) {
        warnings.push(`Two children of "${key}" node ${id} share a position — order is by label.`)
      }
      children[id] = kids.map((k) => k.id)
      for (const kid of kids) walk(kid.id)
    }
    walk(root.id)
    manifests[key] = { root: root.id, children }
  }
  return { manifests, warnings }
}

/** How often each locale is authored, across localized fields and item locales. */
export const countLocales = (fixtures) => {
  const counts = new Map()
  const bump = (locale) => counts.set(locale, (counts.get(locale) ?? 0) + 1)
  for (const fixture of fixtures) {
    if (typeof fixture.locale === 'string') bump(fixture.locale)
    visit(fixture.body, (node) => {
      if (!Array.isArray(node.values) || !node._meta?.schema?.includes('localized')) return
      for (const value of node.values) if (typeof value?.locale === 'string') bump(value.locale)
    })
  }
  return counts
}

/**
 * The set's locales: authored ones in the hub's order (unknowns after), and
 * the default as asked for, else the most-authored, else the hub's first.
 */
export const chooseLocales = (counts, { hubLocales = [], defaultLocale } = {}) => {
  const rank = (locale) => {
    const i = hubLocales.indexOf(locale)
    return i === -1 ? hubLocales.length : i
  }
  const authored = [...counts.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  const busiest = [...authored].sort((a, b) => counts.get(b) - counts.get(a) || rank(a) - rank(b))
  const chosen = defaultLocale ?? busiest[0] ?? hubLocales[0] ?? 'en-US'
  return {
    defaultLocale: chosen,
    authoredLocales: authored.includes(chosen) ? authored : [chosen, ...authored],
  }
}

/** DAM endpoints the content's image and video links point at. */
export const damEndpoints = (fixtures) => {
  const endpoints = new Set()
  for (const fixture of fixtures) {
    visit(fixture.body, (node) => {
      const schema = node._meta?.schema
      if (typeof node.endpoint !== 'string' || typeof schema !== 'string') return
      if (
        schema.endsWith('#/definitions/image-link') ||
        schema.endsWith('#/definitions/video-link')
      )
        endpoints.add(node.endpoint)
    })
  }
  return [...endpoints].sort()
}

/**
 * Everything a pull will write, or why it won't.
 *
 * Nothing is written when `errors` is non-empty: a half-pulled set seeds as a
 * site with holes in it, which is worse than no set.
 */
export const planPull = (
  items,
  {
    from,
    to,
    repos,
    knownSchemas,
    hubLocales,
    defaultLocale,
    label,
    description,
    defaultBrand = 'default',
  },
) => {
  const errors = []
  const warnings = []
  const configured = new Set(Object.values(repos).filter(Boolean))

  const claimed = new Map()
  const entries = items.map((item) => {
    const { fixture, keys, dropped, rebased } = toFixture(item, { from, to })
    if (dropped.length > 0) {
      warnings.push(
        `"${item.label}" is shared with another site — dropped ${dropped.map((k) => `"${k}"`).join(', ')}.`,
      )
    }
    if (rebased.length > 0) {
      warnings.push(
        `"${item.label}" has no "${from}/" key — moved ${rebased.map((k) => `"${k}"`).join(', ')} ` +
          `into "${to}/".`,
      )
    }
    for (const key of keys) {
      if (!claimed.has(key)) claimed.set(key, [])
      claimed.get(key).push(item)
    }
    if (knownSchemas !== undefined && !knownSchemas.has(fixture.body._meta.schema)) {
      errors.push(
        `"${item.label}" (${item.id}) uses ${fixture.body._meta.schema}, which isn't a ` +
          'Frontend Starter content type — it would neither seed nor render.',
      )
    }
    if (!configured.has(item.contentRepositoryId)) {
      warnings.push(
        `"${item.label}" (${item.id}) is in repository ${item.contentRepositoryId}, outside the ` +
          'configured ones — filed by schema, and it will seed into the content repository.',
      )
    }
    return { fixture, keys, dir: routeItem(item, repos) }
  })

  // Moving keys between namespaces can land two items on one key; the seed
  // would 409 on the second, so refuse here instead.
  for (const [key, holders] of claimed) {
    if (holders.length < 2) continue
    errors.push(
      `${holders.map((h) => `"${h.label}" (${h.id})`).join(' and ')} would all take "${key}".`,
    )
  }

  const paths = assignPaths(entries, { to })
  const fixtures = entries.map((e) => e.fixture)
  const { manifests, warnings: hierarchyWarnings } = buildHierarchyManifests(fixtures)
  warnings.push(...hierarchyWarnings)

  const locales = chooseLocales(countLocales(fixtures), { hubLocales, defaultLocale })
  const set = {
    name: to,
    label:
      label ??
      to
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
    description: description ?? `Pulled from the "${from}" site.`,
    defaultBrand,
    defaultLocale: locales.defaultLocale,
    authoredLocales: locales.authoredLocales,
    generatedDocs: false,
  }

  const files = entries
    .map(({ fixture }) => ({ path: paths.get(fixture.id), fixture }))
    .sort((a, b) => (a.path < b.path ? -1 : 1))

  return { files, manifests, set, endpoints: damEndpoints(fixtures), errors, warnings }
}
