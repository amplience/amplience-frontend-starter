// Tests for the shared failure-card chrome (QL-40; ADR-0010 §5B).
//
// The card is one component in both environments; the only divergence is
// the diagnostics block, which exists in development and not in production
// (ADR-0010 §7 — diagnostics can echo content detail, so they stay out of
// anything a visitor sees). The dev/prod switch is evaluated at module
// load, so each environment is exercised through a fresh dynamic import.
//
// Node environment — server-rendered markup assertions, no DOM.

import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const importFreshCard = async () => {
  vi.resetModules()
  return (await import('./FailureCard')).FailureCard
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('FailureCard', () => {
  it('renders the failure class, summary, and schema URI', async () => {
    const FailureCard = await importFreshCard()
    const out = renderToStaticMarkup(
      <FailureCard
        failureClass="SchemaUnknown"
        summary="No component is registered for this schema."
        schemaUri="https://quadratic.amplience.com/v2/content/mystery"
      />,
    )
    expect(out).toContain('role="alert"')
    expect(out).toContain('data-renderer-failure="SchemaUnknown"')
    expect(out).toContain('No component is registered for this schema.')
    expect(out).toContain('https://quadratic.amplience.com/v2/content/mystery')
  })

  it('renders the diagnostics block in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const FailureCard = await importFreshCard()
    const out = renderToStaticMarkup(
      <FailureCard
        failureClass="PropsValidationFailure"
        summary="The content did not match the component contract."
        schemaUri="https://quadratic.amplience.com/v2/content/hero"
        diagnostics={<p>title: expected non-empty string</p>}
      />,
    )
    expect(out).toContain('<details')
    expect(out).toContain('title: expected non-empty string')
  })

  it('renders no diagnostics block in development when none are supplied', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const FailureCard = await importFreshCard()
    const out = renderToStaticMarkup(
      <FailureCard failureClass="SchemaUnknown" summary="Summary." schemaUri="https://x" />,
    )
    expect(out).not.toContain('<details')
  })

  it('keeps diagnostics out of the markup outside development', async () => {
    // Vitest runs as NODE_ENV=test — the production posture for this switch.
    const FailureCard = await importFreshCard()
    const out = renderToStaticMarkup(
      <FailureCard
        failureClass="SchemaUnknown"
        summary="Summary."
        schemaUri="https://x"
        diagnostics={<p>content payload detail</p>}
      />,
    )
    expect(out).not.toContain('content payload detail')
    expect(out).not.toContain('<details')
  })
})
