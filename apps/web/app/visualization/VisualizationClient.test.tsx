// @vitest-environment jsdom
//
// VisualizationClient tests (QL-93).
//
// Three axes:
//   1. Initial render — the component renders initialModel straight away,
//      matching the server-rendered output the editor sees before any form
//      interaction.
//   2. Listener lifecycle — init() is called on mount, the returned
//      unsubscribe function is called on unmount; form.changed() receives
//      the correct SDK options ({ format: 'inlined', depth: 'all' }).
//   3. Live update / fallback — the component re-renders when form.changed
//      fires; gracefully keeps the initial model when init() rejects.
//
// dc-visualization-sdk is mocked throughout so tests run without a real
// content-form iframe. Each test configures the mock to the shape it needs.
//
// Patterns used:
//   render() — @testing-library/react wraps it in act() automatically.
//   waitFor() — polls until async effects (init(), subscription) have settled.
//   act()     — synchronous wrapper for state-triggering calls (_fire, unmount).

import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { init } from 'dc-visualization-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { VisualizationClient } from './VisualizationClient'

// ---------------------------------------------------------------------------
// dc-visualization-sdk mock
//
// vi.mock is hoisted by Vitest; the static import below receives the mock.
// ---------------------------------------------------------------------------

vi.mock('dc-visualization-sdk', () => ({
  init: vi.fn(),
}))

const mockInit = init as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal valid hero body — satisfies the hero schema's validate() guard. */
const HERO_MODEL = {
  _meta: {
    name: 'Home — hero',
    schema: 'https://quadratic.amplience.com/v2/content/hero',
    deliveryId: 'a1b2c3d4-0001-4000-8000-000000000003',
  },
  title: 'Build composable sites.',
  image: {
    src: 'https://picsum.photos/seed/ql-hero/1200/600',
    alt: 'Hero image',
    width: 1200,
    height: 600,
  },
}

/**
 * CDv2Response-wrapped hero — what sdk.form.changed delivers.
 * The SDK wraps the content body in { content: body } (CDv2Response shape);
 * the component unwraps it so the renderer gets the same { _meta, ...fields }
 * it would receive from the server's getById() call.
 */
const UPDATED_HERO_SDK_MODEL = {
  content: {
    ...HERO_MODEL,
    title: 'Updated title from live form.',
  },
}

/**
 * CDv2Response-wrapped unresolved content-link stub.
 * What the SDK emits when a cross-item reference can't be inlined
 * (e.g., references an unpublished item).
 */
const STUB_SDK_MODEL = {
  content: {
    _id: 'aaaaaaaa-bbbb-cccc-dddd-000000000001',
    contentType: 'https://quadratic.amplience.com/v2/content/hero',
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock SDK object. `_fire(model)` simulates the content-form pushing
 * a new model; `_opts()` returns the options form.changed was called with;
 * `_unsubscribe` is the spy the component should call on unmount.
 */
const makeMockSdk = () => {
  const unsubscribe = vi.fn()
  let capturedCb: ((model: unknown) => void) | undefined
  let capturedOpts: unknown

  return {
    form: {
      changed: vi.fn((cb: (model: unknown) => void, opts: unknown) => {
        capturedCb = cb
        capturedOpts = opts
        return unsubscribe
      }),
    },
    _fire: (model: unknown) => capturedCb?.(model),
    _opts: () => capturedOpts,
    _unsubscribe: unsubscribe,
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// 1. Initial render
// ---------------------------------------------------------------------------

describe('VisualizationClient — initial render', () => {
  beforeEach(() => {
    mockInit.mockResolvedValue(makeMockSdk())
  })

  it('renders the initial model immediately', () => {
    render(<VisualizationClient initialModel={HERO_MODEL} />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toContain('Build composable sites.')
  })

  it('does not crash with isTopOfPage set', () => {
    render(<VisualizationClient initialModel={HERO_MODEL} isTopOfPage />)
    expect(screen.getByRole('heading', { level: 1 })).not.toBeNull()
  })

  it('renders a failure card for an unresolved content-link stub as initialModel', () => {
    // initialModel comes from the server (not CDv2-wrapped). The renderer's
    // existing stub path produces a failure card rather than throwing.
    const stub = {
      _id: 'aaaaaaaa-bbbb-cccc-dddd-000000000001',
      contentType: 'https://quadratic.amplience.com/v2/content/hero',
    }
    render(<VisualizationClient initialModel={stub} />)
    expect(document.querySelector('[data-renderer-failure]')).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 2. Listener lifecycle
// ---------------------------------------------------------------------------

describe('VisualizationClient — listener lifecycle', () => {
  it('calls init() on mount', async () => {
    mockInit.mockResolvedValue(makeMockSdk())
    render(<VisualizationClient initialModel={HERO_MODEL} />)
    await waitFor(() => {
      expect(mockInit).toHaveBeenCalledOnce()
    })
  })

  it('subscribes with { format: inlined, depth: all }', async () => {
    const sdk = makeMockSdk()
    mockInit.mockResolvedValue(sdk)

    render(<VisualizationClient initialModel={HERO_MODEL} />)
    await waitFor(() => {
      expect(sdk.form.changed).toHaveBeenCalledOnce()
    })

    expect(sdk._opts()).toEqual({ format: 'inlined', depth: 'all' })
  })

  it('calls unsubscribe on unmount', async () => {
    const sdk = makeMockSdk()
    mockInit.mockResolvedValue(sdk)

    const { unmount } = render(<VisualizationClient initialModel={HERO_MODEL} />)

    // Wait for the subscription to be established before unmounting.
    await waitFor(() => {
      expect(sdk.form.changed).toHaveBeenCalledOnce()
    })

    expect(sdk._unsubscribe).not.toHaveBeenCalled()
    act(() => {
      unmount()
    })
    expect(sdk._unsubscribe).toHaveBeenCalledOnce()
  })

  it('does not throw on unmount when init() rejected before subscribe', async () => {
    // unsubscribe is never set when init rejects — unmount must not throw.
    mockInit.mockRejectedValue(new Error('not in form'))

    const { unmount } = render(<VisualizationClient initialModel={HERO_MODEL} />)

    // Wait for the rejected promise to settle.
    await waitFor(() => {
      expect(mockInit).toHaveBeenCalledOnce()
    })

    expect(() => {
      act(() => {
        unmount()
      })
    }).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// 3. Live updates and fallback
// ---------------------------------------------------------------------------

describe('VisualizationClient — live updates', () => {
  it('re-renders with the pushed model when form.changed fires', async () => {
    const sdk = makeMockSdk()
    mockInit.mockResolvedValue(sdk)

    render(<VisualizationClient initialModel={HERO_MODEL} />)

    await waitFor(() => {
      expect(sdk.form.changed).toHaveBeenCalledOnce()
    })

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
      'Build composable sites.',
    )

    act(() => {
      sdk._fire(UPDATED_HERO_SDK_MODEL)
    })

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
      'Updated title from live form.',
    )
  })

  it('keeps the initial model when init() rejects (standalone / fallback path)', async () => {
    mockInit.mockRejectedValue(new Error('not embedded in content form'))

    render(<VisualizationClient initialModel={HERO_MODEL} />)

    await waitFor(() => {
      expect(mockInit).toHaveBeenCalledOnce()
    })

    // Still shows initial content — no blank, no crash.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
      'Build composable sites.',
    )
  })

  it('renders a stub failure card for an unresolvable cross-item reference', async () => {
    const sdk = makeMockSdk()
    mockInit.mockResolvedValue(sdk)

    render(<VisualizationClient initialModel={HERO_MODEL} />)

    await waitFor(() => {
      expect(sdk.form.changed).toHaveBeenCalledOnce()
    })

    // Form pushes a CDv2Response whose .content is an unresolved stub.
    act(() => {
      sdk._fire(STUB_SDK_MODEL)
    })

    expect(document.querySelector('[data-renderer-failure]')).not.toBeNull()
  })
})
