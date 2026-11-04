import { describe, expect, it } from 'vitest'

// Plain ESM shared with hub-pull.mjs; import it directly so the test exercises
// the exact code the pull runs.
import {
  assignPaths,
  buildHierarchyManifests,
  chooseLocales,
  collectItems,
  countLocales,
  damEndpoints,
  deliveryKeysOf,
  keysFor,
  linkedIds,
  planPull,
  routeItem,
  slugify,
  toFixture,
} from './content-pull.mjs'
import type { Fixture, HubItem } from './content-pull.mjs'

const V2 = 'https://quadratic.amplience.com/v2'
const CORE = 'http://bigcontent.io/cms/schema/v1/core'
const LOCALIZED = `${CORE}#/definitions/localized-value`
const REPOS = { content: 'repo-content', slots: 'repo-slots', siteComponents: 'repo-site' }

const link = (id: string, schema = 'content-link') => ({
  id,
  contentType: `${V2}/content/hero`,
  _meta: { schema: `${CORE}#/definitions/${schema}` },
})

const localized = (...locales: string[]) => ({
  values: locales.map((locale) => ({ locale, value: `text-${locale}` })),
  _meta: { schema: LOCALIZED },
})

const hubItem = (
  id: string,
  {
    schema = 'content/hero',
    keys = [] as string[],
    repo = REPOS.content,
    status = 'ACTIVE',
    hierarchy,
    fields = {},
    label = id,
  }: {
    schema?: string
    keys?: string[]
    repo?: string
    status?: string
    hierarchy?: { root: boolean; parentId?: string; position?: string }
    fields?: Record<string, unknown>
    label?: string
  } = {},
): HubItem => ({
  id,
  label,
  status,
  contentRepositoryId: repo,
  body: {
    _meta: {
      name: label,
      schema: `${V2}/${schema}`,
      ...(keys.length > 0 ? { deliveryKeys: { values: keys.map((value) => ({ value })) } } : {}),
      ...(hierarchy ? { hierarchy } : {}),
    },
    ...fields,
  },
})

const fixtureOf = (item: HubItem): Fixture => toFixture(item, { from: 'src', to: 'dst' }).fixture

describe('linkedIds', () => {
  it('finds content-links and content-references at any depth, and nothing else', () => {
    const body = {
      hero: link('a'),
      blocks: [{ inner: [link('b', 'content-reference')] }, link('a')],
      image: { id: 'dam-asset', _meta: { schema: `${CORE}#/definitions/image-link` } },
    }
    expect(linkedIds(body).sort()).toEqual(['a', 'b'])
  })
})

describe('deliveryKeysOf', () => {
  it('reads the multi-key form and the legacy single key, once each', () => {
    expect(
      deliveryKeysOf({ deliveryKeys: { values: [{ value: 'x/a' }] }, deliveryKey: 'x/b' }),
    ).toEqual(['x/a', 'x/b'])
    expect(
      deliveryKeysOf({ deliveryKeys: { values: [{ value: 'x/a' }] }, deliveryKey: 'x/a' }),
    ).toEqual(['x/a'])
    expect(deliveryKeysOf(undefined)).toEqual([])
  })
})

describe('collectItems', () => {
  const noFetch = () => Promise.resolve(undefined)

  it('starts from the keys under the site and follows links', async () => {
    const candidates = [
      hubItem('page', { schema: 'content/page', keys: ['src/home'], fields: { s: link('slot') } }),
      hubItem('slot', { repo: REPOS.slots, fields: { b: [link('hero')] } }),
      hubItem('hero'),
      hubItem('other-site', { schema: 'content/page', keys: ['elsewhere/home'] }),
      hubItem('unlinked'),
    ]
    const result = await collectItems(candidates, { from: 'src', fetchItem: noFetch })
    expect(result.items.map((i) => i.id).sort()).toEqual(['hero', 'page', 'slot'])
    expect(result.roots).toBe(1)
  })

  it("doesn't take a key that merely starts with the site name", async () => {
    const candidates = [hubItem('a', { keys: ['src-two/home'] })]
    const result = await collectItems(candidates, { from: 'src', fetchItem: noFetch })
    expect(result.items).toEqual([])
  })

  it('fetches links that live outside the listed repositories', async () => {
    const outside = hubItem('shared', { repo: 'repo-elsewhere' })
    const fetched: string[] = []
    const result = await collectItems(
      [hubItem('p', { keys: ['src/p'], fields: { x: link('shared') } })],
      {
        from: 'src',
        fetchItem: (id) => {
          fetched.push(id)
          return Promise.resolve(id === 'shared' ? outside : undefined)
        },
      },
    )
    expect(result.items.map((i) => i.id)).toEqual(['p', 'shared'])
    expect(fetched).toEqual(['shared'])
  })

  it('adds hierarchy children by parentId, to a fixed point', async () => {
    const candidates = [
      hubItem('root', { keys: ['src/menu'], hierarchy: { root: true } }),
      hubItem('child', { hierarchy: { root: false, parentId: 'root' } }),
      hubItem('grandchild', {
        hierarchy: { root: false, parentId: 'child' },
        fields: { promo: link('promo') },
      }),
      hubItem('promo'),
      hubItem('stray', { hierarchy: { root: false, parentId: 'not-ours' } }),
    ]
    const result = await collectItems(candidates, { from: 'src', fetchItem: noFetch })
    expect(result.items.map((i) => i.id).sort()).toEqual(['child', 'grandchild', 'promo', 'root'])
  })

  it('reads the parent from the item-level hierarchy when the body has none', async () => {
    const child = { ...hubItem('child'), hierarchy: { root: false, parentId: 'root' } }
    const candidates = [hubItem('root', { keys: ['src/menu'], hierarchy: { root: true } }), child]
    const result = await collectItems(candidates, { from: 'src', fetchItem: noFetch })
    expect(result.items.map((i) => i.id).sort()).toEqual(['child', 'root'])
  })

  it('reports links to missing and archived items instead of following them', async () => {
    const candidates = [
      hubItem('p', { keys: ['src/p'], fields: { a: link('gone'), b: link('old') } }),
      hubItem('old', { status: 'ARCHIVED', label: 'Old hero' }),
    ]
    const result = await collectItems(candidates, { from: 'src', fetchItem: noFetch })
    expect(result.items.map((i) => i.id)).toEqual(['p'])
    expect(result.missing).toEqual([{ from: 'p', id: 'gone' }])
    expect(result.archived).toEqual([{ from: 'p', id: 'old', label: 'Old hero' }])
  })
})

describe('toFixture', () => {
  it('keeps only what a fixture holds, and moves the keys to the new set', () => {
    const item = {
      ...hubItem('h1', { keys: ['src/site/header'], fields: { title: localized('en-GB') } }),
      version: 7,
      folderId: 'f',
      createdBy: 'someone',
      locale: 'en-GB',
    }
    const { fixture, keys, dropped } = toFixture(item, { from: 'src', to: 'dst' })
    expect(dropped).toEqual([])
    expect(keys).toEqual(['dst/site/header'])
    expect(Object.keys(fixture)).toEqual(['id', 'label', 'locale', 'body'])
    expect(fixture.body._meta).toEqual({
      name: 'h1',
      schema: `${V2}/content/hero`,
      deliveryKeys: { values: [{ value: 'dst/site/header' }] },
      deliveryId: 'h1',
    })
    expect(fixture.body.title).toEqual(localized('en-GB'))
  })

  it("keeps only the site's own key on furniture shared with another site", () => {
    const { fixture, dropped } = toFixture(
      hubItem('h', { keys: ['other/site/header', 'src/site/header'] }),
      {
        from: 'src',
        to: 'dst',
      },
    )
    expect(fixture.body._meta.deliveryKeys).toEqual({ values: [{ value: 'dst/site/header' }] })
    expect(dropped).toEqual(['other/site/header'])
  })

  it('keeps the hierarchy root, parent and position', () => {
    const { fixture } = toFixture(
      hubItem('c', { hierarchy: { root: false, parentId: 'r', position: 'O~~' } }),
      { from: 'src', to: 'dst' },
    )
    expect(fixture.body._meta.hierarchy).toEqual({ root: false, parentId: 'r', position: 'O~~' })
  })

  it("doesn't alias the hub item's body", () => {
    const item = hubItem('x', { fields: { list: [1, 2] } })
    const { fixture } = toFixture(item, { from: 'src', to: 'dst' })
    ;(fixture.body.list as number[]).push(3)
    expect(item.body?.list).toEqual([1, 2])
  })
})

describe('keysFor', () => {
  it('keeps every key under the site and drops the rest', () => {
    expect(keysFor(['src/a', 'other/a', 'src/b'], { from: 'src', to: 'dst' })).toEqual({
      keys: ['dst/a', 'dst/b'],
      dropped: ['other/a'],
      rebased: [],
    })
  })

  it('moves a linked item with no key under the site into the new set', () => {
    // A header can link a hierarchy keyed under a different namespace; the
    // frontend finds the tree by that key, so dropping it would lose the nav.
    expect(
      keysFor(['srcx/site/menu', 'other/site/menu', 'bare'], { from: 'src', to: 'dst' }),
    ).toEqual({
      keys: ['dst/site/menu'],
      dropped: ['bare'],
      rebased: ['srcx/site/menu', 'other/site/menu'],
    })
  })

  it('leaves an unkeyed item unkeyed', () => {
    expect(keysFor([], { from: 'src', to: 'dst' })).toEqual({ keys: [], dropped: [], rebased: [] })
  })
})

describe('routeItem', () => {
  it('files by repository first, then pages by schema', () => {
    expect(routeItem(hubItem('a', { repo: REPOS.slots }), REPOS)).toBe('slots')
    expect(routeItem(hubItem('a', { repo: REPOS.siteComponents }), REPOS)).toBe('site-components')
    expect(routeItem(hubItem('a', { schema: 'content/product' }), REPOS)).toBe('pages')
    expect(routeItem(hubItem('a', { schema: 'content/header' }), REPOS)).toBe('components')
  })

  it('leaves site components alone when that repository is not configured', () => {
    const repos = { content: REPOS.content, slots: REPOS.slots }
    expect(routeItem(hubItem('a', { repo: 'repo-site' }), repos)).toBe('components')
  })
})

describe('slugify', () => {
  it('produces a filesystem-safe segment', () => {
    expect(slugify('Jacka i fuskpäls — Höst!')).toBe('jacka-i-fuskpals-host')
    expect(slugify('***')).toBe('')
    expect(slugify('a'.repeat(100))).toHaveLength(80)
  })
})

describe('assignPaths', () => {
  const entry = (item: HubItem, dir: string) => {
    const { fixture, keys } = toFixture(item, { from: 'src', to: 'dst' })
    return { fixture, keys, dir }
  }

  it('names keyed items by key and the rest by label', () => {
    const paths = assignPaths(
      [
        entry(hubItem('p', { keys: ['src/products/Winter Coat'] }), 'pages'),
        entry(hubItem('h', { label: 'Home hero' }), 'components'),
      ],
      { to: 'dst' },
    )
    expect(paths.get('p')).toBe('pages/products/winter-coat.json')
    expect(paths.get('h')).toBe('components/home-hero.json')
  })

  it('settles clashes case-insensitively, the same way whatever the input order', () => {
    const a = entry(hubItem('id-a', { label: 'Shirts' }), 'components')
    const b = entry(hubItem('id-b', { label: 'shirts' }), 'components')
    const one = assignPaths([a, b], { to: 'dst' })
    const two = assignPaths([b, a], { to: 'dst' })
    expect(one).toEqual(two)
    expect(new Set([one.get('id-a'), one.get('id-b')])).toEqual(
      new Set(['components/shirts.json', 'components/shirts-2.json']),
    )
  })

  it('falls back to "item" for a label with nothing usable in it', () => {
    const paths = assignPaths([entry(hubItem('x', { label: '!!!' }), 'components')], {
      to: 'dst',
    })
    expect(paths.get('x')).toBe('components/item.json')
  })
})

describe('buildHierarchyManifests', () => {
  const node = (id: string, parentId?: string, position?: string, label = id) =>
    fixtureOf(
      hubItem(id, {
        label,
        hierarchy:
          parentId === undefined
            ? { root: true }
            : { root: false, parentId, ...(position ? { position } : {}) },
        ...(parentId === undefined ? { keys: ['src/menu'] } : {}),
      }),
    )

  it('orders each parent by position and gives leaves no entry', () => {
    const { manifests, warnings } = buildHierarchyManifests([
      node('root'),
      node('b', 'root', 'g'),
      node('a', 'root', 'O'),
      node('a1', 'a', 'O'),
    ])
    expect(warnings).toEqual([])
    expect(manifests).toEqual({
      'dst/menu': { root: 'root', children: { root: ['a', 'b'], a: ['a1'] } },
    })
  })

  it('warns when siblings share a position, and orders those by label', () => {
    const { manifests, warnings } = buildHierarchyManifests([
      node('root'),
      node('x', 'root', 'O', 'Zed'),
      node('y', 'root', 'O', 'Alpha'),
    ])
    expect(manifests['dst/menu']?.children.root).toEqual(['y', 'x'])
    expect(warnings).toHaveLength(1)
  })

  it('skips a root with no delivery key, saying so', () => {
    const root = fixtureOf(hubItem('r', { hierarchy: { root: true } }))
    const { manifests, warnings } = buildHierarchyManifests([root])
    expect(manifests).toEqual({})
    expect(warnings[0]).toContain('no delivery key')
  })
})

describe('locales', () => {
  const items = [
    fixtureOf(hubItem('a', { fields: { t: localized('en-US', 'fr-FR'), u: localized('fr-FR') } })),
    { ...fixtureOf(hubItem('b')), locale: 'fr-FR' },
  ]

  it('counts localized values and item locales', () => {
    expect(Object.fromEntries(countLocales(items))).toEqual({ 'en-US': 1, 'fr-FR': 3 })
  })

  it('defaults to the most-authored locale and lists them in hub order', () => {
    expect(chooseLocales(countLocales(items), { hubLocales: ['en-US', 'fr-FR'] })).toEqual({
      defaultLocale: 'fr-FR',
      authoredLocales: ['en-US', 'fr-FR'],
    })
  })

  it('takes an explicit default, adding it when nothing is authored in it', () => {
    expect(chooseLocales(countLocales(items), { defaultLocale: 'de-DE' })).toEqual({
      defaultLocale: 'de-DE',
      authoredLocales: ['de-DE', 'en-US', 'fr-FR'],
    })
  })

  it("falls back to the hub's first locale when nothing is localized", () => {
    expect(chooseLocales(new Map(), { hubLocales: ['sv-SE'] }).defaultLocale).toBe('sv-SE')
  })
})

describe('damEndpoints', () => {
  it('lists the endpoints of image and video links', () => {
    const fixture = fixtureOf(
      hubItem('m', {
        fields: {
          a: { id: '1', endpoint: 'acme', _meta: { schema: `${CORE}#/definitions/image-link` } },
          b: { id: '2', endpoint: 'beta', _meta: { schema: `${CORE}#/definitions/video-link` } },
          c: { endpoint: 'not-a-link' },
        },
      }),
    )
    expect(damEndpoints([fixture])).toEqual(['acme', 'beta'])
  })
})

describe('planPull', () => {
  const site = [
    hubItem('page', {
      schema: 'content/page',
      keys: ['src/homepage'],
      fields: { title: localized('en-GB'), slots: [link('slot')] },
    }),
    hubItem('slot', {
      schema: 'slots/slot',
      repo: REPOS.slots,
      fields: { blocks: [link('hero')] },
    }),
    hubItem('hero', { label: 'Home hero' }),
  ]
  const known = new Set(site.map((i) => i.body?._meta?.schema as string))

  it('plans a set: files, set.json, nothing to complain about', () => {
    const plan = planPull(site, { from: 'src', to: 'my-demo', repos: REPOS, knownSchemas: known })
    expect(plan.errors).toEqual([])
    expect(plan.warnings).toEqual([])
    expect(plan.files.map((f) => f.path)).toEqual([
      'components/home-hero.json',
      'pages/homepage.json',
      'slots/slot.json',
    ])
    expect(plan.set).toEqual({
      name: 'my-demo',
      label: 'My Demo',
      description: 'Pulled from the "src" site.',
      defaultBrand: 'default',
      defaultLocale: 'en-GB',
      authoredLocales: ['en-GB'],
      generatedDocs: false,
    })
  })

  it('refuses a content type the starter does not have', () => {
    const plan = planPull(site, {
      from: 'src',
      to: 'd',
      repos: REPOS,
      knownSchemas: new Set([`${V2}/content/page`]),
    })
    expect(plan.errors).toHaveLength(2)
    expect(plan.errors[0]).toContain("isn't a Frontend Starter content type")
  })

  it('warns about an item from a repository it was not pointed at', () => {
    const plan = planPull([hubItem('x', { repo: 'repo-elsewhere' })], {
      from: 'src',
      to: 'd',
      repos: REPOS,
    })
    expect(plan.warnings[0]).toContain('repo-elsewhere')
  })

  it('says which keys it dropped or moved', () => {
    const plan = planPull(
      [
        hubItem('header', { keys: ['src/site/header', 'other/site/header'], label: 'Header' }),
        hubItem('menu', { keys: ['srcx/site/menu'], label: 'Menu' }),
      ],
      { from: 'src', to: 'd', repos: REPOS },
    )
    expect(plan.errors).toEqual([])
    expect(plan.warnings).toEqual([
      '"Header" is shared with another site — dropped "other/site/header".',
      '"Menu" has no "src/" key — moved "srcx/site/menu" into "d/".',
    ])
  })

  it('refuses two items that would land on the same key', () => {
    const plan = planPull(
      [
        hubItem('a', { keys: ['src/site/header'], label: 'Ours' }),
        hubItem('b', { keys: ['other/site/header'], label: 'Theirs' }),
      ],
      { from: 'src', to: 'd', repos: REPOS },
    )
    expect(plan.errors).toEqual(['"Ours" (a) and "Theirs" (b) would all take "d/site/header".'])
  })
})
