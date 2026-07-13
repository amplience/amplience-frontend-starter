import { useEffect, useRef, useState } from 'react'

import { api } from '../api.js'
import type { DiscoveredHub, Environment } from '../types.js'
import { EMPTY_ENV } from '../types.js'

type Props = {
  initial?: Environment
  onSave: (env: Environment) => Promise<void>
  onCancel: () => void
  onDelete?: () => void
}

// ── Field groups ──────────────────────────────────────────────────────────────

/** Only string-valued keys — excludes boolean fields (republish,
 * ignoreSchemaValidation) and array fields (webApps). The `-?` strips optional
 * modifiers so optional fields don't leak `undefined` into the key union. */
type StringEnvKey = {
  [K in keyof Environment]-?: Environment[K] extends string ? K : never
}[keyof Environment]

type FieldMeta = {
  key: StringEnvKey
  label: string
  required?: boolean
  placeholder?: string
}

const IDENTITY_FIELDS: FieldMeta[] = [
  { key: 'label', label: 'Label', required: true, placeholder: 'e.g. Client A — Staging' },
  {
    key: 'name',
    label: 'Identifier',
    required: true,
    placeholder: 'e.g. client-a-staging (no spaces)',
  },
]

const CREDENTIAL_FIELDS: FieldMeta[] = [
  { key: 'clientId', label: 'Client ID', placeholder: 'Amplience OAuth client ID' },
  { key: 'clientSecret', label: 'Client secret', placeholder: 'Amplience OAuth client secret' },
]

const HUB_FIELDS: FieldMeta[] = [
  { key: 'hubName', label: 'Hub name', required: true, placeholder: 'e.g. quadraticlite' },
  { key: 'hubId', label: 'Hub ID', required: true, placeholder: 'Amplience hub ID' },
  { key: 'repoContent', label: 'Content repo ID', required: true, placeholder: 'DC repository ID' },
  { key: 'repoSlots', label: 'Slots repo ID', required: true, placeholder: 'DC repository ID' },
  {
    key: 'stagingHost',
    label: 'Staging host (VSE)',
    placeholder: 'Optional — enables staging preview',
  },
]

const CONFIG_FIELDS: FieldMeta[] = [
  {
    key: 'localhostUrl',
    label: 'Localhost URL',
    required: true,
    placeholder: 'http://localhost:3000',
  },
  {
    key: 'defaultBrand',
    label: 'Default brand',
    placeholder: 'e.g. acme — sets NEXT_PUBLIC_BRAND',
  },
  {
    key: 'defaultSite',
    label: 'Default site',
    placeholder: 'e.g. acme — defaults to hub name if empty',
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function EnvironmentForm({ initial, onSave, onCancel, onDelete }: Props) {
  const isEdit = initial !== undefined
  const [form, setForm] = useState<Environment>(initial ?? EMPTY_ENV)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  // Discovery state
  const [discovering, setDiscovering] = useState(false)
  const [discoverError, setDiscoverError] = useState<string | null>(null)
  const [discoveredHubs, setDiscoveredHubs] = useState<DiscoveredHub[] | null>(null)
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set())

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saving, onCancel])

  function set(key: keyof Environment, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }))
    // Clear auto-filled marker if the user edits the field manually
    if (autoFilled.has(key)) {
      setAutoFilled((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  // ── Discovery ──────────────────────────────────────────────────────────────

  function applyHub(hub: DiscoveredHub) {
    const slotsRepo = hub.repos.find((r) => r.features.includes('slots'))
    const contentRepo = hub.repos.find((r) => !r.features.includes('slots'))
    const filled = new Set<string>(['hubName', 'hubId'])
    const updates: Partial<Environment> = { hubName: hub.name, hubId: hub.id }
    if (contentRepo !== undefined) {
      updates.repoContent = contentRepo.id
      filled.add('repoContent')
    }
    if (slotsRepo !== undefined) {
      updates.repoSlots = slotsRepo.id
      filled.add('repoSlots')
    }
    if (hub.stagingHost !== undefined) {
      updates.stagingHost = hub.stagingHost
      filled.add('stagingHost')
    }
    setForm((prev) => {
      // Default site defaults to the hub name (ADR-0014) — prefill it so the
      // convention is visible and editable, but never clobber a custom value.
      const next = { ...prev, ...updates }
      if ((prev.defaultSite ?? '') === '' || prev.defaultSite === prev.hubName) {
        next.defaultSite = hub.name
        filled.add('defaultSite')
      }
      return next
    })
    setAutoFilled(filled)
  }

  async function handleDiscover() {
    if (!form.clientId || !form.clientSecret) return
    setDiscovering(true)
    setDiscoverError(null)
    setDiscoveredHubs(null)
    try {
      const result = await api.discover(form.clientId, form.clientSecret)
      setDiscoveredHubs(result.hubs)
      if (result.hubs.length === 1 && result.hubs[0] !== undefined) {
        applyHub(result.hubs[0])
      }
    } catch (err) {
      setDiscoverError(err instanceof Error ? err.message : 'Discovery failed')
    } finally {
      setDiscovering(false)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setSaving(false)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function renderField(meta: FieldMeta, idx: number) {
    const { key, label, required, placeholder } = meta
    const isAutoFilled = autoFilled.has(key)
    return (
      <div className="field" key={key}>
        <label htmlFor={key}>
          {label}
          {required && <span className="required">*</span>}
          {isAutoFilled && <span className="badge badge--autofill">Auto-filled</span>}
        </label>
        <input
          ref={idx === 0 ? firstFieldRef : undefined}
          id={key}
          type={key === 'clientSecret' ? 'password' : 'text'}
          value={String(form[key] ?? '')}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          onChange={(e) => set(key, e.target.value)}
          disabled={isEdit && key === 'name'}
        />
        {isEdit && key === 'name' && (
          <p className="hint">Identifier cannot be changed after creation.</p>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !saving) onCancel()
      }}
    >
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal__header">
          <h2>{isEdit ? 'Edit environment' : 'Add environment'}</h2>
          <button
            type="button"
            className="modal__close"
            onClick={onCancel}
            disabled={saving}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
          noValidate
        >
          <div className="form-fields">
            {/* ── Identity ── */}
            {IDENTITY_FIELDS.map((f, i) => renderField(f, i))}

            {/* ── Credentials + discover ── */}
            <div className="form-section">
              <span className="form-section__label">Credentials</span>
            </div>
            {CREDENTIAL_FIELDS.map((f) => renderField(f, 99))}

            <div className="form-discover">
              <button
                type="button"
                className="btn btn--sm btn--ghost form-discover__btn"
                onClick={() => {
                  void handleDiscover()
                }}
                disabled={discovering || saving || !form.clientId || !form.clientSecret}
              >
                {discovering ? (
                  <>
                    <span className="spinner spinner--sm" aria-hidden="true" /> Fetching…
                  </>
                ) : (
                  '↓ Fetch hub details'
                )}
              </button>
              {discoverError !== null && <p className="form-discover__error">{discoverError}</p>}
            </div>

            {/* Hub picker — only shown when credentials resolve to multiple hubs */}
            {discoveredHubs !== null && discoveredHubs.length > 1 && (
              <div className="field">
                <label htmlFor="hub-picker">Hub</label>
                <select
                  id="hub-picker"
                  onChange={(e) => {
                    const hub = discoveredHubs[Number(e.target.value)]
                    if (hub !== undefined) applyHub(hub)
                  }}
                >
                  <option value="">— select a hub —</option>
                  {discoveredHubs.map((hub, i) => (
                    <option key={hub.id} value={i}>
                      {hub.label || hub.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Hub details ── */}
            <div className="form-section">
              <span className="form-section__label">Hub details</span>
            </div>
            {HUB_FIELDS.map((f) => renderField(f, 99))}

            {/* ── Config ── */}
            <div className="form-section">
              <span className="form-section__label">Local Config</span>
            </div>
            {CONFIG_FIELDS.map((f) => renderField(f, 99))}

            <div className="field field--checkbox">
              <label htmlFor="republish">
                <input
                  id="republish"
                  type="checkbox"
                  checked={form.republish}
                  onChange={(e) => set('republish', e.target.checked)}
                />
                Force republish on import (--republish)
              </label>
            </div>

            <div className="field field--checkbox">
              <label htmlFor="ignoreSchemaValidation">
                <input
                  id="ignoreSchemaValidation"
                  type="checkbox"
                  checked={form.ignoreSchemaValidation ?? false}
                  onChange={(e) => set('ignoreSchemaValidation', e.target.checked)}
                />
                Ignore schema validation on wipe/import (--ignoreSchemaValidation)
              </label>
              <p className="hint">
                Requires the hub&rsquo;s &ldquo;Ignore schema validation&rdquo; setting to be
                enabled (DC &rarr; hub &rarr; Properties). Lets teardown strip keys from items whose
                body no longer matches a changed schema.
              </p>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add environment'}
            </button>
          </div>
        </form>

        {isEdit && onDelete !== undefined && (
          <div className="form-danger-zone">
            <p className="form-danger-zone__label">Danger zone</p>
            <button
              type="button"
              className="btn btn--danger"
              disabled={saving}
              onClick={() => {
                if (
                  confirm(
                    `Permanently delete "${initial?.name ?? 'this environment'}"? This cannot be undone.`,
                  )
                ) {
                  onDelete()
                }
              }}
            >
              Delete environment
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
