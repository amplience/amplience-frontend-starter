import { useEffect, useRef, useState } from 'react'

import { api } from '../api.js'
import type { Config, Environment, WebApp } from '../types.js'

type Props = {
  /** The hub this site currently belongs to (its parent in the config). */
  env: Environment
  site: WebApp
  /** Index of `site` within `env.webApps` — the edit/move handles key off it. */
  index: number
  /** All hubs, for the "content source" re-point selector. */
  environments: Environment[]
  onUpdate: (config: Config) => void
}

// ── Micro icons (mirrors EnvironmentCard's set) ─────────────────────────────────

const GlobeIcon = () => (
  <svg
    aria-hidden="true"
    className="site-row__icon"
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="currentColor"
  >
    <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM2.04 9h1.96c.08.85.22 1.65.42 2.38A6.02 6.02 0 0 1 2.04 9zm0-2a6.02 6.02 0 0 1 2.38-2.38C4.22 5.35 4.08 6.15 4 7H2.04zM9 4.12c.4.72.72 1.72.88 2.88H6.12c.16-1.16.48-2.16.88-2.88C7.28 4.05 7.64 4 8 4s.72.05 1 .12zM6.12 9h3.76c-.16 1.16-.48 2.16-.88 2.88A6.07 6.07 0 0 1 8 12c-.36 0-.72-.05-1-.12C6.6 11.16 6.28 10.16 6.12 9zm4.84 2.38c.2-.73.34-1.53.42-2.38h1.96a6.02 6.02 0 0 1-2.38 2.38zm.42-4.38c-.08-.85-.22-1.65-.42-2.38A6.02 6.02 0 0 1 13.96 7H12c-.08-.85-.22-1.65-.42-2.38z" />
  </svg>
)

const PencilIcon = () => (
  <svg aria-hidden="true" width="11" height="11" viewBox="0 0 10 10" fill="currentColor">
    <path d="M7.5 0.5L9.5 2.5L3 9H1V7L7.5 0.5Z" />
  </svg>
)

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

/** Tag — used for 'label' fields. */
const LabelIcon = () => (
  <svg
    aria-hidden="true"
    width="11"
    height="11"
    viewBox="0 0 14 14"
    fill="currentColor"
    style={{ display: 'inline-block', verticalAlign: 'middle', marginTop: '-1px' }}
  >
    <path
      fillRule="evenodd"
      d="M2.8 2.8 L7.7 2 L12.7 7 L7 12.7 L2 7.7 Z M6.2 4.9 A1.3 1.3 0 1 1 3.6 4.9 A1.3 1.3 0 1 1 6.2 4.9 Z"
    />
  </svg>
)

const EMPTY_SITE: WebApp = { label: '', url: '', brand: '', name: '' }

/** Display label for a site — blank label renders as plain "Web". */
function siteDisplayLabel(site: WebApp, hubLabel?: string) {
  const title = hubLabel ?? 'Web'
  return site.label !== '' ? `${title} (${site.label})` : title
}

type DeployOp = { log: string; status: 'running' | 'done' | 'error' }

export function SiteCard({ env, site, index, environments, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<WebApp>(EMPTY_SITE)
  const [target, setTarget] = useState(env.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deployOp, setDeployOp] = useState<DeployOp | null>(null)
  const deployLogRef = useRef<HTMLPreElement>(null)

  const hubLabel = env.label || env.name
  const isVercel = site.vercelProjectName !== undefined && site.vercelProjectName !== ''
  const movePending = target !== env.name
  const targetEnvObj = environments.find((e) => e.name === target)
  const targetLabel = targetEnvObj === undefined ? target : targetEnvObj.label || targetEnvObj.name
  // Brand and site name become build-time env vars (NEXT_PUBLIC_BRAND, SITE_NAME),
  // so editing either — like changing the hub — only takes effect on a redeploy.
  // Label and URL are config-only, so they never force one.
  const brandChanged = form.brand.trim() !== site.brand.trim()
  const siteNameChanged = (form.name ?? '').trim() !== (site.name ?? '').trim()
  const envAffectingChange = movePending || brandChanged || siteNameChanged
  // On a provisioned site an env-affecting change rewrites the project's env
  // vars and redeploys; otherwise Save is a plain config write.
  const willRedeploy = isVercel && envAffectingChange

  // Keep the deploy log scrolled to the newest output.
  useEffect(() => {
    if (deployLogRef.current) deployLogRef.current.scrollTop = deployLogRef.current.scrollHeight
  }, [deployOp?.log])

  function startEdit() {
    // Preserve the Vercel tracking fields (vercelProjectName/scope) that the
    // form doesn't expose — spread the original site, override the four
    // editable fields on save.
    setForm({ ...site })
    setTarget(env.name)
    setError(null)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setTarget(env.name)
    setError(null)
  }

  // Persists the edit. A hub change on a Vercel-provisioned site goes through
  // the streaming redeploy path (handleRedeploy); everything else is a plain
  // config write. Field changes and a content-source change are applied
  // together on Save.
  async function handleSave() {
    if (willRedeploy) {
      await handleRedeploy()
      return
    }
    setBusy(true)
    setError(null)
    try {
      const updatedSite: WebApp = { ...site, ...form }
      if (!movePending) {
        const webApps = env.webApps.map((s, i) => (i === index ? updatedSite : s))
        onUpdate(await api.update(env.name, { ...env, webApps }))
      } else {
        // Config-only move (non-Vercel site). No atomic endpoint, so two PUTs —
        // add to the target hub first, then remove from the source using the
        // freshly-returned config, so a mid-failure leaves a harmless duplicate
        // rather than dropping the site entirely.
        const targetEnv = environments.find((e) => e.name === target)
        if (!targetEnv) throw new Error('Target hub no longer exists.')
        const afterAdd = await api.update(targetEnv.name, {
          ...targetEnv,
          webApps: [...targetEnv.webApps, updatedSite],
        })
        const sourceEnv = afterAdd.environments.find((e) => e.name === env.name)
        if (!sourceEnv) throw new Error('Source hub disappeared during move.')
        const afterRemove = await api.update(env.name, {
          ...sourceEnv,
          webApps: sourceEnv.webApps.filter((_, i) => i !== index),
        })
        onUpdate(afterRemove)
      }
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save site')
    } finally {
      setBusy(false)
    }
  }

  // Streams the server-side re-point: rewrite the project's hub env vars to the
  // target hub, redeploy to production, then move the site in config. The log
  // persists after it settles; the config refresh is deferred to Dismiss so the
  // success log (and new URL) stays visible before this card re-renders under
  // its new hub.
  async function handleRedeploy() {
    setBusy(true)
    setError(null)
    setDeployOp({ log: '', status: 'running' })
    try {
      const res = await fetch(
        `/api/environments/${encodeURIComponent(env.name)}/vercel/redeploy-site`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            index,
            targetName: target,
            label: form.label,
            brand: form.brand,
            sitename: form.name ?? '',
          }),
        },
      )
      if (!res.ok || !res.body) {
        const errBody: unknown = await res.json().catch(() => null)
        const msg =
          errBody !== null && typeof errBody === 'object' && 'error' in errBody
            ? String(errBody.error)
            : `HTTP ${res.status}`
        throw new Error(msg)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        full += text
        setDeployOp((prev) => (prev ? { ...prev, log: prev.log + text } : null))
      }

      const hadError = full.includes('✗')
      setDeployOp((prev) => (prev ? { ...prev, status: hadError ? 'error' : 'done' } : null))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to redeploy site'
      setDeployOp((prev) =>
        prev
          ? { ...prev, status: 'error', log: `${prev.log}\n✗ ${msg}` }
          : { log: `✗ ${msg}`, status: 'error' },
      )
    } finally {
      setBusy(false)
    }
  }

  // Dismisses the settled deploy log. On success the config already changed
  // server-side, so refresh — which re-renders this card under its new hub.
  async function handleDismissDeploy() {
    const wasDone = deployOp?.status === 'done'
    setDeployOp(null)
    if (wasDone) {
      setEditing(false)
      onUpdate(await api.list())
    }
  }

  return (
    <div className="site-card">
      <div className="site-card__header">
        <div className="site-card__title">
          <GlobeIcon />
          <span className="site-card__label">{siteDisplayLabel(site, hubLabel)}</span>
        </div>
        {!editing && (
          <button
            className="btn--icon-only site-card__edit"
            aria-label={`Edit ${siteDisplayLabel(site)}`}
            onClick={startEdit}
            disabled={busy}
          >
            <PencilIcon />
          </button>
        )}
      </div>

      {editing ? (
        <div className="site-card__edit-form">
          <label className="site-field" title="Label (blank = 'Web')">
            <LabelIcon />
            <input
              className="site-row__input"
              placeholder="Optional label"
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
              disabled={busy}
            />
          </label>
          <label className="site-field" title="URL (e.g. https://acme.vercel.app)">
            <GlobeIcon />
            <input
              className="site-row__input site-row__input--url"
              placeholder="https://acme.vercel.app"
              value={form.url}
              onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
              disabled={busy}
            />
          </label>
          <label className="site-field" title="Site name (e.g. acme-store)">
            #
            <input
              className="site-row__input"
              placeholder="Site name (e.g. acme-store)"
              value={form.name ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              disabled={busy}
            />
          </label>
          <label className="site-field" title="Brand (e.g. acme)">
            <ThemeIcon />
            <input
              className="site-row__input"
              placeholder="Brand (e.g. acme)"
              value={form.brand}
              onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
              disabled={busy}
            />
          </label>
          <label className="site-field" title="Content source (the hub this site draws from)">
            <span className="site-card__source-label" id={`src-label-${env.name}-${index}`}>
              Content source
            </span>
            <select
              className="site-card__select"
              aria-labelledby={`src-label-${env.name}-${index}`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={busy}
            >
              {environments.map((e) => (
                <option key={e.name} value={e.name}>
                  {e.label || e.name}
                </option>
              ))}
            </select>
          </label>

          {willRedeploy &&
            deployOp === null &&
            (movePending ? (
              <p className="site-card__warning">
                Clicking Save will trigger a re-deployment of the site so it can start serving
                content from <strong>{targetLabel}</strong>. Deployments can typically take a few
                minutes.
              </p>
            ) : (
              <p className="site-card__warning">
                Clicking Save will trigger a re-deployment of the site to apply the new{' '}
                {brandChanged && siteNameChanged
                  ? 'brand and site name'
                  : brandChanged
                    ? 'brand'
                    : 'site name'}
                . Deployments can typically take a few minutes.
              </p>
            ))}

          {movePending && !isVercel && (
            <p className="site-card__warning">
              Moving updates the config only — this site isn&rsquo;t a tracked Vercel deployment, so
              nothing is redeployed.
            </p>
          )}

          {deployOp ? (
            <div className={`env-card__log log--${deployOp.status} log--expanded`}>
              <div className="log-header">
                <span className="log-header__left">
                  <span className="log-title">Redeploy site</span>
                  {deployOp.status === 'running' && (
                    <span className="log-status">
                      <span className="spinner spinner--sm" aria-hidden="true" /> running…
                    </span>
                  )}
                  {deployOp.status === 'done' && (
                    <span className="log-status log-status--ok">✓ done</span>
                  )}
                  {deployOp.status === 'error' && (
                    <span className="log-status log-status--err">⚠ errored</span>
                  )}
                </span>
                {deployOp.status !== 'running' && (
                  <button
                    className="log-close"
                    onClick={() => {
                      void handleDismissDeploy()
                    }}
                    aria-label="Dismiss log"
                  >
                    ✕ Dismiss
                  </button>
                )}
              </div>
              <div className="log-body-wrapper">
                <div className="log-body-inner">
                  <pre ref={deployLogRef} className="log-body">
                    {deployOp.log || '…'}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="site-card__actions">
              <button
                className="btn btn--sm btn--primary"
                onClick={() => {
                  void handleSave()
                }}
                disabled={busy || !form.url}
              >
                {busy ? 'Saving…' : willRedeploy ? 'Save & redeploy' : 'Save'}
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={cancelEdit}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="site-card__body">
          <a className="site-card__url" href={site.url} target="_blank" rel="noreferrer noopener">
            {site.url}
          </a>
          <div className="site-card__badges">
            {(site.name ?? '') !== '' && (
              <span
                className="badge badge--brand badge--sm"
                title="Site name (delivery-key namespace)"
              >
                # {site.name}
              </span>
            )}
            {site.brand !== '' && (
              <span className="badge badge--brand badge--sm" title="Brand">
                <ThemeIcon />
                {site.brand}
              </span>
            )}
            {isVercel && (
              <span className="badge badge--sm" title={`Vercel project: ${site.vercelProjectName}`}>
                ▲ {site.vercelProjectName}
              </span>
            )}
          </div>
        </div>
      )}

      {error !== null && <p className="site-card__error">{error}</p>}
    </div>
  )
}
