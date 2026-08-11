import { describe, expect, it } from 'vitest'

import {
  diffWebhooks,
  expandDefinition,
  MANAGED_LABEL_PREFIX,
  normaliseUrl,
  redact,
  siteLabel,
} from './webhooks.mjs'

const DEFINITION = {
  label: `${MANAGED_LABEL_PREFIX}revalidate custom CSS (\${site:label})`,
  active: true,
  method: 'POST',
  events: ['dynamic-content.snapshot.published'],
  handlers: ['${site:url}/api/revalidate-custom-css'],
  headers: [{ key: 'x-revalidate-secret', value: '${secret:revalidate}', secret: true }],
}

const secrets = new Map([['revalidate', 's3cret']])

describe('normaliseUrl', () => {
  it('strips trailing slashes so handler paths never double up', () => {
    expect(normaliseUrl('https://site.example.com///')).toBe('https://site.example.com')
    expect(normaliseUrl('https://site.example.com')).toBe('https://site.example.com')
  })
})

describe('siteLabel', () => {
  it('prefers the label, then the name, then the host', () => {
    expect(siteLabel({ url: 'https://a.example.com', label: 'Prod', name: 'prod-site' })).toBe(
      'Prod',
    )
    expect(siteLabel({ url: 'https://a.example.com', label: '', name: 'prod-site' })).toBe(
      'prod-site',
    )
    expect(siteLabel({ url: 'https://a.example.com' })).toBe('a.example.com')
  })

  it('falls back to the raw value when the url is unparseable', () => {
    expect(siteLabel({ url: 'not-a-url' })).toBe('not-a-url')
  })
})

describe('expandDefinition', () => {
  it('produces one webhook per web app with tokens resolved', () => {
    const result = expandDefinition(DEFINITION, {
      webApps: [
        { url: 'https://prod.example.com/', label: 'Prod' },
        { url: 'https://staging.example.com', label: 'Staging' },
      ],
      secrets,
      source: 'custom-css-revalidate.json',
    })

    expect(result).toHaveLength(2)
    expect(result[0]?.label).toBe(`${MANAGED_LABEL_PREFIX}revalidate custom CSS (Prod)`)
    expect(result[0]?.handlers).toEqual(['https://prod.example.com/api/revalidate-custom-css'])
    expect(result[1]?.handlers).toEqual(['https://staging.example.com/api/revalidate-custom-css'])
    // The secret is carried through — this is the whole reason for not using dc-cli.
    expect(result[0]?.headers?.[0]).toEqual({
      key: 'x-revalidate-secret',
      value: 's3cret',
      secret: true,
    })
  })

  it('returns nothing when the hub has no web apps', () => {
    expect(expandDefinition(DEFINITION, { webApps: [], secrets })).toEqual([])
  })

  it('fails loudly when the secret is not configured, rather than seeding a 401', () => {
    expect(() =>
      expandDefinition(DEFINITION, {
        webApps: [{ url: 'https://prod.example.com', label: 'Prod' }],
        secrets: new Map(),
        source: 'custom-css-revalidate.json',
      }),
    ).toThrow(/\$\{secret:revalidate\} but that secret is not configured/)
  })

  it('rejects a label without the managed prefix', () => {
    expect(() =>
      expandDefinition(
        { ...DEFINITION, label: 'revalidate custom CSS (${site:label})' },
        {
          webApps: [{ url: 'https://prod.example.com', label: 'Prod' }],
          secrets,
          source: 'x.json',
        },
      ),
    ).toThrow(/must start with/)
  })

  it('rejects a multi-site definition whose label does not vary per site', () => {
    expect(() =>
      expandDefinition(
        { ...DEFINITION, label: `${MANAGED_LABEL_PREFIX}revalidate custom CSS` },
        {
          webApps: [
            { url: 'https://prod.example.com', label: 'Prod' },
            { url: 'https://staging.example.com', label: 'Staging' },
          ],
          secrets,
          source: 'x.json',
        },
      ),
    ).toThrow(/duplicate labels/)
  })

  it('reports a missing web app when a site token cannot be filled', () => {
    // A definition using ${site:…} with a web app that has no url.
    expect(() =>
      expandDefinition(DEFINITION, {
        webApps: [{ url: '', label: 'Broken' }],
        secrets,
        source: 'x.json',
      }),
    ).toThrow(/no url to fill/)
  })
})

describe('diffWebhooks', () => {
  const desired = [
    { label: `${MANAGED_LABEL_PREFIX}a`, handlers: ['https://a/api'] },
    { label: `${MANAGED_LABEL_PREFIX}b`, handlers: ['https://b/api'] },
  ]

  it('creates what is missing and updates what exists, carrying the hub id', () => {
    const { create, update, prune } = diffWebhooks(desired, [
      { id: 'id-a', label: `${MANAGED_LABEL_PREFIX}a`, handlers: ['https://old/api'] },
    ])
    expect(create.map((w) => w.label)).toEqual([`${MANAGED_LABEL_PREFIX}b`])
    expect(update).toEqual([
      { label: `${MANAGED_LABEL_PREFIX}a`, handlers: ['https://a/api'], id: 'id-a' },
    ])
    expect(prune).toEqual([])
  })

  it('prunes a managed webhook whose deployment is gone', () => {
    const { prune } = diffWebhooks(desired, [
      {
        id: 'id-old',
        label: `${MANAGED_LABEL_PREFIX}retired site`,
        handlers: ['https://dead/api'],
      },
    ])
    expect(prune.map((w) => w.id)).toEqual(['id-old'])
  })

  it('never touches webhooks it does not manage', () => {
    const existing = [
      { id: 'id-theirs', label: 'Algolia index sync', handlers: ['https://algolia/api'] },
    ]
    const { create, update, prune } = diffWebhooks(desired, existing)
    expect(create).toHaveLength(2)
    expect(update).toEqual([])
    expect(prune).toEqual([])
  })

  it('is idempotent: a second run with the hub in sync creates nothing', () => {
    const existing = desired.map((w, i) => ({ ...w, id: `id-${String(i)}` }))
    const { create, prune, update } = diffWebhooks(desired, existing)
    expect(create).toEqual([])
    expect(prune).toEqual([])
    expect(update).toHaveLength(2)
  })
})

describe('redact', () => {
  it('masks secret header values but leaves ordinary ones readable', () => {
    const masked = redact({
      label: 'x',
      headers: [
        { key: 'x-revalidate-secret', value: 's3cret', secret: true },
        { key: 'content-type', value: 'application/json' },
      ],
    })
    expect(masked.headers?.[0]?.value).toBe('••••••')
    expect(masked.headers?.[1]?.value).toBe('application/json')
  })

  it('passes through a webhook with no headers', () => {
    expect(redact({ label: 'x' })).toEqual({ label: 'x' })
  })
})
