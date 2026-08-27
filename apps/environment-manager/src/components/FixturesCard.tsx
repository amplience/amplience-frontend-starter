import { useState } from 'react'

import { resolveFixturesBrand } from '../fixtures-brand.js'

/** Droplet — used for 'brand' fields/badges. */
const ThemeIcon = () => (
  <svg
    aria-hidden="true"
    width="11"
    height="11"
    viewBox="0 0 8 10"
    fill="currentColor"
    style={{ display: 'inline-block', verticalAlign: 'middle', marginTop: '-1px' }}
  >
    <path d="M4 0C1.5 2 0 4 0 6A4 4 0 0 0 8 6C8 4 6.5 2 4 0Z" />
  </svg>
)

type Props = {
  isActive: boolean
  brand: string
  onActivate: () => void
  onSaveBrand: (brand: string) => Promise<void>
}

export function FixturesCard({ isActive, brand, onActivate, onSaveBrand }: Props) {
  const [collapsed, setCollapsed] = useState(true)
  const [draft, setDraft] = useState(brand)
  const [saved, setSaved] = useState(brand)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Saved config wins over an in-flight draft; adjusted during render rather
  // than in an effect, which would cascade an extra render.
  if (brand !== saved) {
    setSaved(brand)
    setDraft(brand)
    setError(null)
  }

  const dirty = draft.trim() !== brand.trim()

  function revert() {
    setDraft(brand)
    setError(null)
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await onSaveBrand(draft.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the brand.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`env-card env-card--fixtures${isActive ? ' env-card--active' : ''}${collapsed ? ' env-card--collapsed' : ''}`}
    >
      <div
        className="env-card__header"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setCollapsed((v) => !v)
        }}
      >
        <div className="env-card__header-labels">
          <span className="env-card__label">Local Fixtures</span>
          <span className="badge badge--brand" title="Brand">
            <ThemeIcon />
            {resolveFixturesBrand(brand)}
          </span>
        </div>
        <div className="env-card__header-actions">
          {isActive ? (
            <span className="badge badge--active">Active</span>
          ) : (
            <button
              className="btn btn--sm btn--primary"
              onClick={(e) => {
                e.stopPropagation()
                onActivate()
              }}
            >
              Set active
            </button>
          )}
          <svg
            className={`env-card__chevron${collapsed ? '' : ' env-card__chevron--open'}`}
            aria-hidden="true"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="2,4 6,8 10,4" />
          </svg>
        </div>
      </div>

      {!collapsed && (
        <div className="env-card__body">
          <p className="env-card__description">
            Serves content from bundled fixture files — no hub connection or credentials needed. The
            default for local development.
          </p>

          <div className="fixtures-brand-wrapper">
            <div className="fixtures-brand">
              <label className="site-field" title="Brand (e.g. acme)">
                <ThemeIcon />
                <span className="site-card__source-label">Brand</span>
                <input
                  className="site-row__input"
                  placeholder="Brand (blank = default)"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && dirty && !busy) {
                      e.preventDefault()
                      void save()
                    }
                    if (e.key === 'Escape') revert()
                  }}
                  disabled={busy}
                />
              </label>

              {dirty && (
                <div className="site-card__actions">
                  <button
                    className="btn btn--sm btn--primary"
                    onClick={() => {
                      void save()
                    }}
                    disabled={busy}
                  >
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={revert}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <p className="env-card__description">
              Written to <code>NEXT_PUBLIC_BRAND</code> in <code>apps/web/.env</code> whenever
              fixtures are the active content source.
            </p>

            {error !== null && <p className="site-card__error">{error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
