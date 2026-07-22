import { useState } from 'react'

type Props = {
  isActive: boolean
  onActivate: () => void
}

export function FixturesCard({ isActive, onActivate }: Props) {
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
          <span className="env-card__label">Local Fixtures</span>
          <span className="badge">Built-in</span>
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
        </div>
      )}
    </div>
  )
}
