// Tests for HierarchyMenuServer (ADR-0015 link localization).
//
// The hierarchy nav is fetched and rendered outside the parent render pass, so
// the active locale has to be handed across that boundary explicitly. These
// tests assert the assembled nav's links carry the locale prefix. Node
// environment — the component is an async Server Component; assertions run
// against react-dom/server markup.

import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  HIERARCHY_MENU_ITEM_SCHEMA,
  HIERARCHY_MENU_SCHEMA,
} from '@amplience/quadratic-components/registry'

const { getHierarchyMock } = vi.hoisted(() => ({ getHierarchyMock: vi.fn() }))

vi.mock('../../lib/content-client', () => ({
  client: {
    getHierarchy: getHierarchyMock,
    getByKey: vi.fn(),
    getById: vi.fn(),
    listBySchema: vi.fn(),
  },
  siteName: 'test',
}))

// Import after the mock is registered.
const { HierarchyMenuServer } = await import('./HierarchyMenuServer')

/** A two-level assembled nav: one top item with one child, both linked. */
const assembledNav = {
  _meta: { schema: HIERARCHY_MENU_SCHEMA },
  items: [
    {
      _meta: { schema: HIERARCHY_MENU_ITEM_SCHEMA },
      label: 'About',
      link: '/about',
      children: [
        { _meta: { schema: HIERARCHY_MENU_ITEM_SCHEMA }, label: 'Team', link: '/about/team' },
      ],
    },
  ],
}

const stub = (localeBasePath?: string) => ({
  _meta: { deliveryKeys: { values: [{ value: 'test/site/nav' }] } },
  ...(localeBasePath !== undefined && { localeBasePath }),
})

const renderServer = async (props: Record<string, unknown>) =>
  renderToStaticMarkup((await HierarchyMenuServer(props as never)) as ReactNode)

afterEach(() => {
  getHierarchyMock.mockReset()
})

describe('HierarchyMenuServer', () => {
  it('prefixes nav links (top-level and nested) with the active locale', async () => {
    getHierarchyMock.mockResolvedValue(assembledNav)
    const out = await renderServer(stub('/fr-fr'))
    expect(out).toContain('href="/fr-fr/about"')
    expect(out).toContain('href="/fr-fr/about/team"')
    expect(out).not.toContain('href="/about"')
  })

  it('leaves links unprefixed for the default locale', async () => {
    getHierarchyMock.mockResolvedValue(assembledNav)
    const out = await renderServer(stub(''))
    expect(out).toContain('href="/about"')
    expect(out).toContain('href="/about/team"')
    expect(out).not.toContain('/fr-fr/')
  })

  it('renders nothing when the stub carries no delivery key', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const out = await renderServer({ _meta: {} })
    expect(out).toBe('')
    expect(getHierarchyMock).not.toHaveBeenCalled()
  })
})
