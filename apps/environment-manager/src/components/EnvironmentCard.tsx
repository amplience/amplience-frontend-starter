import type { Environment } from '../types.js'

type Props = {
  env: Environment
  isActive: boolean
  onActivate: () => void
  onEdit: () => void
  onDelete: () => void
}

export function EnvironmentCard({ env, isActive, onActivate, onEdit, onDelete }: Props) {
  return (
    <div className={`env-card${isActive ? ' env-card--active' : ''}`}>
      <div className="env-card__header">
        <div>
          <span className="env-card__label">{env.label || env.name}</span>
          {isActive && <span className="badge badge--active">Active</span>}
        </div>
        <span className="env-card__name">{env.name}</span>
      </div>

      <dl className="env-card__meta">
        <div>
          <dt>Hub</dt>
          <dd>{env.hubName || <span className="dim">—</span>}</dd>
        </div>
        <div>
          <dt>App URL</dt>
          <dd>{env.appUrl || <span className="dim">—</span>}</dd>
        </div>
        <div>
          <dt>Content repo</dt>
          <dd>{env.repoContent ? mask(env.repoContent) : <span className="dim">—</span>}</dd>
        </div>
        <div>
          <dt>Slots repo</dt>
          <dd>{env.repoSlots ? mask(env.repoSlots) : <span className="dim">—</span>}</dd>
        </div>
        {env.stagingHost && (
          <div>
            <dt>Staging host</dt>
            <dd>{env.stagingHost}</dd>
          </div>
        )}
      </dl>

      <div className="env-card__actions">
        {!isActive && (
          <button className="btn btn--sm btn--primary" onClick={onActivate}>
            Set active
          </button>
        )}
        <button className="btn btn--sm btn--ghost" onClick={onEdit}>
          Edit
        </button>
        <button className="btn btn--sm btn--danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  )
}

/** Show only the last 6 chars of an ID to confirm it's set without exposing it fully. */
function mask(value: string): string {
  if (value.length <= 6) return '••••••'
  return `••••${value.slice(-6)}`
}
