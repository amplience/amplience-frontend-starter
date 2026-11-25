import { useEffect, useRef, useState } from 'react'

import { api } from '../api.js'
import { canonicalGroup } from '../hub-groups.js'
import type { StringEnvKey } from '../required-fields.js'
import { isRequired, missingRequired } from '../required-fields.js'
import type {
  CommercetoolsSettings,
  DiscoveredHub,
  Environment,
  PermissionsReport,
  ProductSourceName,
} from '../types.js'
import { EMPTY_ENV } from '../types.js'
import { HubIcon } from './HubIcon.js'
import { PermissionsPanel } from './PermissionsPanel.js'
import { WorkforceAccessPanel } from './WorkforceAccessPanel.js'

type Props = {
  initial?: Environment
  /** Groups already in use, offered as suggestions. */
  groups?: string[]
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
    label: 'Label',
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
    key: 'repoProducts',
    label: 'Products repo ID',
    placeholder: 'Optional — seeds products here instead of the content repo',
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

/** The commercetools picker's settings the form collects (region and language stay hand-set). */
type CommercetoolsField = 'projectKey' | 'clientId' | 'clientSecret'

const COMMERCETOOLS_FIELDS: { key: CommercetoolsField; label: string; placeholder: string }[] = [
  { key: 'projectKey', label: 'Project key', placeholder: 'e.g. anyafinn' },
  { key: 'clientId', label: 'Client ID', placeholder: 'Read-only API client ID' },
  { key: 'clientSecret', label: 'Client secret', placeholder: 'Read-only API client secret' },
]

const PIM_LABELS: Record<ProductSourceName, string> = {
  cms: 'Amplience',
  commercetools: 'commercetools',
}

/** Whether the hub has every commercetools setting the picker needs. */
const hasCommercetools = (ct: Partial<CommercetoolsSettings> | undefined) =>
  COMMERCETOOLS_FIELDS.every(({ key }) => (ct?.[key] ?? '').trim() !== '')

/**
 * The PIMs this hub can choose between — Amplience always (it needs no
 * credentials), commercetools once its settings are in. hub:import's
 * `availablePims` applies the same rule.
 */
const availablePims = (env: Environment): ProductSourceName[] =>
  hasCommercetools(env.commercetools) ? ['cms', 'commercetools'] : ['cms']

/**
 * The main PIM the form shows and saves: the hub's own choice when its PIM has
 * what it needs, else what hub:import would infer.
 */
const effectiveMainPim = (env: Environment): ProductSourceName => {
  const commercetools = hasCommercetools(env.commercetools)
  if (env.mainPim === 'cms' || (env.mainPim === 'commercetools' && commercetools))
    return env.mainPim
  return commercetools ? 'commercetools' : 'cms'
}

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
  [...IDENTITY_FIELDS, ...CREDENTIAL_FIELDS, ...HUB_FIELDS].map((f) => [f.key, f.label]),
)

// ── Component ─────────────────────────────────────────────────────────────────

export function EnvironmentForm({ initial, groups = [], onSave, onCancel, onDelete }: Props) {
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
  /** Organization whose Workforce setup panel is open, if any. */
  const [workforceOrg, setWorkforceOrg] = useState<string | null>(null)
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

  function setCommercetools(key: CommercetoolsField, value: string) {
    setForm((prev) => ({
      ...prev,
      commercetools: {
        projectKey: '',
        clientId: '',
        clientSecret: '',
        ...prev.commercetools,
        [key]: value,
      },
    }))
  }

  // ── Discovery ──────────────────────────────────────────────────────────────

  function applyHub(hub: DiscoveredHub) {
    // Site Components has no distinctive feature flag, so it's matched by its
    // repository label. Identify it first and exclude it from the content match
    // (content is otherwise "the non-slots repo", which a third repo confuses).
    const siteComponentsRepo = hub.repos.find(
      (r) => (r.label ?? '').trim().toLowerCase() === 'site components',
    )
    // Products, like Site Components, is recognised by its label alone.
    const productsRepo = hub.repos.find((r) => (r.label ?? '').trim().toLowerCase() === 'products')
    const slotsRepo = hub.repos.find((r) => r.features.includes('slots'))
    const contentRepo = hub.repos.find(
      (r) => !r.features.includes('slots') && r !== siteComponentsRepo && r !== productsRepo,
    )
    const filled = new Set<string>(['hubName', 'hubId'])
    // organizationId is carried but not shown: it has no field, and it is only
    // here so a Workforce token can be matched to the hubs it covers (ADR-0023).
    const updates: Partial<Environment> = {
      hubName: hub.name,
      hubId: hub.id,
      organizationId: hub.organizationId,
    }
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
    // Optional — only prefilled when a repo labelled "Products" exists.
    if (productsRepo !== undefined) {
      updates.repoProducts = productsRepo.id
      filled.add('repoProducts')
    }
    if (hub.stagingHost !== undefined) {
      updates.stagingHost = hub.stagingHost
      filled.add('stagingHost')
    }
    // Default site is deliberately not prefilled from the hub name: blank means
    // the fixture set's name (ADR-0019, amending ADR-0014), the same default
    // hub-import seeds under, so prefilling the hub name would seed and serve
    // a namespace no set is named after.
    setForm((prev) => ({ ...prev, ...updates }))
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
          repoProducts: form.repoProducts,
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
    // commercetools is all or nothing: hub:import ignores a partial block.
    const ctFilled = COMMERCETOOLS_FIELDS.filter(
      ({ key }) => (form.commercetools?.[key] ?? '').trim() !== '',
    )
    if (ctFilled.length > 0 && ctFilled.length < COMMERCETOOLS_FIELDS.length) {
      setError('Fill in all three commercetools fields, or leave them all blank.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { group, icon, commercetools, mainPim: _mainPim, multiPimDemo, ...rest } = form
      const nextGroup = canonicalGroup(group ?? '', groups)
      const nextIcon = (icon ?? '').trim()
      await onSave({
        ...rest,
        ...(nextGroup === '' ? {} : { group: nextGroup }),
        ...(nextIcon === '' ? {} : { icon: nextIcon }),
        ...(commercetools !== undefined && hasCommercetools(commercetools) && { commercetools }),
        // Saved explicitly, so the hub's main PIM is a decision, not an inference.
        mainPim: effectiveMainPim(form),
        // Only meaningful with more than one PIM; hub:import ignores it otherwise.
        ...(multiPimDemo === true && availablePims(form).length > 1 && { multiPimDemo }),
      })
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
      <div className="modal modal--wide" role="dialog" aria-modal="true">
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
          {/* Sections stack, or sit two by two when the form is wide enough. */}
          <div className="form-fields">
            {/* ── Personal reference ── */}
            <section className="form-group">
              <div className="form-section">
                <span className="form-section__label">Personal reference</span>
              </div>
              {IDENTITY_FIELDS.map((f, i) => renderField(f, i))}
              <div className="field">
                <label htmlFor="icon">{labelParts('Icon (optional emoji or image URL)')}</label>
                <div className="field__row">
                  <input
                    id="icon"
                    type="text"
                    value={form.icon ?? ''}
                    placeholder="e.g. 🛍️ or https://example.com/logo.png"
                    autoComplete="off"
                    onChange={(e) => set('icon', e.target.value)}
                  />
                  <HubIcon icon={form.icon} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="group">{labelParts('Group (optional)')}</label>
                <input
                  id="group"
                  type="text"
                  list="hub-groups"
                  value={form.group ?? ''}
                  placeholder="e.g. Prospects"
                  autoComplete="off"
                  onChange={(e) => set('group', e.target.value)}
                />
                <datalist id="hub-groups">
                  {groups.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>
            </section>

            {/* ── Credentials + discover ── */}
            <section className="form-group">
              <div className="form-section">
                <span className="form-section__label">API credentials</span>
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
                <PermissionsPanel
                  report={perms}
                  onDismiss={() => setPerms(null)}
                  onManageWorkforce={setWorkforceOrg}
                />
              )}

              {/* Workforce access — the once-per-organization setup step (ADR-0023) */}
              {workforceOrg !== null && (
                <WorkforceAccessPanel
                  organizationId={workforceOrg}
                  currentHubLabel={form.label !== '' ? form.label : form.hubName}
                  currentHubName={form.hubName}
                  onClose={() => setWorkforceOrg(null)}
                  // Deliberately left open: after removing a token the next
                  // thing anyone wants is to paste the replacement, and after
                  // saving one the panel is where the result is confirmed.
                  onStored={() => {
                    void handleCheckPermissions()
                  }}
                />
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
            </section>

            {revealed && (
              <>
                {/* ── Hub details ── */}
                <section className="form-group">
                  <div className="form-section">
                    <span className="form-section__label">Hub details</span>
                  </div>
                  {HUB_FIELDS.map((f) => renderField(f, 99))}

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
                </section>

                {/* ── PIM details ── */}
                <section className="form-group">
                  <div className="form-section">
                    <span className="form-section__label">PIM details</span>
                  </div>
                  <p className="form-subsection">Amplience</p>
                  <p className="hint">
                    Built in: products are Product items in this hub. No credentials needed.
                  </p>

                  <p className="form-subsection">commercetools</p>
                  {COMMERCETOOLS_FIELDS.map(({ key, label, placeholder }) => (
                    <div className="field" key={key}>
                      <label htmlFor={`commercetools-${key}`}>{label}</label>
                      <input
                        id={`commercetools-${key}`}
                        type={key === 'clientSecret' ? 'password' : 'text'}
                        value={form.commercetools?.[key] ?? ''}
                        placeholder={placeholder}
                        autoComplete="off"
                        onChange={(e) => setCommercetools(key, e.target.value)}
                      />
                    </div>
                  ))}
                  <p className="hint">
                    For the commercetools product picker. Its secret reaches editors&rsquo;
                    browsers, so use an API client with only <code>view_published_products</code>{' '}
                    and <code>view_categories</code> &mdash; not a site&rsquo;s own.
                  </p>

                  {/* Choices only exist once there's a second PIM to choose. */}
                  {availablePims(form).length > 1 && (
                    <>
                      <div className="field">
                        <label htmlFor="mainPim">Hub&rsquo;s main PIM</label>
                        <select
                          id="mainPim"
                          value={effectiveMainPim(form)}
                          onChange={(e) => set('mainPim', e.target.value)}
                        >
                          {availablePims(form).map((pim) => (
                            <option key={pim} value={pim}>
                              {PIM_LABELS[pim]}
                            </option>
                          ))}
                        </select>
                        <p className="hint">
                          Which picker the Product Carousel gets. Match it to the{' '}
                          <code>PRODUCT_SOURCE</code> of the sites this hub mainly serves.
                        </p>
                      </div>

                      <div className="field field--checkbox">
                        <label htmlFor="multiPimDemo">
                          <input
                            id="multiPimDemo"
                            type="checkbox"
                            checked={form.multiPimDemo ?? false}
                            onChange={(e) => set('multiPimDemo', e.target.checked)}
                          />
                          Enable multi-PIM carousels
                        </label>
                        <p className="hint">
                          Adds the Multi-PIM Product Carousel, with a product list per PIM, for demo
                          hubs whose sites use different product sources.
                        </p>
                      </div>
                    </>
                  )}
                </section>
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
