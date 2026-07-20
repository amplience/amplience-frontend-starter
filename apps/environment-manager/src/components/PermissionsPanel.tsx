import type { CapabilityState, PermissionsReport } from '../types.js'

// ── CapabilityBadge ───────────────────────────────────────────────────────────

const CAPABILITY_DISPLAY: Record<CapabilityState, { glyph: string; title: string }> = {
  ok: { glyph: '✓', title: 'Allowed' },
  denied: { glyph: '✗', title: 'Denied for these credentials' },
  unknown: { glyph: '?', title: 'Could not be determined' },
  error: { glyph: '⚠', title: 'Probe failed — see row detail' },
  skipped: { glyph: '–', title: 'Skipped' },
}

function CapabilityBadge({ state }: { state: CapabilityState }) {
  const { glyph, title } = CAPABILITY_DISPLAY[state]
  return (
    <span className={`perm-badge perm-badge--${state}`} title={title}>
      {glyph}
    </span>
  )
}

// ── PermissionsPanel ──────────────────────────────────────────────────────────

type Props = {
  report: PermissionsReport
  onDismiss: () => void
}

/**
 * "Credential permissions" child-card: one row per resource area the
 * seed/sync/wipe operations touch, with read (live GET probe) and write
 * (advertised HAL action links) capability per row.
 */
export function PermissionsPanel({ report, onDismiss }: Props) {
  return (
    <div className="perm-panel">
      <div className="perm-panel__header">
        <span className="perm-panel__title">Credential permissions</span>
        <button
          type="button"
          className="log-close"
          onClick={onDismiss}
          aria-label="Dismiss permissions"
        >
          ✕
        </button>
      </div>
      {!report.hub.readable ? (
        <p className="env-card__stats-error">{report.hub.detail}</p>
      ) : (
        <>
          <table className="env-card__stats perm-panel__table">
            <thead>
              <tr>
                <th className="col-resource">Capability</th>
                <th className="col-perm">Read</th>
                <th className="col-perm">Write</th>
              </tr>
            </thead>
            <tbody>
              {report.checks.map((check) => (
                <tr key={check.key} title={check.detail}>
                  <td className="col-resource">
                    {check.label}
                    {check.detail !== undefined && (
                      <span className="perm-detail"> — {check.detail}</span>
                    )}
                  </td>
                  <td className="col-perm">
                    <CapabilityBadge state={check.read} />
                  </td>
                  <td className="col-perm">
                    <CapabilityBadge state={check.write} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="perm-panel__note">
            Read is probed live; write reflects the actions the API advertises to these credentials
            via its hypermedia links.
          </p>
        </>
      )}
    </div>
  )
}
