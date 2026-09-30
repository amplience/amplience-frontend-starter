// Per-block custom CSS through the dispatcher (ADR-0026).
//
// Same approach as dispatch.test.tsx: tiny stub registries, renderContent,
// assertions on server-rendered markup. The last block runs every real block
// that offers the field through defaultRegistry, so a component that stops
// passing `className` to its root fails here rather than silently dropping
// an editor's CSS.

import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CAROUSEL_BLOCK_SCHEMA,
  COLUMNS_BLOCK_SCHEMA,
  defaultRegistry,
  GRID_BLOCK_SCHEMA,
  HERO_BLOCK_SCHEMA,
  MARKDOWN_BLOCK_SCHEMA,
  MEDIA_BLOCK_SCHEMA,
  MEDIA_CARD_SCHEMA,
} from '@amplience/frontend-starter-components/registry'
import type {
  AnyComponentRegistryEntry,
  ComponentRegistryEntry,
  Registry,
  SchemaURI,
} from '@amplience/frontend-starter-types'

import { BLOCK_CSS_PRECEDENCE, prepareBlockCss } from './block-css'
import { renderContent } from './dispatch'

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

const CARD_SCHEMA = 'https://test.example.com/v1/content/card'
const SECTION_SCHEMA = 'https://test.example.com/v1/content/section'
const SPREADER_SCHEMA = 'https://test.example.com/v1/content/spreader'

type CardSchema = { _meta: unknown; label: string; className?: string }
type CardProps = { label: string; className?: string }
const Card = ({ label, className }: CardProps) => <p className={className}>{label}</p>

const cardEntry: ComponentRegistryEntry<CardSchema, CardProps> = {
  component: Card,
  propsFromSchema: ({ _meta: _envelope, ...props }) => props,
}

type SectionSchema = { _meta: unknown; items?: readonly unknown[] }
type SectionProps = { className?: string; children?: ReactNode }
const Section = ({ className, children }: SectionProps) => (
  <section className={className}>{children}</section>
)
const sectionEntry: ComponentRegistryEntry<SectionSchema, SectionProps> = {
  component: Section,
  propsFromSchema: () => ({}),
  getChildren: (schema) => schema.items ?? [],
}

// A component that spreads every prop it receives onto the DOM — the worst
// case for a field leaking through an adapter that spreads the body.
const Spreader = (props: Record<string, unknown>) => <div {...props} />
const spreaderEntry: AnyComponentRegistryEntry = {
  component: Spreader,
  propsFromSchema: ({ _meta: _envelope, ...props }: { _meta: unknown }) => props,
}

const registry: Registry = new Map<SchemaURI, AnyComponentRegistryEntry>([
  [CARD_SCHEMA, cardEntry],
  [SECTION_SCHEMA, sectionEntry],
  [SPREADER_SCHEMA, spreaderEntry],
])

const node = (schema: string, fields: Record<string, unknown> = {}) => ({
  _meta: { schema },
  ...fields,
})

const html = (content: unknown, reg: Registry = registry): string =>
  renderToStaticMarkup(<>{renderContent(content, reg)}</>)

const scopeOf = (css: string): string => {
  const prepared = prepareBlockCss(css)
  if (!prepared?.ok) throw new Error('expected valid CSS')
  return prepared.className
}

const CSS = 'background: hotpink; h2 { color: white; }'

/** How many times `needle` occurs in `haystack` (no dynamic RegExp — ReDoS rule). */
const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1

/** Every class token on every element in `markup`. */
const classTokens = (markup: string): string[] =>
  [...markup.matchAll(/class="([^"]*)"/g)].flatMap((m) => (m[1] ?? '').split(' '))

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

describe('block CSS — dispatch', () => {
  it('adds the scoping class to the component root and emits the scoped stylesheet', () => {
    const scope = scopeOf(CSS)
    const out = html(node(CARD_SCHEMA, { label: 'x', customCss: CSS }))
    expect(out).toContain(`<p class="${scope}">x</p>`)
    expect(out).toContain(`.${scope} {`)
    expect(out).toContain('background: hotpink;')
  })

  it('marks the stylesheet as a hoistable in the block-css precedence group', () => {
    const scope = scopeOf(CSS)
    const out = html(node(CARD_SCHEMA, { label: 'x', customCss: CSS }))
    expect(out).toContain(`data-precedence="${BLOCK_CSS_PRECEDENCE}"`)
    expect(out).toContain(`data-href="${scope}"`)
  })

  it('joins, rather than replaces, a className the adapter produced', () => {
    const scope = scopeOf(CSS)
    const out = html(node(CARD_SCHEMA, { label: 'x', className: 'existing', customCss: CSS }))
    expect(out).toContain(`class="existing ${scope}"`)
  })

  it('never passes the field to the component', () => {
    const out = html(node(SPREADER_SCHEMA, { customCss: CSS }))
    expect(out).not.toMatch(/customcss=/i)
    // The CSS appears once — in the stylesheet — never as an attribute value.
    expect(out.split('hotpink').length - 1).toBe(1)
  })

  it('leaves blocks without the field untouched', () => {
    const out = html(node(CARD_SCHEMA, { label: 'x' }))
    expect(out).toBe('<p>x</p>')
  })

  it('treats a blank value as absent', () => {
    expect(html(node(CARD_SCHEMA, { label: 'x', customCss: '   ' }))).toBe('<p>x</p>')
  })

  it('emits identical CSS once, however many blocks carry it', () => {
    const tree = node(SECTION_SCHEMA, {
      items: [
        node(CARD_SCHEMA, { label: 'a', customCss: CSS }),
        node(CARD_SCHEMA, { label: 'b', customCss: CSS }),
      ],
    })
    const out = html(tree)
    expect(count(out, '<style')).toBe(1)
    expect(count(out, `class="${scopeOf(CSS)}"`)).toBe(2)
  })

  it('scopes a container and its child independently, parent first', () => {
    const parentCss = '--color-primary: red;'
    const childCss = 'color: blue;'
    const tree = node(SECTION_SCHEMA, {
      customCss: parentCss,
      items: [node(CARD_SCHEMA, { label: 'child', customCss: childCss })],
    })
    const out = html(tree)
    expect(out).toContain(`<section class="${scopeOf(parentCss)}">`)
    expect(out).toContain(`<p class="${scopeOf(childCss)}">child</p>`)
    // Source order is what lets the child's rules win a tie with the parent's.
    expect(out.indexOf(`.${scopeOf(parentCss)} {`)).toBeLessThan(
      out.indexOf(`.${scopeOf(childCss)} {`),
    )
  })

  it('renders the block without CSS that fails validation, and warns', () => {
    const bad = '} body { display: none; } x {'
    const out = html(node(CARD_SCHEMA, { label: 'x', customCss: bad }))
    expect(out).toBe('<p>x</p>')
    expect(console.warn).toHaveBeenCalledOnce()
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls[0])).toContain('BlockCssRejected')
    expect(console.error).not.toHaveBeenCalled()
  })

  it('does not stop an unregistered schema failing loudly', () => {
    const out = html(node('https://test.example.com/v1/content/mystery', { customCss: CSS }))
    expect(out).toContain('data-renderer-failure="SchemaUnknown"')
    expect(out).not.toContain('<style')
  })
})

// ---------------------------------------------------------------------------
// Real blocks
// ---------------------------------------------------------------------------

const image = {
  mediaType: 'ManualImage',
  image: { src: 'https://example.com/a.jpg', alt: 'A', width: 800, height: 600 },
}

/** The blocks whose schemas offer `customCss`, each with a minimal body. */
const REAL_BLOCKS: readonly [string, Record<string, unknown>][] = [
  [HERO_BLOCK_SCHEMA, { title: 'Hero' }],
  [CAROUSEL_BLOCK_SCHEMA, { items: [] }],
  [COLUMNS_BLOCK_SCHEMA, { items: [] }],
  [GRID_BLOCK_SCHEMA, { items: [] }],
  [MARKDOWN_BLOCK_SCHEMA, { content: 'Hello' }],
  [MEDIA_CARD_SCHEMA, { title: 'Card', media: image }],
  [MEDIA_BLOCK_SCHEMA, { media: image }],
]

describe('block CSS — real blocks', () => {
  it.each(REAL_BLOCKS)('%s puts the scoping class on its root', (schema, body) => {
    const out = html(node(schema, { ...body, customCss: CSS }), defaultRegistry)
    expect(out).not.toContain('data-renderer-failure')
    // The class sits alongside the component's stable theming-hook class.
    expect(classTokens(out)).toContain(scopeOf(CSS))
  })
})
