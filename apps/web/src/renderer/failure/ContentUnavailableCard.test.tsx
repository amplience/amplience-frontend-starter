// Tests for the page-level content-fetch failure card (QL-37).
//
// Node environment — server-rendered markup assertions, no DOM.

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  ContentClientError,
  type ContentClientErrorKind,
} from '@amplience/frontend-starter-content'

import { ContentUnavailableCard } from './ContentUnavailableCard'

const html = (kind: ContentClientErrorKind): string =>
  renderToStaticMarkup(
    <ContentUnavailableCard
      error={new ContentClientError(kind, `simulated ${kind}`)}
      resource="home"
    />,
  )

describe('ContentUnavailableCard', () => {
  it.each([
    ['network', 'could not be reached'],
    ['unauthorised', 'not authorised'],
    ['malformed', 'could not be understood'],
    ['unknown', 'unexpected reason'],
  ] as const)('renders a visible card for kind "%s"', (kind, expectedCopy) => {
    const out = html(kind)
    expect(out).toContain('data-renderer-failure="ContentUnavailable"')
    expect(out).toContain('role="alert"')
    expect(out).toContain(expectedCopy)
    expect(out).toContain('home')
  })
})
