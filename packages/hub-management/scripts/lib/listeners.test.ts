import { describe, expect, it } from 'vitest'

import {
  createInput,
  diffListeners,
  isUnauthenticated,
  listenerFileName,
  parseFixture,
  schemaChanged,
  schemaString,
  toListenerFixture,
  UNAUTHENTICATED,
  updateInput,
} from './listeners.mjs'

const SCHEMA = { type: 'object', properties: { payload: { type: 'object' } } }

const fixture = { label: 'Trigger Localization', schema: SCHEMA }

const onHub = (overrides: Record<string, unknown> = {}) => ({
  id: 'V2ViaG9va0xpc3RlbmVy',
  label: 'Trigger Localization',
  url: 'https://api.amplience.net/hooks/org/hub/uuid',
  schema: JSON.stringify(SCHEMA, null, 2),
  security: { __typename: 'WebhookListenerSecurityNone' },
  ...overrides,
})

describe('isUnauthenticated', () => {
  it('is true only for an explicit none', () => {
    expect(isUnauthenticated(onHub())).toBe(true)
  })

  // Fail safe: the cost of a false positive is a protected endpoint quietly
  // becoming an open one.
  it('treats HMAC, an unknown member and a missing block as protected', () => {
    expect(
      isUnauthenticated(onHub({ security: { __typename: 'WebhookListenerSecurityHMAC' } })),
    ).toBe(false)
    expect(
      isUnauthenticated(onHub({ security: { __typename: 'WebhookListenerSecurityMTLS' } })),
    ).toBe(false)
    expect(isUnauthenticated(onHub({ security: undefined }))).toBe(false)
    expect(isUnauthenticated(undefined)).toBe(false)
  })
})

describe('schemaChanged', () => {
  it('ignores how the hub spelled the schema back', () => {
    expect(schemaChanged(SCHEMA, JSON.stringify(SCHEMA))).toBe(false)
    expect(
      schemaChanged(
        SCHEMA,
        '{\n  "properties": { "payload": { "type": "object" } },\n  "type": "object"\n}',
      ),
    ).toBe(false)
  })

  it('sees a real difference', () => {
    expect(schemaChanged(SCHEMA, '{"type":"string"}')).toBe(true)
    expect(schemaChanged(SCHEMA, undefined)).toBe(true)
  })

  it('calls an unparseable schema changed rather than guessing', () => {
    expect(schemaChanged(SCHEMA, 'not json')).toBe(true)
  })
})

describe('diffListeners', () => {
  it('creates what the hub does not have', () => {
    const plan = diffListeners([fixture], [])
    expect(plan.create).toEqual([fixture])
    expect(plan.update).toEqual([])
  })

  it('leaves an identical listener alone, keeping its id and url', () => {
    const plan = diffListeners([fixture], [onHub()])
    expect(plan.unchanged).toEqual([{ ...fixture, id: onHub().id, url: onHub().url }])
    expect(plan.create).toEqual([])
    expect(plan.update).toEqual([])
  })

  it('updates in place when the schema moved on', () => {
    const plan = diffListeners([fixture], [onHub({ schema: '{"type":"string"}' })])
    expect(plan.update).toEqual([{ ...fixture, id: onHub().id, url: onHub().url }])
  })

  // The whole point of the step: the id survives, so the minted URL does too.
  it('never recreates, so the inbound URL external callers hold keeps working', () => {
    const plan = diffListeners([fixture], [onHub({ schema: '{"type":"string"}' })])
    expect(plan.update[0]?.id).toBe(onHub().id)
    expect(plan.create).toEqual([])
  })

  it('refuses to re-seed a protected listener and says why', () => {
    const protectedListener = onHub({ security: { __typename: 'WebhookListenerSecurityHMAC' } })
    const plan = diffListeners([fixture], [protectedListener])
    expect(plan.update).toEqual([])
    expect(plan.unchanged).toEqual([])
    expect(plan.refused).toHaveLength(1)
    expect(plan.refused[0]?.reason).toMatch(/protected.*leave the endpoint open/s)
  })

  it('refuses a protected listener even when its schema already matches', () => {
    const plan = diffListeners(
      [fixture],
      [onHub({ security: { __typename: 'WebhookListenerSecurityHMAC' } })],
    )
    expect(plan.refused).toHaveLength(1)
  })

  it('refuses two listeners sharing a label rather than picking', () => {
    const plan = diffListeners([fixture], [onHub(), onHub({ id: 'second' })])
    expect(plan.refused[0]?.reason).toMatch(/2 listeners on this hub are labelled/)
    expect(plan.create).toEqual([])
  })

  it('never prunes a listener the fixtures do not mention', () => {
    const plan = diffListeners([], [onHub({ label: 'Someone else"s listener' })])
    expect(plan).toEqual({ create: [], update: [], unchanged: [], refused: [] })
  })
})

describe('mutation inputs', () => {
  it('states unauthenticated on create rather than leaving it to a default', () => {
    expect(createInput(fixture, 'Q01TSHVi')).toEqual({
      cmsHubId: 'Q01TSHVi',
      label: 'Trigger Localization',
      schema: schemaString(SCHEMA),
      security: UNAUTHENTICATED,
    })
  })

  it('updates by id, which is what keeps the minted URL', () => {
    expect(updateInput({ ...fixture, id: 'listener-1' })).toEqual({
      id: 'listener-1',
      label: 'Trigger Localization',
      schema: schemaString(SCHEMA),
    })
  })

  // Create and update take different security input types, and update's is
  // optional — so update sends none at all rather than a guessed shape.
  it('sends no security on update, leaving whatever the listener has', () => {
    expect(updateInput({ ...fixture, id: 'listener-1' })).not.toHaveProperty('security')
  })

  it('sends the schema as the string the API expects', () => {
    expect(typeof createInput(fixture, 'hub').schema).toBe('string')
  })
})

describe('parseFixture', () => {
  it('reads a well-formed fixture', () => {
    expect(parseFixture(fixture)).toEqual(fixture)
  })

  it('refuses one with no label, which is the only handle a flow has', () => {
    expect(() => parseFixture({ schema: SCHEMA }, 'a.json')).toThrow(/needs a "label"/)
  })

  it('refuses one with no schema rather than inventing a default', () => {
    expect(() => parseFixture({ label: 'x' }, 'a.json')).toThrow(/no "schema"/)
  })
})

describe('listenerFileName', () => {
  it('slugs the label the same way flow fixtures do', () => {
    expect(listenerFileName('Trigger Localization')).toBe('trigger-localization.json')
  })
})

describe('toListenerFixture', () => {
  it('stores the schema as real JSON so it diffs', () => {
    const { fixture } = toListenerFixture(onHub())
    expect(fixture).toEqual({ label: 'Trigger Localization', schema: SCHEMA })
  })

  it('keeps an unparseable schema verbatim rather than dropping it', () => {
    const { fixture } = toListenerFixture(onHub({ schema: 'not json' }))
    expect(fixture.schema).toBe('not json')
  })

  // The fixture format cannot express HMAC, so pulling one is a dead end that
  // should say so at the moment it is written, not at push time.
  it('warns that a protected listener cannot be seeded back', () => {
    const { warnings } = toListenerFixture(
      onHub({ security: { __typename: 'WebhookListenerSecurityHMAC' } }),
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/cannot express that.*refuse to touch it/s)
  })

  it('says nothing about an unauthenticated one', () => {
    expect(toListenerFixture(onHub()).warnings).toEqual([])
  })
})

describe('listener provenance', () => {
  // Flows have carried sourceHubId since QL-159. Without it there is no way to
  // tell later where a listener fixture was authored — and the label alone
  // proved not to be enough when a hand-typed one went unnoticed.
  it('records the hub it was pulled from', () => {
    const { fixture } = toListenerFixture(onHub(), { sourceHubId: '6aa14be51c14da4478d5b343' })
    expect(fixture.sourceHubId).toBe('6aa14be51c14da4478d5b343')
    expect(Object.keys(fixture)).toEqual(['label', 'sourceHubId', 'schema'])
  })

  it('omits it rather than writing a null when the hub is unknown', () => {
    expect(toListenerFixture(onHub()).fixture).not.toHaveProperty('sourceHubId')
    expect(toListenerFixture(onHub(), {}).fixture).not.toHaveProperty('sourceHubId')
  })
})
