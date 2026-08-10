// Unit tests for the renderer dispatcher (QL-36).
//
// Per ADR-0010's testability claim: each test constructs a tiny registry,
// calls renderContent, and asserts on server-rendered markup. No mocking,
// no module patching, no jsdom — the dispatcher is a pure function and
// renderToStaticMarkup is the same SSR path Next.js exercises.

import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createRegistry,
  HERO_BLOCK_SCHEMA,
  heroBlockRegistryEntry,
} from '@amplience/quadratic-components/registry'
import { CONTENT_LINK_SCHEMA } from '@amplience/quadratic-content'
import type {
  AnyComponentRegistryEntry,
  ComponentRegistryEntry,
  MediaLoadPriority,
  Registry,
  SchemaURI,
} from '@amplience/quadratic-types'

import { renderContent } from './dispatch'

// ---------------------------------------------------------------------------
// Stub components and registry
// ---------------------------------------------------------------------------

const LEAF_SCHEMA = 'https://test.example.com/v1/content/leaf'
const BOX_SCHEMA = 'https://test.example.com/v1/content/box'
const IDENTITY_SCHEMA = 'https://test.example.com/v1/content/identity'

type LeafSchema = { _meta: unknown; label: string }
type LeafProps = { label: string; bare?: boolean }
const Leaf = ({ label, bare }: LeafProps) => <span data-bare={bare ?? false}>{label}</span>

const leafEntry: ComponentRegistryEntry<LeafSchema, LeafProps> = {
  component: Leaf,
  propsFromSchema: ({ _meta: _envelope, ...props }, ctx) => ({ ...props, bare: ctx.bare ?? false }),
}

type BoxSchema = { _meta: unknown; name: string; items?: readonly unknown[] }
type BoxProps = { name: string; children?: ReactNode }
const Box = ({ name, children }: BoxProps) => <div data-box={name}>{children}</div>

const boxEntry: ComponentRegistryEntry<BoxSchema, BoxProps> = {
  component: Box,
  propsFromSchema: ({ _meta: _envelope, items: _items, ...props }) => props,
  getChildren: (schema) => schema.items ?? [],
  childContext: { bare: true },
}

type IdentityProps = { _meta?: unknown; label?: string }
const Identity = ({ label }: IdentityProps) => <em>{label}</em>

// A leaf that surfaces both render-context cues, for the loadPriority tests.
const EDGE_SCHEMA = 'https://test.example.com/v1/content/edge'
type EdgeProps = { label: string; bare?: boolean; loadPriority?: MediaLoadPriority }
const Edge = ({ label, bare, loadPriority }: EdgeProps) => (
  <span data-bare={bare ?? false} data-tier={loadPriority ?? 'lazy'}>
    {label}
  </span>
)

const edgeEntry: ComponentRegistryEntry<LeafSchema, EdgeProps> = {
  component: Edge,
  propsFromSchema: ({ _meta: _envelope, ...props }, ctx) => ({
    ...props,
    bare: ctx.bare ?? false,
    loadPriority: ctx.loadPriority ?? 'lazy',
  }),
}

// A container that consumes the tier for media of its own before passing what's
// left to its children — the BlogArticle shape (cover image above body slots).
const COVER_BOX_SCHEMA = 'https://test.example.com/v1/content/cover-box'
type CoverBoxProps = { name: string; loadPriority?: MediaLoadPriority; children?: ReactNode }
const CoverBox = ({ name, loadPriority, children }: CoverBoxProps) => (
  <div data-box={name} data-tier={loadPriority ?? 'lazy'}>
    {children}
  </div>
)
const coverBoxEntry: ComponentRegistryEntry<BoxSchema, CoverBoxProps> = {
  component: CoverBox,
  consumesLoadPriority: true,
  propsFromSchema: ({ _meta: _envelope, items: _items, ...props }, ctx) => ({
    ...props,
    loadPriority: ctx.loadPriority ?? 'lazy',
  }),
  getChildren: (schema) => schema.items ?? [],
}

// A container that derives per-instance child context (slotSizes) from its
// own content, plus a leaf that surfaces the received slotSizes — for the
// childContextFromSchema tests.
const SIZED_BOX_SCHEMA = 'https://test.example.com/v1/content/sized-box'
const SIZED_LEAF_SCHEMA = 'https://test.example.com/v1/content/sized-leaf'

type SizedBoxSchema = { _meta: unknown; name: string; slot: string; items?: readonly unknown[] }
const sizedBoxEntry: ComponentRegistryEntry<SizedBoxSchema, BoxProps> = {
  component: Box,
  propsFromSchema: ({ _meta: _envelope, items: _items, slot: _slot, ...props }) => props,
  getChildren: (schema) => schema.items ?? [],
  childContext: { bare: true },
  childContextFromSchema: (schema) => ({ slotSizes: schema.slot }),
}

type SizedLeafSchema = { _meta: unknown; label: string }
type SizedLeafProps = { label: string; slotSizes?: string }
const SizedLeaf = ({ label, slotSizes }: SizedLeafProps) => (
  <span data-slot={slotSizes ?? 'none'}>{label}</span>
)
const sizedLeafEntry: ComponentRegistryEntry<SizedLeafSchema, SizedLeafProps> = {
  component: SizedLeaf,
  propsFromSchema: ({ _meta: _envelope, ...props }, ctx) => ({
    ...props,
    ...(ctx.slotSizes !== undefined && { slotSizes: ctx.slotSizes }),
  }),
}

const makeRegistry = (): Registry =>
  new Map<SchemaURI, AnyComponentRegistryEntry>([
    [LEAF_SCHEMA, leafEntry],
    [BOX_SCHEMA, boxEntry],
    [IDENTITY_SCHEMA, { component: Identity }],
    [EDGE_SCHEMA, edgeEntry],
    [COVER_BOX_SCHEMA, coverBoxEntry],
    [SIZED_BOX_SCHEMA, sizedBoxEntry],
    [SIZED_LEAF_SCHEMA, sizedLeafEntry],
  ])

const node = (schema: string, fields: Record<string, unknown> = {}, deliveryId?: string) => ({
  _meta: { schema, ...(deliveryId === undefined ? {} : { deliveryId }) },
  ...fields,
})

const html = (content: unknown, registry: Registry = makeRegistry()): string =>
  renderToStaticMarkup(<>{renderContent(content, registry)}</>)

/** As `html`, but seeded with a root context — how the route renders pages. */
const htmlTop = (content: unknown): string =>
  renderToStaticMarkup(<>{renderContent(content, makeRegistry(), { loadPriority: 'lcp' })}</>)

// The dispatcher emits a structured console signal on every failure exit —
// silence it (and assert on it) via a spy.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe('renderContent — dispatch', () => {
  it('dispatches a leaf node by _meta.schema and adapts its props', () => {
    expect(html(node(LEAF_SCHEMA, { label: 'hello' }))).toBe('<span data-bare="false">hello</span>')
  })

  it('passes content through as-is when the entry has no adapter (identity, §4)', () => {
    expect(html(node(IDENTITY_SCHEMA, { label: 'as-is' }))).toBe('<em>as-is</em>')
  })

  it('renders an array node element-wise, in order', () => {
    const out = html([
      node(LEAF_SCHEMA, { label: 'one' }, 'id-1'),
      node(LEAF_SCHEMA, { label: 'two' }, 'id-2'),
    ])
    expect(out).toBe('<span data-bare="false">one</span><span data-bare="false">two</span>')
  })

  it('renders null/undefined nodes as nothing', () => {
    expect(html(null)).toBe('')
    expect(html(undefined)).toBe('')
  })
})

describe('renderContent — recursion', () => {
  it('renders container children via getChildren and passes them as children', () => {
    const tree = node(BOX_SCHEMA, {
      name: 'outer',
      items: [node(LEAF_SCHEMA, { label: 'inside' }, 'id-1')],
    })
    expect(html(tree)).toBe('<div data-box="outer"><span data-bare="true">inside</span></div>')
  })

  it('applies the container childContext (bare) one level only', () => {
    // leaf directly in the box → bare; leaf inside a nested box → bare again,
    // but a top-level leaf stays non-bare.
    const tree = [
      node(LEAF_SCHEMA, { label: 'top' }, 'id-1'),
      node(
        BOX_SCHEMA,
        { name: 'outer', items: [node(LEAF_SCHEMA, { label: 'nested' }, 'id-2')] },
        'id-3',
      ),
    ]
    expect(html(tree)).toBe(
      '<span data-bare="false">top</span>' +
        '<div data-box="outer"><span data-bare="true">nested</span></div>',
    )
  })

  it('recurses through deeply nested containers (page → slot → grid shape)', () => {
    const tree = node(BOX_SCHEMA, {
      name: 'page',
      items: [
        node(
          BOX_SCHEMA,
          {
            name: 'slot',
            items: [
              node(
                BOX_SCHEMA,
                { name: 'grid', items: [node(LEAF_SCHEMA, { label: 'deep' }, 'id-1')] },
                'id-2',
              ),
            ],
          },
          'id-3',
        ),
      ],
    })
    expect(html(tree)).toBe(
      '<div data-box="page"><div data-box="slot"><div data-box="grid">' +
        '<span data-bare="true">deep</span>' +
        '</div></div></div>',
    )
  })

  it('renders an empty container when getChildren returns no items', () => {
    expect(html(node(BOX_SCHEMA, { name: 'empty' }))).toBe('<div data-box="empty"></div>')
  })
})

describe('renderContent — childContextFromSchema', () => {
  it('merges the derived child context into the children', () => {
    const tree = node(SIZED_BOX_SCHEMA, {
      name: 'grid',
      slot: '50vw',
      items: [node(SIZED_LEAF_SCHEMA, { label: 'x' }, 'id-1')],
    })
    expect(html(tree)).toBe('<div data-box="grid"><span data-slot="50vw">x</span></div>')
  })

  it('does not leak slotSizes past the immediate children', () => {
    // sized box → plain box → sized leaf: the leaf is a grandchild, so the
    // intervening plain box (which declares no slotSizes) resets it.
    const tree = node(SIZED_BOX_SCHEMA, {
      name: 'grid',
      slot: '50vw',
      items: [
        node(
          BOX_SCHEMA,
          { name: 'inner', items: [node(SIZED_LEAF_SCHEMA, { label: 'x' }, 'id-1')] },
          'id-2',
        ),
      ],
    })
    expect(html(tree)).toBe(
      '<div data-box="grid"><div data-box="inner"><span data-slot="none">x</span></div></div>',
    )
  })
})

describe('renderContent — loadPriority (ADR-0021)', () => {
  const edge = (label: string, id: string) => node(EDGE_SCHEMA, { label }, id)
  const span = (label: string, tier: string, bare = false) =>
    `<span data-bare="${bare}" data-tier="${tier}">${label}</span>`

  it('is lazy everywhere when no root context is seeded', () => {
    expect(html(edge('solo', 'id-1'))).toBe(span('solo', 'lazy'))
  })

  it('reaches the root node at the tier it was seeded with', () => {
    expect(htmlTop(edge('solo', 'id-1'))).toBe(span('solo', 'lcp'))
  })

  it('demotes by one step across the first two siblings, then goes lazy', () => {
    // The ladder that motivates the whole cue: one LCP candidate, one
    // above-the-fold-but-not-LCP neighbour, lazy from there down.
    expect(htmlTop([edge('first', 'id-1'), edge('second', 'id-2'), edge('third', 'id-3')])).toBe(
      span('first', 'lcp') + span('second', 'eager') + span('third', 'lazy'),
    )
  })

  it('demotes an eager group to lazy at the second sibling (no second eager step)', () => {
    const out = renderToStaticMarkup(
      <>
        {renderContent([edge('first', 'id-1'), edge('second', 'id-2')], makeRegistry(), {
          loadPriority: 'eager',
        })}
      </>,
    )
    expect(out).toBe(span('first', 'eager') + span('second', 'lazy'))
  })

  it('flows through structural containers, demoting per sibling at each level', () => {
    const tree = node(BOX_SCHEMA, {
      name: 'page',
      items: [
        node(BOX_SCHEMA, { name: 'slot-1', items: [edge('a', 'id-a'), edge('b', 'id-b')] }, 'id-1'),
        node(BOX_SCHEMA, { name: 'slot-2', items: [edge('c', 'id-c')] }, 'id-2'),
      ],
    })
    // Structural containers render no media of their own, so they forward the
    // tier untouched — otherwise nothing would ever reach the first real block.
    // The container's own childContext (bare) survives alongside it.
    expect(htmlTop(tree)).toBe(
      '<div data-box="page">' +
        '<div data-box="slot-1">' +
        span('a', 'lcp', true) +
        span('b', 'eager', true) +
        '</div>' +
        '<div data-box="slot-2">' +
        // slot-2 is sibling 1 of the page, so it arrives eager and its only
        // child keeps that; sibling 2 onwards would be lazy.
        span('c', 'eager', true) +
        '</div>' +
        '</div>',
    )
  })

  it('spends a step on a container that consumes the tier for its own media', () => {
    // The BlogArticle case: the cover image takes 'lcp', so the body slots
    // start one step below it — never two 'lcp' nodes (and two preloads) on a
    // page.
    const tree = node(COVER_BOX_SCHEMA, {
      name: 'article',
      items: [edge('body-1', 'id-1'), edge('body-2', 'id-2')],
    })
    expect(htmlTop(tree)).toBe(
      '<div data-box="article" data-tier="lcp">' +
        span('body-1', 'eager') +
        span('body-2', 'lazy') +
        '</div>',
    )
  })

  it('lets a container derive its own child tier, overriding what it inherited', () => {
    // childContextFromSchema runs last, so a container that knows its own
    // geometry can override an inherited cue rather than have it reapplied.
    const registry: Registry = new Map<SchemaURI, AnyComponentRegistryEntry>([
      [EDGE_SCHEMA, edgeEntry],
      [
        BOX_SCHEMA,
        { ...boxEntry, childContextFromSchema: () => ({ bare: true, loadPriority: 'lazy' }) },
      ],
    ])
    const tree = node(BOX_SCHEMA, { name: 'quiet', items: [edge('a', 'id-a')] })
    const out = renderToStaticMarkup(<>{renderContent(tree, registry, { loadPriority: 'lcp' })}</>)
    expect(out).toBe('<div data-box="quiet">' + span('a', 'lazy', true) + '</div>')
  })
})

// ---------------------------------------------------------------------------
// Loud failure (§5B / §6)
// ---------------------------------------------------------------------------

describe('renderContent — loud failure', () => {
  it('renders a SchemaUnknown card for an unregistered schema URI', () => {
    const out = html(node('https://test.example.com/v1/content/mystery'))
    expect(out).toContain('data-renderer-failure="SchemaUnknown"')
    expect(out).toContain('https://test.example.com/v1/content/mystery')
    expect(console.error).toHaveBeenCalledOnce()
  })

  it('renders a SchemaUnknown card when _meta.schema is missing', () => {
    const out = html({ label: 'no envelope' })
    expect(out).toContain('data-renderer-failure="SchemaUnknown"')
    expect(out).toContain('(missing _meta.schema)')
  })

  it('renders a SchemaUnknown card with a fetch-depth hint for an unresolved content-link', () => {
    const stub = {
      id: 'a1b2c3d4-0000-4000-8000-000000000000',
      contentType: LEAF_SCHEMA,
      _meta: { schema: CONTENT_LINK_SCHEMA },
    }
    const out = html(stub)
    expect(out).toContain('data-renderer-failure="SchemaUnknown"')
    expect(out).toContain('was not resolved')
  })

  it('renders a ComponentUnregistered card when the entry has no component', () => {
    const registry: Registry = new Map([
      [LEAF_SCHEMA, { component: undefined } as unknown as ComponentRegistryEntry],
    ])
    const out = html(node(LEAF_SCHEMA, { label: 'x' }), registry)
    expect(out).toContain('data-renderer-failure="ComponentUnregistered"')
  })

  it('renders a PropsValidationFailure card when validate rejects the content', () => {
    const registry: Registry = new Map([
      [
        LEAF_SCHEMA,
        {
          ...leafEntry,
          validate: (schema): schema is LeafSchema =>
            typeof (schema as LeafSchema).label === 'string',
        },
      ],
    ])
    const out = html(node(LEAF_SCHEMA, { label: 42 }), registry)
    expect(out).toContain('data-renderer-failure="PropsValidationFailure"')
  })

  it('renders a PropsValidationFailure card when the adapter throws', () => {
    const registry: Registry = new Map([
      [
        LEAF_SCHEMA,
        {
          component: Leaf,
          propsFromSchema: () => {
            throw new Error('missing required field "label"')
          },
        } as ComponentRegistryEntry,
      ],
    ])
    const out = html(node(LEAF_SCHEMA), registry)
    expect(out).toContain('data-renderer-failure="PropsValidationFailure"')
  })

  it('localises failure — siblings of a failing node still render (§5B)', () => {
    const out = html([
      node(LEAF_SCHEMA, { label: 'before' }, 'id-1'),
      node('https://test.example.com/v1/content/mystery', {}, 'id-2'),
      node(LEAF_SCHEMA, { label: 'after' }, 'id-3'),
    ])
    expect(out).toContain('before')
    expect(out).toContain('data-renderer-failure="SchemaUnknown"')
    expect(out).toContain('after')
  })

  it('rejects mismatched real-world content — hero missing its title (QL-37)', () => {
    // Through the real hero entry (the same instance defaultRegistry uses),
    // not a stub: the contract validator rejects content with no title.
    const registry = createRegistry([[HERO_BLOCK_SCHEMA, heroBlockRegistryEntry]])
    const badHero = {
      _meta: { schema: HERO_BLOCK_SCHEMA, deliveryId: 'hero-no-title' },
      subtitle: 'No title on this hero.',
    }
    const out = html(badHero, registry)
    expect(out).toContain('data-renderer-failure="PropsValidationFailure"')
    expect(out).toContain(HERO_BLOCK_SCHEMA)
  })

  it('localises failure inside a container — the parent still renders', () => {
    const tree = node(BOX_SCHEMA, {
      name: 'outer',
      items: [
        node('https://test.example.com/v1/content/mystery', {}, 'id-1'),
        node(LEAF_SCHEMA, { label: 'good' }, 'id-2'),
      ],
    })
    const out = html(tree)
    expect(out).toContain('data-box="outer"')
    expect(out).toContain('data-renderer-failure="SchemaUnknown"')
    expect(out).toContain('good')
  })
})
