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

// A leaf that surfaces both render-context cues, for the isTopOfPage tests.
const EDGE_SCHEMA = 'https://test.example.com/v1/content/edge'
type EdgeProps = { label: string; bare?: boolean; isTopOfPage?: boolean }
const Edge = ({ label, bare, isTopOfPage }: EdgeProps) => (
  <span data-bare={bare ?? false} data-top={isTopOfPage ?? false}>
    {label}
  </span>
)

const edgeEntry: ComponentRegistryEntry<LeafSchema, EdgeProps> = {
  component: Edge,
  propsFromSchema: ({ _meta: _envelope, ...props }, ctx) => ({
    ...props,
    bare: ctx.bare ?? false,
    isTopOfPage: ctx.isTopOfPage ?? false,
  }),
}

const makeRegistry = (): Registry =>
  new Map<SchemaURI, AnyComponentRegistryEntry>([
    [LEAF_SCHEMA, leafEntry],
    [BOX_SCHEMA, boxEntry],
    [IDENTITY_SCHEMA, { component: Identity }],
    [EDGE_SCHEMA, edgeEntry],
  ])

const node = (schema: string, fields: Record<string, unknown> = {}, deliveryId?: string) => ({
  _meta: { schema, ...(deliveryId === undefined ? {} : { deliveryId }) },
  ...fields,
})

const html = (content: unknown, registry: Registry = makeRegistry()): string =>
  renderToStaticMarkup(<>{renderContent(content, registry)}</>)

/** As `html`, but seeded with a root context — how the route renders pages. */
const htmlTop = (content: unknown): string =>
  renderToStaticMarkup(<>{renderContent(content, makeRegistry(), { isTopOfPage: true })}</>)

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

describe('renderContent — isTopOfPage', () => {
  const edge = (label: string, id: string) => node(EDGE_SCHEMA, { label }, id)

  it('is false everywhere when no root context is seeded', () => {
    expect(html(edge('solo', 'id-1'))).toBe('<span data-bare="false" data-top="false">solo</span>')
  })

  it('reaches the root node when seeded', () => {
    expect(htmlTop(edge('solo', 'id-1'))).toBe(
      '<span data-bare="false" data-top="true">solo</span>',
    )
  })

  it('survives into the first array element only', () => {
    expect(htmlTop([edge('first', 'id-1'), edge('second', 'id-2')])).toBe(
      '<span data-bare="false" data-top="true">first</span>' +
        '<span data-bare="false" data-top="false">second</span>',
    )
  })

  it('flows along the leading edge of nested containers (page → first slot → first block)', () => {
    const tree = node(BOX_SCHEMA, {
      name: 'page',
      items: [
        node(BOX_SCHEMA, { name: 'slot-1', items: [edge('a', 'id-a'), edge('b', 'id-b')] }, 'id-1'),
        node(BOX_SCHEMA, { name: 'slot-2', items: [edge('c', 'id-c')] }, 'id-2'),
      ],
    })
    // Only the first block of the first slot is top-of-page; the container's
    // own childContext (bare) is preserved alongside the inherited flag.
    expect(htmlTop(tree)).toBe(
      '<div data-box="page">' +
        '<div data-box="slot-1">' +
        '<span data-bare="true" data-top="true">a</span>' +
        '<span data-bare="true" data-top="false">b</span>' +
        '</div>' +
        '<div data-box="slot-2">' +
        '<span data-bare="true" data-top="false">c</span>' +
        '</div>' +
        '</div>',
    )
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
