import { useState } from 'react'

import type { FixtureSetInfo } from '../types.js'

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
  set: FixtureSetInfo
  isActive: boolean
  onActivate: () => void
}

/**
 * One fixture set — an offline content source.
 *
 * A set's brand and namespace are its own, declared in its `set.json`, so there
 * is nothing to edit here: activating a different set switches both. The list is
 * code-bound to what's on disk, so there is no add or remove either.
 */
export function FixturesCard({ set, isActive, onActivate }: Props) {
  const [collapsed, setCollapsed] = useState(true)

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
          <span className="env-card__label">{set.label}</span>
          <span className="badge badge--brand" title="Site name (delivery-key namespace)">
            # {set.name}
          </span>
          <span className="badge badge--brand" title="Brand">
            <ThemeIcon />
            {set.defaultBrand === '' ? 'default' : set.defaultBrand}
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
            {set.description} Served from bundled fixture files — no hub connection or credentials
            needed.
          </p>
        </div>
      )}
    </div>
  )
}
