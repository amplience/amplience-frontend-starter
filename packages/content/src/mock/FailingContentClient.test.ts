// Tests for the failing-client test double (QL-37).

import { describe, expect, it } from 'vitest'

import { ContentClientError, type ContentClientErrorKind } from '../types'
import { makeFailingContentClient } from './FailingContentClient'

const kinds: readonly ContentClientErrorKind[] = [
  'not-found',
  'unauthorised',
  'network',
  'malformed',
  'unknown',
]

describe('makeFailingContentClient', () => {
  it.each(kinds)('rejects getByKey with a ContentClientError of kind "%s"', async (kind) => {
    const client = makeFailingContentClient(kind)
    const failure = await client.getByKey('home').catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(ContentClientError)
    expect((failure as ContentClientError).kind).toBe(kind)
  })

  it('rejects getById the same way', async () => {
    const client = makeFailingContentClient('network')
    const failure = await client.getById('some-id').catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(ContentClientError)
    expect((failure as ContentClientError).kind).toBe('network')
  })

  it('uses a custom message when provided', async () => {
    const client = makeFailingContentClient('network', 'ECONNREFUSED 127.0.0.1:443')
    const failure = await client.getByKey('home').catch((e: unknown) => e)
    expect((failure as ContentClientError).message).toBe('ECONNREFUSED 127.0.0.1:443')
  })
})
