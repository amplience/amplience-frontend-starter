import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../api.js'
import type { Environment, EnvironmentStats, OpKey } from '../types.js'

type Props = {
  env: Environment
  isActive: boolean
  onActivate: () => void
  onEdit: () => void
}

type OpStatus = 'running' | 'done' | 'error'

type ActiveOp = {
  key: OpKey
  log: string
  status: OpStatus
}

const OP_LABELS: Record<OpKey, string> = {
  'seed-schemas': 'Seed schemas',
  'sync-schemas': 'Sync schemas',
  'seed-types': 'Seed content types',
  'sync-types': 'Sync content types',
  'seed-items': 'Seed content items',
  'sync-items': 'Sync content items',
  'wipe-items': 'Wipe content items',
  'seed-all': 'Seed all',
  'sync-all': 'Sync all',
  'wipe-all': 'Wipe all',
}

export function EnvironmentCard({ env, isActive, onActivate, onEdit }: Props) {
  const [stats, setStats] = useState<EnvironmentStats | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [op, setOp] = useState<ActiveOp | null>(null)
  const [logExpanded, setLogExpanded] = useState(false)
  const logRef = useRef<HTMLPreElement>(null)

  const loadStats = useCallback(() => {
    void api
      .stats(env.name)
      .then((s) => {
        setStats(s)
        setStatsError(null)
      })
      .catch((err: unknown) => {
        setStatsError(err instanceof Error ? err.message : 'Failed to fetch stats')
      })
  }, [env.name])

  function refreshStats() {
    setStats(null)
    setStatsError(null)
    loadStats()
  }

  useEffect(() => {
    loadStats()
  }, [loadStats])

  // Auto-scroll the log panel as new output arrives
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [op?.log])

  const isRunning = op?.status === 'running'

  async function runOp(key: OpKey) {
    if (key === 'wipe-items' || key === 'wipe-all') {
      const label = env.label || env.name
      const what = key === 'wipe-all' ? 'all content items' : 'content items'
      if (
        !confirm(
          `Wipe ${what} from "${label}"?\n\n` +
            'This archives all published content and deletes the import mapping. ' +
            'Run Seed afterwards to repopulate.',
        )
      )
        return
    }

    setOp({ key, log: '', status: 'running' })
    setLogExpanded(false)

    try {
      const res = await fetch(`/api/environments/${encodeURIComponent(env.name)}/${key}`, {
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

      setOp((prev) => {
        if (!prev) return null
        return { ...prev, status: prev.log.includes('✗') ? 'error' : 'done' }
      })

      // Refresh counts after the operation settles
      loadStats()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setOp((prev) => (prev ? { ...prev, status: 'error', log: `${prev.log}\n✗ ${msg}` } : null))
    }
  }

  const allEmpty = stats !== null && stats.schemas === 0 && stats.types === 0 && stats.items === 0

  return (
    <div className={`env-card${isActive ? ' env-card--active' : ''}`}>
      {/* Header */}
      <div className="env-card__header">
        <div>
          <span className="env-card__label">{env.label || env.name}</span>
          {env.defaultBrand !== '' && (
            <span className="badge badge--brand">
              <svg
                aria-hidden="true"
                width="8"
                height="10"
                viewBox="0 0 8 10"
                fill="currentColor"
                style={{
                  display: 'inline-block',
                  verticalAlign: 'middle',
                  marginRight: '0.25em',
                  marginTop: '-1px',
                }}
              >
                <path d="M4 0C1.5 2 0 4 0 6A4 4 0 0 0 8 6C8 4 6.5 2 4 0Z" />
              </svg>
              {env.defaultBrand}
            </span>
          )}
          {isActive && <span className="badge badge--active">Active</span>}
        </div>
        <div className="env-card__header-actions">
          {!isActive && (
            <button className="btn btn--sm btn--primary" onClick={onActivate} disabled={isRunning}>
              Set active
            </button>
          )}
          <button
            className="btn--icon-only"
            onClick={refreshStats}
            disabled={isRunning || stats === null}
            aria-label="Refresh stats"
            title="Refresh counts"
          >
            ↻
          </button>
          <button
            className="btn--icon-only"
            onClick={onEdit}
            disabled={isRunning}
            aria-label="Environment settings"
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Resource stats table */}
      <table className="env-card__stats">
        <thead>
          <tr>
            <th className="col-resource">Resource</th>
            <th className="col-count">Count</th>
            <th className="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          <ResourceRow
            label="Content type schemas"
            count={statsError !== null ? -1 : (stats?.schemas ?? null)}
            seedKey="seed-schemas"
            syncKey="sync-schemas"
            isRunning={isRunning}
            activeOpKey={op?.key ?? null}
            onRun={(key) => {
              void runOp(key)
            }}
          />
          <ResourceRow
            label="Content types"
            count={statsError !== null ? -1 : (stats?.types ?? null)}
            seedKey="seed-types"
            syncKey="sync-types"
            isRunning={isRunning}
            activeOpKey={op?.key ?? null}
            onRun={(key) => {
              void runOp(key)
            }}
          />
          <ResourceRow
            label="Content items"
            count={statsError !== null ? -1 : (stats?.items ?? null)}
            seedKey="seed-items"
            syncKey="sync-items"
            wipeKey="wipe-items"
            isRunning={isRunning}
            activeOpKey={op?.key ?? null}
            onRun={(key) => {
              void runOp(key)
            }}
          />
        </tbody>
      </table>

      {statsError !== null && (
        <p className="env-card__stats-error">
          Could not load stats: {statsError}{' '}
          <button className="btn btn--sm btn--ghost" onClick={loadStats}>
            Retry
          </button>
        </p>
      )}

      {/* Footer: all-resources operations */}
      <div className="env-card__ops">
        <span className="env-card__ops-label">All resources</span>
        {stats === null && statsError === null ? (
          <>
            <div className="btn-skeleton btn-skeleton--wide" aria-hidden="true">
              &nbsp;
            </div>
            <div className="btn-skeleton btn-skeleton--wide" aria-hidden="true">
              &nbsp;
            </div>
          </>
        ) : allEmpty ? (
          <button
            className={`btn btn--sm btn--op btn--op-seed${isRunning && op?.key === 'seed-all' ? ' btn--op-running' : ''}`}
            onClick={() => {
              void runOp('seed-all')
            }}
            disabled={isRunning}
          >
            {isRunning && op?.key === 'seed-all' ? (
              <span className="spinner" aria-hidden="true" />
            ) : null}
            Seed all
          </button>
        ) : (
          <>
            <button
              className={`btn btn--sm btn--op btn--op-sync${isRunning && op?.key === 'sync-all' ? ' btn--op-running' : ''}`}
              onClick={() => {
                void runOp('sync-all')
              }}
              disabled={isRunning}
            >
              {isRunning && op?.key === 'sync-all' ? (
                <span className="spinner" aria-hidden="true" />
              ) : null}
              Sync all
            </button>
            <button
              className={`btn btn--sm btn--op btn--op-wipe${isRunning && op?.key === 'wipe-all' ? ' btn--op-running' : ''}`}
              onClick={() => {
                void runOp('wipe-all')
              }}
              disabled={isRunning}
            >
              {isRunning && op?.key === 'wipe-all' ? (
                <span className="spinner" aria-hidden="true" />
              ) : null}
              Wipe all
            </button>
          </>
        )}
      </div>

      {/* Live log panel */}
      {op && (
        <div className={`env-card__log log--${op.status}${logExpanded ? ' log--expanded' : ''}`}>
          {/* Clicking the header row toggles the log body; the X button is excluded via stopPropagation */}
          <div
            className="log-header"
            role="button"
            tabIndex={0}
            onClick={() => setLogExpanded((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setLogExpanded((v) => !v)
            }}
          >
            <span className="log-header__left">
              <span
                className={`log-caret${logExpanded ? ' log-caret--open' : ''}`}
                aria-hidden="true"
              >
                ›
              </span>
              <span className="log-title">{OP_LABELS[op.key]}</span>
              {op.status === 'running' && (
                <span className="log-status">
                  <span className="spinner spinner--sm" aria-hidden="true" /> running…
                </span>
              )}
              {op.status === 'done' && <span className="log-status log-status--ok">✓ done</span>}
              {op.status === 'error' && (
                <span className="log-status log-status--err">⚠ failed</span>
              )}
            </span>
            {op.status !== 'running' && (
              <button
                className="log-close"
                onClick={(e) => {
                  e.stopPropagation()
                  setOp(null)
                }}
                aria-label="Dismiss log"
              >
                ✕
              </button>
            )}
          </div>
          <div className="log-body-wrapper">
            <div className="log-body-inner">
              <pre ref={logRef} className="log-body">
                {op.log || '…'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Sites */}
      <div className="env-card__sites">
        {/* Sites will be listed here with simple info on their URL and their brand */
        /* Every hub will have a localhost at least, listed with its brand */
        /* But if the hub is deployed, it will have a URL and brand listed here as well */
        /* In some cases in the future, there may be multiple deployed sites for a single hub, so we will list them all here */}
      </div>
    </div>
  )
}

// ── ResourceRow ───────────────────────────────────────────────────────────────

type ResourceRowProps = {
  label: string
  /** null = loading, -1 = error, ≥0 = actual count */
  count: number | null
  seedKey: OpKey
  syncKey: OpKey
  wipeKey?: OpKey
  isRunning: boolean
  activeOpKey: OpKey | null
  onRun: (key: OpKey) => void
}

function ResourceRow({
  label,
  count,
  seedKey,
  syncKey,
  wipeKey,
  isRunning,
  activeOpKey,
  onRun,
}: ResourceRowProps) {
  return (
    <tr>
      <td className="col-resource">{label}</td>
      <td className="col-count">
        {count === null ? (
          <span className="spinner spinner--sm" aria-label="Loading" />
        ) : count === -1 ? (
          <span className="dim" title="Could not fetch count">
            —
          </span>
        ) : (
          count.toLocaleString()
        )}
      </td>
      <td className="col-actions">
        {count === null && (
          <div className="btn-skeleton" aria-hidden="true">
            &nbsp;
          </div>
        )}
        {count !== null && count !== -1 && (
          <div className="btn-group">
            {count === 0 ? (
              <button
                className={`btn btn--sm btn--op btn--op-seed${isRunning && activeOpKey === seedKey ? ' btn--op-running' : ''}`}
                onClick={() => onRun(seedKey)}
                disabled={isRunning}
              >
                {isRunning && activeOpKey === seedKey ? (
                  <span className="spinner" aria-hidden="true" />
                ) : null}
                Seed
              </button>
            ) : (
              <>
                <button
                  className={`btn btn--sm btn--op btn--op-sync${isRunning && activeOpKey === syncKey ? ' btn--op-running' : ''}`}
                  onClick={() => onRun(syncKey)}
                  disabled={isRunning}
                >
                  {isRunning && activeOpKey === syncKey ? (
                    <span className="spinner" aria-hidden="true" />
                  ) : null}
                  Sync
                </button>
                {wipeKey !== undefined && (
                  <button
                    className={`btn btn--sm btn--op btn--op-wipe${isRunning && activeOpKey === wipeKey ? ' btn--op-running' : ''}`}
                    onClick={() => onRun(wipeKey)}
                    disabled={isRunning}
                  >
                    {isRunning && activeOpKey === wipeKey ? (
                      <span className="spinner" aria-hidden="true" />
                    ) : null}
                    Wipe
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
