import { useCallback, useEffect, useState } from 'react'

import { api } from './api.js'
import { EnvironmentCard } from './components/EnvironmentCard.js'
import { EnvironmentForm } from './components/EnvironmentForm.js'
import { FixturesCard } from './components/FixturesCard.js'
import type { Config, Environment } from './types.js'
import { FIXTURES_NAME } from './types.js'

type Modal = { mode: 'add' } | { mode: 'edit'; env: Environment } | null

export function App() {
  const [config, setConfig] = useState<Config | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

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
          <button className="btn btn--primary btn--add" onClick={() => setModal({ mode: 'add' })}>
            + Add hub
          </button>
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
            {/* TAB BUTTONS GO HERE */}
            {/* CONTENT SOURCES | SITES */}
            {/* Content Source List (visible when CONTENT SOURCES tab is active) */}
            <div className="env-list">
              <h3 className="env-list__title">Fixtures</h3>
              <FixturesCard
                isActive={config.active === FIXTURES_NAME}
                onActivate={() => {
                  void handleActivate(FIXTURES_NAME)
                }}
              />
              <h3 className="env-list__title">Hubs</h3>
              {config.environments.map((env) => (
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
            </div>
            {/* Site list goes here (visible when SITES tab is active) */}
            <div className="env-list">
              {/* This gets data from the same JSON configuration but focusses on listing all the "sites" (WebApps) as a top-level flat list */}
              {/* Each site has a card which shows the site details and the hub it's drawing content from. The card has a button to "View hub" which switches the view back to the hub list and opens the hub's card. */}
              {/* You can edit the site's config (ie the brand, site URL and site name) and it will update the values in the JSON config */}
              {/* If the user wants to switch which hub the site points to then that will move the site from being a child of one hub to a child of a different hub in the JSON data. */}
            </div>
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
