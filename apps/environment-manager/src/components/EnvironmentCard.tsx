import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../api.js'
import { hubBrands } from '../hub-brands.js'
import type {
  Config,
  CreateVercelSiteInput,
  Environment,
  EnvironmentStats,
  OpKey,
  VercelPreflight,
  WebApp,
} from '../types.js'

type Props = {
  env: Environment
  isActive: boolean
  onActivate: () => void
  onEdit: () => void
  onUpdate: (updated: Config) => void
}

const EMPTY_SITE: WebApp = { label: '', url: '', brand: '', name: '' }

// ── Micro icons ───────────────────────────────────────────────────────────────

const GlobeIcon = () => (
  <svg
    aria-hidden="true"
    className="site-row__icon"
    width="11"
    height="11"
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

const TrashIcon = () => (
  <svg aria-hidden="true" width="11" height="11" viewBox="0 0 10 12" fill="currentColor">
    <path d="M3.5 0h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1 0-1z" />
    <path d="M0 2h10v1H0z" />
    <path d="M1.5 3.5l.7 8h5.6l.7-8H1.5z" />
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
    style={{
      display: 'inline-block',
      verticalAlign: 'middle',
      marginTop: '-1px',
    }}
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

type OpStatus = 'running' | 'done' | 'error'

type ActiveOp = {
  key: OpKey
  log: string
  status: OpStatus
  /** Epoch ms when the operation started — drives the elapsed counter. */
  startedAt: number
  /** Epoch ms when the operation settled (done or error); absent while running. */
  endedAt?: number
}

const OP_LABELS: Record<OpKey, string> = {
  'seed-settings': 'Seed settings',
  'sync-settings': 'Sync settings',
  'seed-schemas': 'Seed schemas',
  'sync-schemas': 'Sync schemas',
  'seed-types': 'Seed content types',
  'sync-types': 'Sync content types',
  'seed-extensions': 'Seed extensions',
  'sync-extensions': 'Sync extensions',
  'seed-webhooks': 'Seed webhooks',
  'sync-webhooks': 'Sync webhooks',
  'wipe-webhooks': 'Remove webhooks',
  'seed-items': 'Seed content items',
  'sync-items': 'Sync content items',
  'wipe-items': 'Wipe content items',
  'seed-all': 'Seed all',
  'sync-all': 'Sync all',
  'wipe-all': 'Wipe all',
}

export function EnvironmentCard({ env, isActive, onActivate, onEdit, onUpdate }: Props) {
  const [collapsed, setCollapsed] = useState(true)
  const [stats, setStats] = useState<EnvironmentStats | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [op, setOp] = useState<ActiveOp | null>(null)
  const [logExpanded, setLogExpanded] = useState(false)
  const logRef = useRef<HTMLPreElement>(null)

  // ── Site management ────────────────────────────────────────────────────────
  const [showAddSite, setShowAddSite] = useState(false)
  const [siteForm, setSiteForm] = useState<WebApp>(EMPTY_SITE)
  const [editingWebAppIdx, setEditingWebAppIdx] = useState<number | null>(null)
  const [editWebAppForm, setEditWebAppForm] = useState<WebApp>(EMPTY_SITE)
  const [editingLocalhost, setEditingLocalhost] = useState(false)
  const [editLocalhostForm, setEditLocalhostForm] = useState({
    localhostUrl: env.localhostUrl,
    defaultBrand: env.defaultBrand,
    defaultSite: env.defaultSite ?? '',
  })
  const [sitesBusy, setSitesBusy] = useState(false)
  const addSiteLabelRef = useRef<HTMLInputElement>(null)
  const editLocalhostUrlRef = useRef<HTMLInputElement>(null)
  const editWebAppFirstRef = useRef<HTMLInputElement>(null)

  // ── Create Vercel site (ADR-0017) ────────────────────────────────────────────
  const [showCreateVercel, setShowCreateVercel] = useState(false)
  const [vercelForm, setVercelForm] = useState<CreateVercelSiteInput>({
    brand: env.defaultBrand,
    sitename: env.defaultSite ?? '',
    label: '',
    projectName: '',
  })
  const [preflight, setPreflight] = useState<VercelPreflight | null>(null)
  const [preflightLoading, setPreflightLoading] = useState(false)
  const [vercelOp, setVercelOp] = useState<{
    log: string
    status: 'running' | 'done' | 'error'
  } | null>(null)
  const vercelLogRef = useRef<HTMLPreElement>(null)
  const createVercelFirstRef = useRef<HTMLInputElement>(null)

  // ── Remove/destroy site confirm modal ────────────────────────────────────────
  // Shared by both the "Remove" and "Destroy" triggers on an editing webApp row
  // (see the TODO this replaced): a plain "Remove" silently orphans a live
  // Vercel deployment, and "Destroy" is irreversible, so both now go through
  // one confirmation with explicit "Remove" vs "Remove & destroy" choices.
  // `projectName` is present only for sites this app provisioned itself
  // (via "Create Vercel site") — manually-added sites can only be removed from
  // the config, since there's no tracked Vercel project to destroy.
  const [removeModal, setRemoveModal] = useState<{
    index: number
    label: string
    projectName?: string
  } | null>(null)
  const [destroyOp, setDestroyOp] = useState<{
    log: string
    status: 'running' | 'done' | 'error'
  } | null>(null)
  const destroyLogRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (destroyLogRef.current) destroyLogRef.current.scrollTop = destroyLogRef.current.scrollHeight
  }, [destroyOp?.log])

  useEffect(() => {
    if (showAddSite) addSiteLabelRef.current?.focus()
  }, [showAddSite])

  useEffect(() => {
    if (showCreateVercel) createVercelFirstRef.current?.focus()
  }, [showCreateVercel])

  // Keep the Vercel log scrolled to the newest output.
  useEffect(() => {
    if (vercelLogRef.current) vercelLogRef.current.scrollTop = vercelLogRef.current.scrollHeight
  }, [vercelOp?.log])

  function openCreateVercel() {
    setShowAddSite(false)
    setEditingLocalhost(false)
    setEditingWebAppIdx(null)
    setVercelForm({
      brand: env.defaultBrand,
      sitename: env.defaultSite ?? '',
      label: '',
      projectName: '',
    })
    setShowCreateVercel(true)
    // Preflight the CLI + login state so we can guide rather than fail late.
    setPreflight(null)
    setPreflightLoading(true)
    void api
      .vercelPreflight()
      .then(setPreflight)
      .catch(() =>
        setPreflight({
          cliInstalled: false,
          authenticated: false,
          detail: 'Could not run the Vercel preflight — is the API server running?',
        }),
      )
      .finally(() => setPreflightLoading(false))
  }

  function cancelCreateVercel() {
    setShowCreateVercel(false)
    setVercelForm({
      brand: env.defaultBrand,
      sitename: env.defaultSite ?? '',
      label: '',
      projectName: '',
    })
  }

  async function handleCreateVercelSite(e: React.FormEvent) {
    e.preventDefault()
    setVercelOp({ log: '', status: 'running' })
    setSitesBusy(true)
    try {
      const res = await fetch(
        `/api/environments/${encodeURIComponent(env.name)}/vercel/create-site`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vercelForm),
        },
      )
      if (!res.ok || !res.body) {
        throw new Error(res.ok ? 'No response body' : `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        full += text
        setVercelOp((prev) => (prev ? { ...prev, log: prev.log + text } : null))
      }

      const hadError = full.includes('✗')
      setVercelOp((prev) => (prev ? { ...prev, status: hadError ? 'error' : 'done' } : null))

      // Refresh config either way — a successful run has appended the site
      // server-side; a failed one leaves webApps[] untouched.
      onUpdate(await api.list())
      if (!hadError) setShowCreateVercel(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setVercelOp((prev) =>
        prev ? { ...prev, status: 'error', log: `${prev.log}\n✗ ${msg}` } : null,
      )
    } finally {
      setSitesBusy(false)
    }
  }

  useEffect(() => {
    if (editingLocalhost) editLocalhostUrlRef.current?.focus()
  }, [editingLocalhost])

  useEffect(() => {
    if (editingWebAppIdx !== null) editWebAppFirstRef.current?.focus()
  }, [editingWebAppIdx])

  function startEditWebApp(index: number) {
    setShowAddSite(false)
    setEditingLocalhost(false)
    setEditingWebAppIdx(index)
    setEditWebAppForm({ ...env.webApps[index]! })
  }

  function startEditLocalhost() {
    setShowAddSite(false)
    setEditingWebAppIdx(null)
    setEditLocalhostForm({
      localhostUrl: env.localhostUrl,
      defaultBrand: env.defaultBrand,
      defaultSite: env.defaultSite ?? '',
    })
    setEditingLocalhost(true)
  }

  function cancelSiteEdit() {
    setEditingWebAppIdx(null)
    setEditingLocalhost(false)
  }

  async function handleAddSite(e: React.FormEvent) {
    e.preventDefault()
    setSitesBusy(true)
    try {
      const updated = await api.update(env.name, { ...env, webApps: [...env.webApps, siteForm] })
      onUpdate(updated)
      setSiteForm(EMPTY_SITE)
      setShowAddSite(false)
    } finally {
      setSitesBusy(false)
    }
  }

  async function handleSaveWebApp() {
    if (editingWebAppIdx === null) return
    const original = env.webApps[editingWebAppIdx]
    // Brand and site name become build-time env vars (NEXT_PUBLIC_BRAND,
    // SITE_NAME), so changing either on a provisioned site only takes effect on
    // a redeploy. Label/URL are config-only and save without one.
    const isVercelSite =
      original?.vercelProjectName !== undefined && original.vercelProjectName !== ''
    const brandChanged = (editWebAppForm.brand ?? '').trim() !== (original?.brand ?? '').trim()
    const nameChanged = (editWebAppForm.name ?? '').trim() !== (original?.name ?? '').trim()
    if (isVercelSite && (brandChanged || nameChanged)) {
      await handleRedeployWebApp(editingWebAppIdx, editWebAppForm)
      return
    }
    setSitesBusy(true)
    try {
      const newWebApps = env.webApps.map((app, i) =>
        i === editingWebAppIdx ? editWebAppForm : app,
      )
      const updated = await api.update(env.name, { ...env, webApps: newWebApps })
      onUpdate(updated)
      setEditingWebAppIdx(null)
    } finally {
      setSitesBusy(false)
    }
  }

  // Applies a brand/site-name edit to a provisioned site by rewriting the
  // project's env vars and redeploying (same-hub, so targetName === env.name).
  // Streams into the shared Vercel log panel; on success refreshes the config
  // and closes the edit row.
  async function handleRedeployWebApp(index: number, form: WebApp) {
    setVercelOp({ log: '', status: 'running' })
    setSitesBusy(true)
    try {
      const res = await fetch(
        `/api/environments/${encodeURIComponent(env.name)}/vercel/redeploy-site`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            index,
            targetName: env.name,
            label: form.label,
            brand: form.brand,
            sitename: form.name ?? '',
          }),
        },
      )
      if (!res.ok || !res.body) {
        throw new Error(res.ok ? 'No response body' : `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        full += text
        setVercelOp((prev) => (prev ? { ...prev, log: prev.log + text } : null))
      }

      const hadError = full.includes('✗')
      setVercelOp((prev) => (prev ? { ...prev, status: hadError ? 'error' : 'done' } : null))
      onUpdate(await api.list())
      if (!hadError) setEditingWebAppIdx(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setVercelOp((prev) =>
        prev
          ? { ...prev, status: 'error', log: `${prev.log}\n✗ ${msg}` }
          : { log: `✗ ${msg}`, status: 'error' },
      )
    } finally {
      setSitesBusy(false)
    }
  }

  // Removes the site from the config only — a live Vercel deployment (if any)
  // is left running. Always invoked via the removeModal confirmation below,
  // since this silently orphans a project otherwise.
  async function handleRemoveWebApp() {
    if (editingWebAppIdx === null) return
    setSitesBusy(true)
    try {
      const updated = await api.update(env.name, {
        ...env,
        webApps: env.webApps.filter((_, i) => i !== editingWebAppIdx),
      })
      onUpdate(updated)
      setEditingWebAppIdx(null)
    } finally {
      setSitesBusy(false)
      setRemoveModal(null)
    }
  }

  // Deletes the underlying Vercel project (via the streaming destroy-site
  // endpoint) and, on success, drops the site from the config too. Only
  // reachable from removeModal when the site carries a vercelProjectName —
  // the endpoint itself also refuses sites without one (400).
  async function handleDestroyWebApp() {
    if (removeModal === null) return
    const { index } = removeModal
    setDestroyOp({ log: '', status: 'running' })
    try {
      const res = await fetch(
        `/api/environments/${encodeURIComponent(env.name)}/vercel/destroy-site`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ index }),
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
        setDestroyOp((prev) => (prev ? { ...prev, log: prev.log + text } : null))
      }

      const hadError = full.includes('✗')
      setDestroyOp((prev) => (prev ? { ...prev, status: hadError ? 'error' : 'done' } : null))

      if (!hadError) {
        onUpdate(await api.list())
        setEditingWebAppIdx(null)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setDestroyOp((prev) =>
        prev
          ? { ...prev, status: 'error', log: `${prev.log}\n✗ ${msg}` }
          : { log: `✗ ${msg}`, status: 'error' },
      )
    }
  }

  async function handleSaveLocalhost() {
    setSitesBusy(true)
    try {
      const updated = await api.update(env.name, { ...env, ...editLocalhostForm })
      onUpdate(updated)
      setEditingLocalhost(false)
    } finally {
      setSitesBusy(false)
    }
  }

  /** Returns the display label for a webApp row — blank label renders as plain "Web". */
  function siteDisplayLabel(app: WebApp) {
    return app.label !== '' ? `Web (${app.label})` : 'Web'
  }

  /** Shared keydown handler for edit-mode inputs: Enter = save, Escape = cancel. */
  function siteEditKeyDown(onSave: () => void) {
    return (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onSave()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelSiteEdit()
      }
    }
  }

  const loadStats = useCallback(() => {
    void api
      .stats(env.name)
      .then((s) => {
        setStats(s)
        setStatsError(null)
      })
      .catch((err: unknown) => {
        console.error(`Failed to fetch stats for environment "${env.name}":`, err)
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

  // Elapsed-time counter: ticks once a second while an op runs; settled ops
  // read their fixed duration from endedAt instead, so the tick can stop.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!isRunning) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [isRunning])
  // The Math.max clamp also covers the first second of a new run, when `now`
  // may still hold a timestamp from the previous one.
  const opSeconds =
    op === null ? 0 : Math.max(0, Math.round(((op.endedAt ?? now) - op.startedAt) / 1000))
  // 59s → 1m → 1m 1s …
  const opElapsed =
    opSeconds < 60
      ? `${opSeconds}s`
      : `${Math.floor(opSeconds / 60)}m${opSeconds % 60 === 0 ? '' : ` ${opSeconds % 60}s`}`

  const audioCtxRef = useRef<AudioContext | null>(null)

  function playTone(type: 'success' | 'error') {
    try {
      audioCtxRef.current ??= new AudioContext()
      const ctx = audioCtxRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      if (type === 'success') {
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.08)
        gain.gain.setValueAtTime(0.18, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
      } else {
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(220, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.25)
        gain.gain.setValueAtTime(0.22, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
      }
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.55)
    } catch {
      // AudioContext unavailable — silent fail
    }
  }

  async function runOp(key: OpKey) {
    if (key === 'wipe-webhooks') {
      if (
        !confirm(
          `Remove seeded webhooks from "${env.label || env.name}"?\n\n` +
            'Only webhooks labelled "Quadratic — …" are deleted; anything else on the hub ' +
            "is left alone. Publishes will stop busting this deployment's caches until " +
            'you seed them again.',
        )
      )
        return
    }
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

    setOp({ key, log: '', status: 'running', startedAt: Date.now() })
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
        const hasError = prev.log.includes('✗') || prev.log.includes('Error: ')
        playTone(hasError ? 'error' : 'success')
        return { ...prev, status: hasError ? 'error' : 'done', endedAt: Date.now() }
      })

      // Refresh counts after the operation settles
      loadStats()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setOp((prev) =>
        prev
          ? { ...prev, status: 'error', log: `${prev.log}\n✗ ${msg}`, endedAt: Date.now() }
          : null,
      )
    }
  }

  async function handleAbort() {
    try {
      await api.cancel(env.name)
    } catch {
      // If the cancel call itself fails (e.g. op already finished), just let
      // the stream drain normally — the status will resolve on its own.
    }
  }

  const allEmpty = stats !== null && stats.schemas === 0 && stats.types === 0 && stats.items === 0

  // The site currently being edited (if any), and whether saving it will force
  // a redeploy — i.e. a provisioned site whose brand or site name changed
  // (both are build-time env vars). Drives the edit row's warning + button.
  const editingSite = editingWebAppIdx !== null ? env.webApps[editingWebAppIdx] : undefined
  const editRowWillRedeploy =
    editingSite?.vercelProjectName !== undefined &&
    editingSite.vercelProjectName !== '' &&
    ((editWebAppForm.brand ?? '').trim() !== (editingSite.brand ?? '').trim() ||
      (editWebAppForm.name ?? '').trim() !== (editingSite.name ?? '').trim())

  return (
    <div
      className={`env-card${isActive ? ' env-card--active' : ''}${collapsed ? ' env-card--collapsed' : ''}`}
    >
      {/* Header — click to expand/collapse (Set active button is excluded via stopPropagation) */}
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
          <span className="env-card__label">{env.label || env.name}</span>
          {hubBrands(env).map((brand) => (
            <span key={brand} className="badge badge--brand" title="Brand">
              <ThemeIcon />
              {brand}
            </span>
          ))}
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
              disabled={isRunning}
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

      {/* Collapsible body */}
      {!collapsed && (
        <div className="env-card__body">
          {/* Resource stats table */}
          <table className="env-card__stats">
            <thead>
              <tr>
                <th className="col-resource">Resource</th>
                <th className="col-count">Count</th>
                <th className="col-actions">
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
                </th>
              </tr>
            </thead>
            <tbody>
              <ResourceRow
                label="Settings"
                count={statsError !== null ? -1 : (stats?.workflowStates ?? null)}
                seedKey="seed-settings"
                syncKey="sync-settings"
                isRunning={isRunning}
                activeOpKey={op?.key ?? null}
                onRun={(key) => {
                  void runOp(key)
                }}
              />
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
                label="Extensions"
                count={statsError !== null ? -1 : (stats?.extensions ?? null)}
                seedKey="seed-extensions"
                syncKey="sync-extensions"
                isRunning={isRunning}
                activeOpKey={op?.key ?? null}
                onRun={(key) => {
                  void runOp(key)
                }}
              />
              <ResourceRow
                label="Webhooks"
                count={statsError !== null ? -1 : (stats?.webhooks ?? null)}
                seedKey="seed-webhooks"
                syncKey="sync-webhooks"
                wipeKey="wipe-webhooks"
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
            <div
              className={`env-card__log log--${op.status}${logExpanded ? ' log--expanded' : ''}`}
            >
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
                      <span className="spinner spinner--sm" aria-hidden="true" /> running for{' '}
                      {opElapsed}…
                    </span>
                  )}
                  {op.status === 'done' && (
                    <span className="log-status log-status--ok">✓ done in {opElapsed}</span>
                  )}
                  {op.status === 'error' && (
                    <span className="log-status log-status--err">⚠ errored in {opElapsed}</span>
                  )}
                </span>
                {op.status === 'running' ? (
                  <button
                    className="log-abort"
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleAbort()
                    }}
                    aria-label="Abort operation"
                  >
                    ■ Stop
                  </button>
                ) : (
                  <button
                    className="log-close"
                    onClick={(e) => {
                      e.stopPropagation()
                      setOp(null)
                    }}
                    aria-label="Dismiss log"
                  >
                    ✕ Dismiss
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
            <div className="sites-header">
              <span className="sites-header__title">Sites</span>
            </div>

            <ul className="site-list">
              {/* Localhost — always present */}
              {editingLocalhost ? (
                <li className="site-row site-row--localhost site-row--editing">
                  <label>
                    <LabelIcon />
                    <input className="site-row__input" value="Web (localhost)" disabled />
                  </label>
                  <label title="localhost URL (e.g. http://localhost:3000)">
                    <GlobeIcon />
                    <input
                      ref={editLocalhostUrlRef}
                      className="site-row__input site-row__input--url"
                      placeholder="http://localhost:3000"
                      value={editLocalhostForm.localhostUrl}
                      onChange={(e) =>
                        setEditLocalhostForm((p) => ({ ...p, localhostUrl: e.target.value }))
                      }
                      onKeyDown={siteEditKeyDown(() => {
                        void handleSaveLocalhost()
                      })}
                      disabled={sitesBusy}
                    />
                  </label>
                  <label title="Site name (blank = hub name)">
                    #
                    <input
                      className="site-row__input"
                      placeholder="Site name (blank = hub name)"
                      value={editLocalhostForm.defaultSite}
                      onChange={(e) =>
                        setEditLocalhostForm((p) => ({ ...p, defaultSite: e.target.value }))
                      }
                      onKeyDown={siteEditKeyDown(() => {
                        void handleSaveLocalhost()
                      })}
                      disabled={sitesBusy}
                    />
                  </label>
                  <label title="Brand (e.g. acme)">
                    <ThemeIcon />
                    <span className="visually-hidden">Brand</span>
                    <input
                      className="site-row__input"
                      placeholder="Brand (e.g. acme)"
                      value={editLocalhostForm.defaultBrand}
                      onChange={(e) =>
                        setEditLocalhostForm((p) => ({ ...p, defaultBrand: e.target.value }))
                      }
                      onKeyDown={siteEditKeyDown(() => {
                        void handleSaveLocalhost()
                      })}
                      disabled={sitesBusy}
                    />
                  </label>
                  <div className="site-row__actions">
                    <button
                      className="btn btn--sm btn--primary"
                      onClick={() => {
                        void handleSaveLocalhost()
                      }}
                      disabled={sitesBusy || !editLocalhostForm.defaultSite}
                    >
                      {sitesBusy ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      onClick={cancelSiteEdit}
                      disabled={sitesBusy}
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              ) : (
                <li className="site-row site-row--localhost">
                  <GlobeIcon />
                  <span className="site-row__label">Web (localhost)</span>
                  <a
                    className="site-row__url"
                    href={env.localhostUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {env.localhostUrl}
                  </a>
                  {(env.defaultSite ?? '') !== '' && (
                    <span
                      className="badge badge--brand badge--sm"
                      title="Site name (delivery-key namespace)"
                    >
                      # {env.defaultSite}
                    </span>
                  )}
                  {env.defaultBrand !== '' && (
                    <span className="badge badge--brand badge--sm" title="Brand">
                      <ThemeIcon />
                      {env.defaultBrand}
                    </span>
                  )}
                  <button
                    className="btn--icon-only site-row__edit"
                    aria-label="Edit localhost"
                    onClick={startEditLocalhost}
                    disabled={isRunning || sitesBusy || editingWebAppIdx !== null}
                  >
                    <PencilIcon />
                  </button>
                </li>
              )}

              {/* Additional deployed sites */}
              {env.webApps.map((site, i) =>
                editingWebAppIdx === i ? (
                  <li key={i} className="site-row site-row--editing">
                    <label title="Label (blank = 'Web')" className="add-site-form__label--label">
                      <LabelIcon />
                      <input
                        ref={editWebAppFirstRef}
                        className="site-row__input"
                        placeholder="Optional Label"
                        value={editWebAppForm.label}
                        onChange={(e) =>
                          setEditWebAppForm((p) => ({ ...p, label: e.target.value }))
                        }
                        onKeyDown={siteEditKeyDown(() => {
                          void handleSaveWebApp()
                        })}
                        disabled={sitesBusy}
                      />
                    </label>
                    <label title="URL (e.g. https://acme.vercel.app)">
                      <GlobeIcon />
                      <input
                        className="site-row__input site-row__input--url"
                        placeholder="URL (e.g. https://acme.vercel.app)"
                        value={editWebAppForm.url}
                        onChange={(e) => setEditWebAppForm((p) => ({ ...p, url: e.target.value }))}
                        onKeyDown={siteEditKeyDown(() => {
                          void handleSaveWebApp()
                        })}
                        disabled={sitesBusy}
                      />
                    </label>
                    <label title="Site name (e.g. acme-store)">
                      #
                      <input
                        className="site-row__input"
                        placeholder="Site name (e.g. acme-store)"
                        value={editWebAppForm.name ?? ''}
                        onChange={(e) => setEditWebAppForm((p) => ({ ...p, name: e.target.value }))}
                        onKeyDown={siteEditKeyDown(() => {
                          void handleSaveWebApp()
                        })}
                        disabled={sitesBusy}
                      />
                    </label>
                    <label title="Brand (e.g. acme)">
                      <ThemeIcon />
                      <span className="visually-hidden">Brand</span>
                      <input
                        className="site-row__input"
                        placeholder="Brand (e.g. acme)"
                        value={editWebAppForm.brand}
                        onChange={(e) =>
                          setEditWebAppForm((p) => ({ ...p, brand: e.target.value }))
                        }
                        onKeyDown={siteEditKeyDown(() => {
                          void handleSaveWebApp()
                        })}
                        disabled={sitesBusy}
                      />
                    </label>
                    {editRowWillRedeploy && (
                      <p className="site-row__redeploy-note">
                        Saving will re-deploy this site to apply the new{' '}
                        {(editWebAppForm.brand ?? '').trim() !== (site.brand ?? '').trim() &&
                        (editWebAppForm.name ?? '').trim() !== (site.name ?? '').trim()
                          ? 'brand and site name'
                          : (editWebAppForm.brand ?? '').trim() !== (site.brand ?? '').trim()
                            ? 'brand'
                            : 'site name'}
                        . Deployments can typically take a few minutes.
                      </p>
                    )}
                    <div className="site-row__actions">
                      <button
                        className="btn btn--sm btn--primary"
                        onClick={() => {
                          void handleSaveWebApp()
                        }}
                        disabled={sitesBusy || !editWebAppForm.url}
                        title={
                          editRowWillRedeploy
                            ? 'Rewrite the project env vars and redeploy'
                            : 'Save changes to the config'
                        }
                      >
                        {sitesBusy ? 'Saving...' : editRowWillRedeploy ? 'Save & redeploy' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost"
                        onClick={cancelSiteEdit}
                        disabled={sitesBusy}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm btn--danger site-action--remove"
                        aria-label="Remove"
                        onClick={() =>
                          setRemoveModal({
                            index: i,
                            label: siteDisplayLabel(site),
                            ...(site.vercelProjectName
                              ? { projectName: site.vercelProjectName }
                              : {}),
                          })
                        }
                        disabled={sitesBusy}
                        title={
                          site.vercelProjectName
                            ? 'Remove this site from the config, or destroy its Vercel project too'
                            : 'Remove this site from the config'
                        }
                      >
                        <TrashIcon /> Remove…
                      </button>
                    </div>
                  </li>
                ) : (
                  <li key={i} className="site-row">
                    <GlobeIcon />
                    <span className="site-row__label">{siteDisplayLabel(site)}</span>
                    <a
                      className="site-row__url"
                      href={site.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {site.url}
                    </a>
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
                    <button
                      className="btn--icon-only site-row__edit"
                      aria-label={`Edit ${siteDisplayLabel(site)}`}
                      onClick={() => startEditWebApp(i)}
                      disabled={isRunning || sitesBusy || editingLocalhost}
                    >
                      <PencilIcon />
                    </button>
                  </li>
                ),
              )}
            </ul>

            {/* Inline add-site form — hidden while editing any row */}
            {!editingLocalhost &&
              editingWebAppIdx === null &&
              (showAddSite ? (
                <form
                  className="add-site-form add-site-form--open"
                  onSubmit={(e) => {
                    void handleAddSite(e)
                  }}
                >
                  <label title="Label (blank = 'Web')" className="add-site-form__label--label">
                    <LabelIcon />
                    <input
                      ref={addSiteLabelRef}
                      className="add-site-form__input"
                      placeholder="Optional Label"
                      value={siteForm.label}
                      onChange={(e) => setSiteForm((p) => ({ ...p, label: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setShowAddSite(false)
                          setSiteForm(EMPTY_SITE)
                        }
                      }}
                    />
                  </label>
                  <label title="URL (e.g. https://acme.vercel.app)">
                    <GlobeIcon />
                    <input
                      className="add-site-form__input add-site-form__input--url"
                      placeholder="URL (e.g. https://acme.vercel.app)"
                      value={siteForm.url}
                      onChange={(e) => setSiteForm((p) => ({ ...p, url: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setShowAddSite(false)
                          setSiteForm(EMPTY_SITE)
                        }
                      }}
                      required
                    />
                  </label>
                  <label title="Site name (e.g. acme-store)">
                    #
                    <input
                      className="add-site-form__input"
                      placeholder="Site name (e.g. acme-store)"
                      value={siteForm.name}
                      onChange={(e) => setSiteForm((p) => ({ ...p, name: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setShowAddSite(false)
                          setSiteForm(EMPTY_SITE)
                        }
                      }}
                    />
                  </label>
                  <label title="Brand (blank = env default)">
                    <ThemeIcon />
                    <span className="visually-hidden">Brand</span>
                    <input
                      className="add-site-form__input"
                      placeholder="Brand (e.g. acme)"
                      value={siteForm.brand}
                      onChange={(e) => setSiteForm((p) => ({ ...p, brand: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setShowAddSite(false)
                          setSiteForm(EMPTY_SITE)
                        }
                      }}
                    />
                  </label>
                  <div className="add-site-form__actions">
                    <button type="submit" className="btn btn--sm btn--primary" disabled={sitesBusy}>
                      {sitesBusy ? 'Adding…' : 'Add'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      onClick={() => {
                        setShowAddSite(false)
                        setSiteForm(EMPTY_SITE)
                      }}
                      disabled={sitesBusy}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : showCreateVercel ? (
                <form
                  className="add-site-form add-site-form--open"
                  onSubmit={(e) => {
                    void handleCreateVercelSite(e)
                  }}
                >
                  {/* Preflight status — guides rather than fails late (ADR-0017 §2) */}
                  <p className="add-site-form__preflight">
                    {preflightLoading ? (
                      <>
                        <span className="spinner spinner--sm" aria-hidden="true" /> Checking Vercel
                        CLI…
                      </>
                    ) : preflight === null ? null : !preflight.cliInstalled ? (
                      <span className="add-site-form__preflight--warn">⚠ {preflight.detail}</span>
                    ) : !preflight.authenticated ? (
                      <span className="add-site-form__preflight--warn">⚠ {preflight.detail}</span>
                    ) : (
                      <span className="add-site-form__preflight--ok">
                        ✓ Vercel CLI ready{preflight.user ? ` — ${preflight.user}` : ''}
                      </span>
                    )}
                  </p>
                  <label title="Label (blank = 'Web')" className="add-site-form__label--label">
                    <LabelIcon />
                    <span className="visually-hidden">Label</span>
                    <input
                      ref={createVercelFirstRef}
                      className="add-site-form__input"
                      placeholder="Optional Label"
                      value={vercelForm.label}
                      onChange={(e) => setVercelForm((p) => ({ ...p, label: e.target.value }))}
                      disabled={sitesBusy}
                    />
                  </label>
                  <label title="Site name (blank = hub default)">
                    #
                    <input
                      className="add-site-form__input"
                      placeholder="Site name (blank = hub default)"
                      value={vercelForm.sitename}
                      onChange={(e) => setVercelForm((p) => ({ ...p, sitename: e.target.value }))}
                      disabled={sitesBusy}
                    />
                  </label>
                  <label title="Brand (blank = env default)">
                    <ThemeIcon />
                    <span className="visually-hidden">Brand</span>
                    <input
                      className="add-site-form__input"
                      placeholder="Brand (blank = env default)"
                      value={vercelForm.brand}
                      onChange={(e) => setVercelForm((p) => ({ ...p, brand: e.target.value }))}
                      disabled={sitesBusy}
                    />
                  </label>
                  <label title="Vercel project name (blank = auto)">
                    ▲
                    <input
                      className="add-site-form__input"
                      placeholder="Vercel project name (blank = auto)"
                      value={vercelForm.projectName ?? ''}
                      onChange={(e) =>
                        setVercelForm((p) => ({ ...p, projectName: e.target.value }))
                      }
                      disabled={sitesBusy}
                    />
                  </label>
                  <div className="add-site-form__actions">
                    <button
                      type="submit"
                      className="btn btn--sm btn--primary"
                      disabled={
                        sitesBusy || preflightLoading || !(preflight?.authenticated ?? false)
                      }
                      title={
                        (preflight?.authenticated ?? false)
                          ? 'Create the project, push env vars, and deploy'
                          : 'Vercel CLI must be installed and logged in first'
                      }
                    >
                      {sitesBusy ? 'Creating…' : 'Create & deploy'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      onClick={cancelCreateVercel}
                      disabled={sitesBusy}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="add-site-form add-site-form--triggers">
                  <button
                    className="btn btn--sm btn--ghost"
                    onClick={() => setShowAddSite(true)}
                    disabled={isRunning}
                  >
                    + Add existing site
                  </button>
                  <button
                    className="btn btn--sm btn--ghost"
                    onClick={openCreateVercel}
                    disabled={isRunning}
                    title="Create a new Vercel project, set its env vars, and deploy"
                  >
                    + Create Vercel site
                  </button>
                </div>
              ))}

            {/* Vercel provisioning log — persists after the form closes so the
                result (and the deployed URL) stays visible. */}
            {vercelOp && (
              <div className={`env-card__log log--${vercelOp.status} log--expanded`}>
                <div className="log-header">
                  <span className="log-header__left">
                    <span className="log-title">Create Vercel site</span>
                    {vercelOp.status === 'running' && (
                      <span className="log-status">
                        <span className="spinner spinner--sm" aria-hidden="true" /> running…
                      </span>
                    )}
                    {vercelOp.status === 'done' && (
                      <span className="log-status log-status--ok">✓ done</span>
                    )}
                    {vercelOp.status === 'error' && (
                      <span className="log-status log-status--err">⚠ errored</span>
                    )}
                  </span>
                  {vercelOp.status !== 'running' && (
                    <button
                      className="log-close"
                      onClick={() => setVercelOp(null)}
                      aria-label="Dismiss log"
                    >
                      ✕ Dismiss
                    </button>
                  )}
                </div>
                <div className="log-body-wrapper">
                  <div className="log-body-inner">
                    <pre ref={vercelLogRef} className="log-body">
                      {vercelOp.log || '…'}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Remove/destroy confirm modal — shared by the "Remove…" trigger on any
          editing webApp row. Destroy is only offered when the site carries a
          vercelProjectName (i.e. it was provisioned by "Create Vercel site");
          manually-added sites only ever get the "Remove from config" choice. */}
      {removeModal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && destroyOp?.status !== 'running') {
              setRemoveModal(null)
              setDestroyOp(null)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && destroyOp?.status !== 'running') {
              setRemoveModal(null)
              setDestroyOp(null)
            }
          }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal__header">
              <h2>Remove {removeModal.label}?</h2>
              {destroyOp?.status !== 'running' && (
                <button
                  type="button"
                  className="modal__close"
                  onClick={() => {
                    setRemoveModal(null)
                    setDestroyOp(null)
                  }}
                  aria-label="Close"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="modal__body">
              <p>This can&rsquo;t be undone.</p>
              {removeModal.projectName ? (
                <p>
                  Do you want to also destroy the Vercel project (
                  <strong>{removeModal.projectName}</strong>), or just remove {removeModal.label}{' '}
                  from your config?
                </p>
              ) : (
                <p>
                  This site was added manually, so there&rsquo;s no tracked Vercel project to
                  destroy — this only removes it from your config.
                </p>
              )}

              {destroyOp ? (
                <div className={`env-card__log log--${destroyOp.status} log--expanded`}>
                  <div className="log-header">
                    <span className="log-header__left">
                      <span className="log-title">Destroy Vercel project</span>
                      {destroyOp.status === 'running' && (
                        <span className="log-status">
                          <span className="spinner spinner--sm" aria-hidden="true" /> running…
                        </span>
                      )}
                      {destroyOp.status === 'done' && (
                        <span className="log-status log-status--ok">✓ done</span>
                      )}
                      {destroyOp.status === 'error' && (
                        <span className="log-status log-status--err">⚠ errored</span>
                      )}
                    </span>
                  </div>
                  <div className="log-body-wrapper">
                    <div className="log-body-inner">
                      <pre ref={destroyLogRef} className="log-body">
                        {destroyOp.log || '…'}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setRemoveModal(null)}
                    disabled={sitesBusy}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => {
                      void handleRemoveWebApp()
                    }}
                    disabled={sitesBusy}
                  >
                    {sitesBusy ? 'Removing…' : 'Remove'}
                  </button>
                  {removeModal.projectName && (
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => {
                        void handleDestroyWebApp()
                      }}
                      disabled={sitesBusy}
                    >
                      Remove &amp; destroy
                    </button>
                  )}
                </div>
              )}

              {destroyOp && destroyOp.status !== 'running' && (
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      setRemoveModal(null)
                      setDestroyOp(null)
                    }}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
