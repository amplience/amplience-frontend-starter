import { useCallback, useEffect, useState } from 'react'

import { api } from './api.js'
import { EnvironmentCard } from './components/EnvironmentCard.js'
import { EnvironmentForm } from './components/EnvironmentForm.js'
import { FixturesCard } from './components/FixturesCard.js'
import { ListFilter } from './components/ListFilter.js'
import { SiteCard } from './components/SiteCard.js'
import { FILTER_MIN_ITEMS, filterEnvironments } from './filter-environments.js'
import type { Config, Environment } from './types.js'
import { FIXTURES_NAME } from './types.js'

type Modal = { mode: 'add' } | { mode: 'edit'; env: Environment } | null

type Tab = 'sources' | 'sites'

/**
 * Localhost web apps are surfaced per-hub in the Content Sources tab (the
 * "Web (localhost)" pseudo-row driven by env.localhostUrl), so they're
 * deliberately excluded from the flat Sites list. localhost isn't stored in
 * webApps[], but a manually-added one would be — this filters those too.
 */
const isLocalhostUrl = (url: string) => /(?:localhost|127\.0\.0\.1|\[::1\])/i.test(url)

export function App() {
  const [config, setConfig] = useState<Config | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('sources')
  const [hubQuery, setHubQuery] = useState('')

  // useCallback keeps the reference stable so the effect dep array is honest.
  // setState setters are guaranteed stable by React, so no extra deps needed.
  const load = useCallback(() => {
    void api
      .list()
      .then((nextConfig) => {
        setConfig(nextConfig)
        setLoadError(null)
      })
      .catch(() => setLoadError('Could not reach the API server. Is it running?'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSave(env: Environment) {
    let updated: Config
    if (modal?.mode === 'edit') {
      updated = await api.update(modal.env.name, env)
    } else {
      updated = await api.add(env)
    }
    setConfig(updated)
    setModal(null)
  }

  async function handleActivate(name: string) {
    setConfig(await api.activate(name))
  }

  async function handleDelete(name: string) {
    setConfig(await api.remove(name))
  }

  async function handleSaveFixturesBrand(brand: string) {
    setConfig(await api.setFixturesBrand(brand))
  }

  const hubs = config?.environments ?? []
  const showHubFilter = hubs.length >= FILTER_MIN_ITEMS
  // Hiding the input must never leave a filter silently applied — deleting hubs
  // can drop the count back below the threshold while a query is still set.
  const hubFilter = showHubFilter ? hubQuery : ''
  const visibleHubs = filterEnvironments(hubs, hubFilter)

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <div>
            <h1>Environment Manager</h1>
            <p className="app-header__sub">
              Manage <code>quadratic.config.json</code> — credentials never leave your machine.
            </p>
          </div>
        </div>
      </header>

      <main className="app-main">
        {loadError && (
          <div className="banner banner--error">
            <strong>Error:</strong> {loadError}
            <button
              className="btn btn--sm btn--ghost"
              onClick={load}
              style={{ marginLeft: '1rem' }}
            >
              Retry
            </button>
          </div>
        )}

        {config === null && !loadError && <p className="loading">Loading…</p>}

        {config !== null && (
          <>
            <div className="tabs" role="tablist" aria-label="View">
              <button
                className={`tab${tab === 'sources' ? ' tab--active' : ''}`}
                role="tab"
                aria-selected={tab === 'sources'}
                onClick={() => setTab('sources')}
              >
                Content Sources
              </button>
              <button
                className={`tab${tab === 'sites' ? ' tab--active' : ''}`}
                role="tab"
                aria-selected={tab === 'sites'}
                onClick={() => setTab('sites')}
              >
                Sites
              </button>
            </div>

            {/* Content Sources — hubs + fixtures */}
            {tab === 'sources' && (
              <div className="env-list">
                <h3 className="env-list__title">Fixtures</h3>
                <FixturesCard
                  isActive={config.active === FIXTURES_NAME}
                  brand={config.fixturesBrand ?? ''}
                  onActivate={() => {
                    void handleActivate(FIXTURES_NAME)
                  }}
                  onSaveBrand={handleSaveFixturesBrand}
                />
                <div className="env-list__header">
                  <h3 className="env-list__title">Hubs</h3>
                  {showHubFilter && (
                    <ListFilter
                      label="Filter hubs"
                      placeholder="Filter hubs…"
                      noun="hubs"
                      value={hubQuery}
                      onChange={setHubQuery}
                      resultCount={visibleHubs.length}
                      totalCount={hubs.length}
                    />
                  )}
                </div>

                {visibleHubs.map((env) => (
                  <EnvironmentCard
                    key={env.name}
                    env={env}
                    isActive={env.name === config.active}
                    onActivate={() => {
                      void handleActivate(env.name)
                    }}
                    onEdit={() => setModal({ mode: 'edit', env })}
                    onUpdate={setConfig}
                  />
                ))}

                {visibleHubs.length === 0 && hubFilter.trim() !== '' && (
                  <p className="empty-state empty-state--filter">
                    No hubs match “{hubFilter.trim()}”.
                    <button className="btn btn--sm btn--ghost" onClick={() => setHubQuery('')}>
                      Clear filter
                    </button>
                  </p>
                )}

                <button
                  className="btn btn--primary btn--add"
                  onClick={() => setModal({ mode: 'add' })}
                >
                  + Add hub
                </button>
              </div>
            )}

            {/* Sites — every webApp across all hubs as one flat list. Draws
                from the same config; each card links back to the hub it takes
                content from, and can be re-pointed to a different hub. */}
            {tab === 'sites' && <SitesTab config={config} onUpdate={setConfig} />}
          </>
        )}
      </main>

      {modal !== null && (
        <EnvironmentForm
          {...(modal.mode === 'edit' ? { initial: modal.env } : {})}
          onSave={handleSave}
          onCancel={() => setModal(null)}
          {...(modal.mode === 'edit'
            ? {
                onDelete: () => {
                  void handleDelete(modal.env.name).then(() => setModal(null))
                },
              }
            : {})}
        />
      )}
    </div>
  )
}

// ── Sites tab ─────────────────────────────────────────────────────────────────

/**
 * Flattens every hub's webApps into a single list and renders one SiteCard per
 * site. Localhost entries are filtered out (see isLocalhostUrl). The `key`
 * combines hub name + index so it stays stable across a hub's own edits, and a
 * cross-hub move naturally re-keys the card under its new hub.
 */
function SitesTab({ config, onUpdate }: { config: Config; onUpdate: (c: Config) => void }) {
  const sites = config.environments.flatMap((env) =>
    env.webApps
      .map((site, index) => ({ env, site, index }))
      .filter(({ site }) => !isLocalhostUrl(site.url)),
  )

  if (sites.length === 0) {
    return (
      <div className="env-list">
        <p className="empty-state">
          No sites yet. Add a site to a hub from the <strong>Content Sources</strong> tab and it
          will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="env-list">
      {sites.map(({ env, site, index }) => (
        <SiteCard
          key={`${env.name}:${index}`}
          env={env}
          site={site}
          index={index}
          environments={config.environments}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  )
}
