/**
 * /debug/failures — development-only gallery of every loud-failure surface
 * (QL-37's manual smoke-check, and a handy demo of the renderer's failure
 * posture). 404s in production: the gate is evaluated per-request at the
 * top of the page, the same NODE_ENV switch the console emitter uses.
 *
 * Everything here renders through the real dispatcher and the real cards —
 * crafted content nodes, not mocked components — so what you see is exactly
 * what a broken page would show.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Container } from '@amplience/quadratic-components/container'
import { Stack } from '@amplience/quadratic-components/stack'
import { Typography } from '@amplience/quadratic-components/typography'
import { CONTENT_LINK_SCHEMA, ContentClientError } from '@amplience/quadratic-content'

import { registry } from '../../../lib/registry'
import { ContentUnavailableCard, renderContent } from '../../../src/renderer'

export const metadata: Metadata = {
  title: 'Failure cards (debug)',
  robots: { index: false, follow: false },
}

const HERO_SCHEMA = 'https://quadratic.amplience.com/v2/content/hero'

/** One crafted content node per dispatch-failure class. */
const dispatchFailures = [
  {
    label: 'SchemaUnknown — URI not in the registry',
    node: {
      _meta: {
        schema: 'https://quadratic.amplience.com/v2/content/carousel',
        deliveryId: 'debug-0001',
      },
    },
  },
  {
    label: 'SchemaUnknown — node missing _meta.schema',
    node: { title: 'A node with no envelope' },
  },
  {
    label: 'SchemaUnknown — unresolved content-link stub',
    node: {
      id: 'a1b2c3d4-9999-4000-8000-000000000999',
      contentType: HERO_SCHEMA,
      _meta: { schema: CONTENT_LINK_SCHEMA },
    },
  },
  {
    label: 'PropsValidationFailure — hero content missing its title',
    node: {
      _meta: { schema: HERO_SCHEMA, deliveryId: 'debug-0002' },
      subtitle: 'This hero has no title, so its contract validator rejects it.',
    },
  },
] as const

const contentFailureKinds = ['network', 'unauthorised', 'malformed', 'unknown'] as const

export default function FailuresPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main data-page>
      <Container gutter maxWidth="default">
        <Stack>
          <Typography variant="h1">Loud-failure gallery</Typography>
          <Typography variant="p">
            Development only. Every card below is produced by the real dispatcher or the real
            route-level failure path — expand each card&apos;s diagnostics to check readability.
          </Typography>

          <Typography variant="h2">Dispatch failures (per-node)</Typography>
          {dispatchFailures.map(({ label, node }) => (
            <section key={label} aria-label={label}>
              <Typography variant="p">{label}</Typography>
              {renderContent(node, registry)}
            </section>
          ))}

          <Typography variant="h2">Content-fetch failures (page-level)</Typography>
          {contentFailureKinds.map((kind) => (
            <section key={kind} aria-label={`ContentUnavailable — ${kind}`}>
              <Typography variant="p">ContentUnavailable — {kind}</Typography>
              <ContentUnavailableCard
                error={new ContentClientError(kind, `Simulated ${kind} failure for the gallery.`)}
                resource="home"
              />
            </section>
          ))}
        </Stack>
      </Container>
    </main>
  )
}
