import { useEffect, useRef, useState } from 'react'

import type { Environment } from '../types.js'

type Props = {
  env: Environment
  isActive: boolean
  onActivate: () => void
  onEdit: () => void
  onDelete: () => void
}

type OpType = 'seed' | 'sync' | 'wipe'
type OpStatus = 'running' | 'done' | 'error'

type ActiveOp = {
  type: OpType
  log: string
  status: OpStatus
}

const OP_LABELS: Record<OpType, string> = {
  seed: 'Seed',
  sync: 'Sync',
  wipe: 'Wipe',
}

const OP_DESCRIPTIONS: Record<OpType, string> = {
  seed: 'Import schemas, types and content — force-publishes everything (use for initial setup)',
  sync: 'Re-import and publish only new or changed items (use for ongoing updates)',
  wipe: 'Archive all content and reset the import mapping',
}

export function EnvironmentCard({ env, isActive, onActivate, onEdit, onDelete }: Props) {
  const [op, setOp] = useState<ActiveOp | null>(null)
  const logRef = useRef<HTMLPreElement>(null)

  // Auto-scroll the log panel as new output arrives
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [op?.log])

  const isRunning = op?.status === 'running'

  async function runOp(type: OpType) {
    if (type === 'wipe') {
      const msg =
        `Wipe all content from "${env.label || env.name}"?\n\n` +
        'This archives all published content and deletes the import mapping. ' +
        'Run Seed afterwards to repopulate.'
      if (!confirm(msg)) return
    }

    setOp({ type, log: '', status: 'running' })

    try {
      const res = await fetch(`/api/environments/${encodeURIComponent(env.name)}/${type}`, {
        method: 'POST',
      })

      if (!res.ok || !res.body) {
        throw new Error(res.ok ? 'No response body' : `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        setOp((prev) => (prev ? { ...prev, log: prev.log + text } : null))
      }

      // Determine final status from last line of output
      setOp((prev) => {
        if (!prev) return null
        const failed = prev.log.includes('✗')
        return { ...prev, status: failed ? 'error' : 'done' }
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setOp((prev) => (prev ? { ...prev, status: 'error', log: `${prev.log}\n✗ ${msg}` } : null))
    }
  }

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

      {/* Management actions */}
      <div className="env-card__actions">
        {!isActive && (
          <button className="btn btn--sm btn--primary" onClick={onActivate}>
            Set active
          </button>
        )}
        <button className="btn btn--sm btn--ghost" onClick={onEdit} disabled={isRunning}>
          Edit
        </button>
        <button className="btn btn--sm btn--danger" onClick={onDelete} disabled={isRunning}>
          Delete
        </button>
      </div>

      {/* Operation buttons */}
      <div className="env-card__ops">
        {(['seed', 'sync', 'wipe'] as const).map((type) => (
          <button
            key={type}
            className={`btn btn--sm btn--op btn--op-${type}${isRunning && op?.type === type ? ' btn--op-running' : ''}`}
            onClick={() => {
              void runOp(type)
            }}
            disabled={isRunning}
            title={OP_DESCRIPTIONS[type]}
          >
            {isRunning && op?.type === type ? (
              <span className="spinner" aria-hidden="true" />
            ) : null}
            {OP_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Live log panel */}
      {op && (
        <div className={`env-card__log log--${op.status}`}>
          <div className="log-header">
            <span className="log-title">
              {OP_LABELS[op.type]}
              {op.status === 'running' && <span className="log-status"> — running…</span>}
              {op.status === 'done' && <span className="log-status log-status--ok"> — done</span>}
              {op.status === 'error' && (
                <span className="log-status log-status--err"> — failed</span>
              )}
            </span>
            {op.status !== 'running' && (
              <button className="log-close" onClick={() => setOp(null)} aria-label="Dismiss log">
                ✕
              </button>
            )}
          </div>
          <pre ref={logRef} className="log-body">
            {op.log || '…'}
          </pre>
        </div>
      )}
    </div>
  )
}

/** Show only the last 6 chars of an ID to confirm it's set without exposing it fully. */
function mask(value: string): string {
  if (value.length <= 6) return '••••••'
  return `••••${value.slice(-6)}`
}
