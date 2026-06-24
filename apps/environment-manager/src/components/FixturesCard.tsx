type Props = {
  isActive: boolean
  onActivate: () => void
}

export function FixturesCard({ isActive, onActivate }: Props) {
  return (
    <div className={`env-card env-card--fixtures${isActive ? ' env-card--active' : ''}`}>
      <div className="env-card__header">
        <div>
          <span className="env-card__label">Local Fixtures</span>
          <span className="badge badge--builtin">Built-in</span>
          {isActive && <span className="badge badge--active">Active</span>}
        </div>
      </div>

      <p className="env-card__description">
        Serves content from bundled fixture files — no hub connection or credentials needed. The
        default for local development.
      </p>

      <div className="env-card__actions">
        {!isActive && (
          <button className="btn btn--sm btn--primary" onClick={onActivate}>
            Set active
          </button>
        )}
      </div>
    </div>
  )
}
