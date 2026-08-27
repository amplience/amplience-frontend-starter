import { useEffect, useRef, useState } from 'react'

import { api } from '../api.js'
import type { StringEnvKey } from '../required-fields.js'
import { isRequired, missingRequired } from '../required-fields.js'
import type { DiscoveredHub, Environment, PermissionsReport } from '../types.js'
import { EMPTY_ENV } from '../types.js'
import { PermissionsPanel } from './PermissionsPanel.js'

type Props = {
  initial?: Environment
  onSave: (env: Environment) => Promise<void>
  onCancel: () => void
  onDelete?: () => void
}

// ── Field groups ──────────────────────────────────────────────────────────────

/** Required-ness lives in ../required-fields, so the marker and the submit gate can't drift. */
type FieldMeta = {
  key: StringEnvKey
  label: string
  placeholder?: string
}

const IDENTITY_FIELDS: FieldMeta[] = [
  {
    key: 'label',
    label: 'Label (Just for your personal reference)',
    placeholder: 'e.g. Client A — Staging',
  },
]

const CREDENTIAL_FIELDS: FieldMeta[] = [
  { key: 'clientId', label: 'Client ID', placeholder: 'Amplience OAuth client ID' },
  { key: 'clientSecret', label: 'Client secret', placeholder: 'Amplience OAuth client secret' },
]

const HUB_FIELDS: FieldMeta[] = [
  { key: 'hubName', label: 'Hub name', placeholder: 'e.g. quadraticlite' },
  { key: 'hubId', label: 'Hub ID', placeholder: 'Amplience hub ID' },
  { key: 'repoContent', label: 'Content repo ID', placeholder: 'DC repository ID' },
  { key: 'repoSlots', label: 'Slots repo ID', placeholder: 'DC repository ID' },
  {
    key: 'repoSiteComponents',
    label: 'Site Components repo ID',
    placeholder: 'Optional — enables CMS-managed site config',
  },
  {
    key: 'stagingHost',
    label: 'Staging host (VSE)',
    placeholder: 'Optional — enables staging preview',
  },
  {
    key: 'revalidateSecret',
    label: 'Revalidate secret',
    placeholder: "Optional — must match the deployment's AMPLIENCE_REVALIDATE_SECRET",
  },
]

const CONFIG_FIELDS: FieldMeta[] = [
  { key: 'localhostUrl', label: 'Localhost URL', placeholder: 'http://localhost:3000' },
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

/**
 * Splits a label so any bracketed qualifier — "Staging host (VSE)" — can be
 * rendered a weight lighter than the name it qualifies.
 */
function labelParts(label: string) {
  return label.split(/(\([^)]*\))/).map((part, i) =>
    part.startsWith('(') ? (
      <span key={`${String(i)}-${part}`} className="label-qualifier">
        {part}
      </span>
    ) : (
      part
    ),
  )
}

/** Field labels by key, for naming what's still blank on a failed submit. */
const FIELD_LABELS = new Map(
  [...IDENTITY_FIELDS, ...CREDENTIAL_FIELDS, ...HUB_FIELDS, ...CONFIG_FIELDS].map((f) => [
    f.key,
    f.label,
  ]),
)

// ── Component ─────────────────────────────────────────────────────────────────

export function EnvironmentForm({ initial, onSave, onCancel, onDelete }: Props) {
  const isEdit = initial !== undefined
  const [form, setForm] = useState<Environment>(initial ?? EMPTY_ENV)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  // Adding a hub starts with just the label and credentials; the rest of the
  // form appears once discovery has resolved a hub into it. Editing shows
  // everything, since the details already exist.
  const [revealed, setRevealed] = useState(isEdit)

  // Discovery state
  const [discovering, setDiscovering] = useState(false)
  const [discoverError, setDiscoverError] = useState<string | null>(null)
  const [discoveredHubs, setDiscoveredHubs] = useState<DiscoveredHub[] | null>(null)
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set())

  // Permissions preflight state
  const [perms, setPerms] = useState<PermissionsReport | null>(null)
  const [permsError, setPermsError] = useState<string | null>(null)
  const [permsLoading, setPermsLoading] = useState(false)

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
    // Site Components has no distinctive feature flag, so it's matched by its
    // repository label. Identify it first and exclude it from the content match
    // (content is otherwise "the non-slots repo", which a third repo confuses).
    const siteComponentsRepo = hub.repos.find(
      (r) => (r.label ?? '').trim().toLowerCase() === 'site components',
    )
    const slotsRepo = hub.repos.find((r) => r.features.includes('slots'))
    const contentRepo = hub.repos.find(
      (r) => !r.features.includes('slots') && r !== siteComponentsRepo,
    )
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
    // Optional — only prefilled when a repo labelled "Site Components" exists;
    // otherwise the field stays blank for manual entry.
    if (siteComponentsRepo !== undefined) {
      updates.repoSiteComponents = siteComponentsRepo.id
      filled.add('repoSiteComponents')
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
    setRevealed(true)
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

  // ── Permissions preflight ──────────────────────────────────────────────────

  // Checks the form's current (possibly unsaved) values, so a credential pair
  // can be verified before the environment is ever saved. Needs a hub ID —
  // run "Fetch hub details" (or fill it in) first.
  async function handleCheckPermissions() {
    if (!form.clientId || !form.clientSecret || !form.hubId) return
    setPermsLoading(true)
    setPermsError(null)
    try {
      setPerms(
        await api.permissions({
          clientId: form.clientId,
          clientSecret: form.clientSecret,
          hubId: form.hubId,
          repoContent: form.repoContent,
          repoSlots: form.repoSlots,
          repoSiteComponents: form.repoSiteComponents,
        }),
      )
    } catch (err) {
      setPerms(null)
      setPermsError(err instanceof Error ? err.message : 'Permissions check failed')
    } finally {
      setPermsLoading(false)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // The form is noValidate, so required fields are enforced here.
    const missing = missingRequired(form)
    const firstMissing = missing[0]
    if (firstMissing !== undefined) {
      setError(
        `Fill in the required fields: ${missing.map((k) => FIELD_LABELS.get(k) ?? k).join(', ')}.`,
      )
      document.getElementById(firstMissing)?.focus()
      return
    }
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
    const { key, label, placeholder } = meta
    const required = isRequired(key)
    const isAutoFilled = autoFilled.has(key)
    return (
      <div className="field" key={key}>
        <label htmlFor={key}>
          {labelParts(label)}
          {required && <span className="required">*</span>}
          {isAutoFilled && <span className="badge badge--autofill">Auto-filled</span>}
        </label>
        <input
          ref={idx === 0 ? firstFieldRef : undefined}
          id={key}
          type={key === 'clientSecret' || key === 'revalidateSecret' ? 'password' : 'text'}
          value={String(form[key] ?? '')}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          onChange={(e) => set(key, e.target.value)}
        />
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
          <h2>{isEdit ? 'Edit hub' : 'Add hub'}</h2>
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
                  '⬇️ Fetch hub details'
                )}
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost form-discover__btn"
                onClick={() => {
                  void handleCheckPermissions()
                }}
                disabled={
                  permsLoading || saving || !form.clientId || !form.clientSecret || !form.hubId
                }
                title={
                  !form.hubId
                    ? 'Needs a hub ID — fetch hub details first'
                    : 'Check what these credentials can read and write'
                }
              >
                {permsLoading ? (
                  <>
                    <span className="spinner spinner--sm" aria-hidden="true" /> Checking…
                  </>
                ) : (
                  '🔑 Check credentials'
                )}
              </button>
              {discoverError !== null && <p className="form-discover__error">{discoverError}</p>}
              {permsError !== null && <p className="form-discover__error">{permsError}</p>}
            </div>

            {/* Credential permissions child-card */}
            {perms !== null && !permsLoading && (
              <PermissionsPanel report={perms} onDismiss={() => setPerms(null)} />
            )}

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

            {revealed && (
              <>
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
                    {labelParts('Force republish on import (--republish)')}
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
                    {labelParts(
                      'Ignore schema validation on wipe/import (--ignoreSchemaValidation)',
                    )}
                  </label>
                  <p className="hint">
                    Requires the hub&rsquo;s &ldquo;Ignore schema validation&rdquo; setting to be
                    enabled (DC &rarr; hub &rarr; Properties). Lets teardown strip keys from items
                    whose body no longer matches a changed schema.
                  </p>
                </div>
              </>
            )}
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
            {revealed && (
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add hub'}
              </button>
            )}
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
                    `Permanently delete "${initial?.label || initial?.name || 'this hub'}"? This cannot be undone.`,
                  )
                ) {
                  onDelete()
                }
              }}
            >
              Delete hub
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
