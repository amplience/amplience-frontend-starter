// @vitest-environment jsdom
//
// CustomCssVisualization tests.
//
// The custom-CSS visualization renders a page (passed as children) with the
// item's CSS injected on top, and updates that CSS live from the content form.
// Axes:
//   1. Initial render — children + a <style> seeded from initialCss.
//   2. Live update — form.changed pushes a new custom-CSS model; the <style>
//      reflects content.css, </style> breakouts neutralised.
//   3. Fallback / lifecycle — init() rejection keeps the initial CSS; the
//      subscription is torn down on unmount.
//
// dc-visualization-sdk is mocked (no real content-form iframe).

import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { init } from 'dc-visualization-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CUSTOM_CSS_STYLE_ID } from '../../lib/custom-css-schema'
import { CustomCssVisualization } from './CustomCssVisualization'

vi.mock('dc-visualization-sdk', () => ({ init: vi.fn() }))

const mockInit = init as ReturnType<typeof vi.fn>

/** Mock SDK: `_fire(model)` simulates a form push; `_unsubscribe` is the teardown spy. */
const makeMockSdk = () => {
  const unsubscribe = vi.fn()
  let cb: ((model: unknown) => void) | undefined
  return {
    form: {
      changed: vi.fn((fn: (model: unknown) => void) => {
        cb = fn
        return unsubscribe
      }),
    },
    _fire: (model: unknown) => cb?.(model),
    _unsubscribe: unsubscribe,
  }
}

const styleEl = () => document.getElementById('amplience-custom-css')

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('CustomCssVisualization', () => {
  it('renders the page children and the initial CSS', () => {
    mockInit.mockResolvedValue(makeMockSdk())
    render(
      <CustomCssVisualization initialCss=":root{--color-primary:#0f0}">
        <p>home page</p>
      </CustomCssVisualization>,
    )
    expect(screen.getByText('home page')).toBeTruthy()
    expect(styleEl()?.innerHTML).toContain('--color-primary:#0f0')
  })

  it('updates the injected CSS live from the content form', async () => {
    const sdk = makeMockSdk()
    mockInit.mockResolvedValue(sdk)
    render(
      <CustomCssVisualization initialCss=":root{--color-primary:#0f0}">
        <p>home page</p>
      </CustomCssVisualization>,
    )
    await waitFor(() => expect(sdk.form.changed).toHaveBeenCalled())
    act(() => {
      sdk._fire({ content: { css: ':root{--color-primary:#f0f}' } })
    })
    await waitFor(() => expect(styleEl()?.innerHTML).toContain('--color-primary:#f0f'))
  })

  it('neutralises a </style> breakout in the live CSS', async () => {
    const sdk = makeMockSdk()
    mockInit.mockResolvedValue(sdk)
    render(
      <CustomCssVisualization initialCss="">
        <p>home page</p>
      </CustomCssVisualization>,
    )
    await waitFor(() => expect(sdk.form.changed).toHaveBeenCalled())
    act(() => {
      sdk._fire({ content: { css: 'a{}</style><script>x</script>' } })
    })
    await waitFor(() => expect(styleEl()).not.toBeNull())
    expect(styleEl()?.innerHTML).not.toContain('</style>')
  })

  it('keeps the initial CSS when the SDK is unavailable (standalone)', async () => {
    mockInit.mockRejectedValue(new Error('not in an iframe'))
    render(
      <CustomCssVisualization initialCss=":root{--color-primary:#0f0}">
        <p>home page</p>
      </CustomCssVisualization>,
    )
    await waitFor(() => expect(styleEl()?.innerHTML).toContain('--color-primary:#0f0'))
  })

  it('disables the published custom-CSS layer so only the live edit applies', () => {
    // Simulate the root layout's published injection (a precedence-keyed <style>).
    const published = document.createElement('style')
    published.setAttribute('data-precedence', CUSTOM_CSS_STYLE_ID)
    published.textContent = ':root{--color-primary:#ccc}'
    document.head.appendChild(published)

    mockInit.mockResolvedValue(makeMockSdk())
    const { unmount } = render(
      <CustomCssVisualization initialCss=":root{--color-primary:#f0f}">
        <p>home page</p>
      </CustomCssVisualization>,
    )
    // Published layer disabled while the visualizer is mounted…
    expect(published.media).toBe('not all')
    // …and restored when it unmounts.
    unmount()
    expect(published.media).toBe('')
    published.remove()
  })

  it('tears down the subscription on unmount', async () => {
    const sdk = makeMockSdk()
    mockInit.mockResolvedValue(sdk)
    const { unmount } = render(
      <CustomCssVisualization initialCss="">
        <p>home page</p>
      </CustomCssVisualization>,
    )
    await waitFor(() => expect(sdk.form.changed).toHaveBeenCalled())
    unmount()
    expect(sdk._unsubscribe).toHaveBeenCalled()
  })
})
