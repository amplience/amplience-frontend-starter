import { useCallback, useEffect, useState } from 'react'

import { api } from '../api.js'
import { coverageSentence } from '../organization-name.js'
import type { PublicOrganization, WorkforceOrganizations } from '../types.js'
import { personalAccessTokensUrl } from '../workforce-links.js'

const PAT_DOCS = 'https://amplience.com/developers/docs/apis/authorization/personal-access-tokens/'

type Props = {
  organizationId: string
  /**
   * The hub being set up. Passed because it is usually not saved yet, so it
   * isn't among the organization's known hubs — and on a first run it is the
   * only thing we can name the organization by.
   */
  currentHubLabel?: string
  /** That hub's name, which is what Dynamic Content's token screen is keyed by. */
  currentHubName?: string
  onClose: () => void
  /** Called once a token has been stored, so the caller can re-run its check. */
  onStored: () => void
}

/**
 * "Add Workforce access" child-card: a once-per-organization setup step, opened
 * from the Workforce row of the credentials check (ADR-0023).
 *
 * Scoped to the organization rather than the hub on purpose — a personal access
 * token covers every hub in its organization, and naming the others makes that
 * obvious rather than leaving it to be rediscovered thirteen more times.
 *
 * Creating the token is deliberately NOT offered here. `createPersonalAccessToken`
 * authenticates with a personal access token, so it cannot mint the first one —
 * a button that only works once you no longer need it is worse than no button.
 */
export function WorkforceAccessPanel({
  organizationId,
  currentHubLabel,
  currentHubName,
  onClose,
  onStored,
}: Props) {
  const [organization, setOrganization] = useState<PublicOrganization | null>(null)
  const [envOverride, setEnvOverride] = useState(false)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pick = useCallback(
    ({ organizations, envOverride: override }: WorkforceOrganizations) => {
      setOrganization(organizations.find((org) => org.id === organizationId) ?? null)
      setEnvOverride(override === true)
    },
    [organizationId],
  )

  const refresh = useCallback(async () => {
    pick(await api.workforceOrganizations())
  }, [pick])

  useEffect(() => {
    void api
      .workforceOrganizations()
      .then(pick)
      .catch(() => setError('Could not read the stored organizations'))
  }, [pick])

  async function handleSave() {
    if (token.trim() === '') return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await api.saveWorkforceToken(organizationId, token)
      setToken('')
      setReplacing(false)
      pick(result)
      setNotice(result.warning ?? null)
      onStored()
    } catch (err) {
      // The server checks the token against this organization before storing
      // it, so this is usually "wrong token" rather than "couldn't save".
      setError(err instanceof Error ? err.message : 'Could not save the token')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      pick(await api.removeWorkforceToken(organizationId))
      setReplacing(true)
      onStored()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the token')
    } finally {
      setBusy(false)
    }
  }

  async function handleRequested() {
    setBusy(true)
    setError(null)
    try {
      await api.requestWorkforceToken(organizationId)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the request')
    } finally {
      setBusy(false)
    }
  }

  const covered = organization?.hubs ?? []
  const tokensUrl = personalAccessTokensUrl(currentHubName)
  const stored = organization?.hasToken === true

  return (
    <div className="perm-panel workforce-panel">
      <div className="perm-panel__header">
        <span className="perm-panel__title">Add Workforce access</span>
        <button
          type="button"
          className="log-close"
          onClick={onClose}
          aria-label="Dismiss Workforce setup"
        >
          ✕
        </button>
      </div>

      <p className="workforce-panel__scope">
        A personal access token belongs to you and to one organization, so this is a once-per-
        organization job — not a per-hub one.{' '}
        {coverageSentence({
          ...(organization?.label !== undefined ? { label: organization.label } : {}),
          hubs: covered,
          ...(currentHubLabel !== undefined ? { currentHubLabel } : {}),
        })}{' '}
        <span className="perm-detail">{organizationId}</span>
      </p>

      {envOverride && (
        <p className="workforce-panel__waiting">
          ⚠️ <code>AMPLIENCE_PAT</code> or <code>FLOWS_CLI_TOKEN</code> is set in this shell, and an
          environment variable outranks anything stored here — so changing the token below will not
          change what the checks use until you unset it.
        </p>
      )}

      {stored && (
        <div className="workforce-panel__stored">
          <p className="workforce-panel__ok">
            ✓ A token is stored for this organization. A token inherits the permissions of whoever
            created it, so re-run the credentials check to see what it can actually do — if that
            comes back denied, the token is the thing to change.
          </p>
          <div className="workforce-panel__buttons">
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => setReplacing((was) => !was)}
              disabled={busy}
            >
              {replacing ? 'Cancel' : 'Replace token'}
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => {
                void handleRemove()
              }}
              disabled={busy}
            >
              Remove token
            </button>
          </div>
        </div>
      )}

      {(!stored || replacing) && (
        <>
          {organization?.patRequestedAt !== undefined && (
            <p className="workforce-panel__waiting">
              A token was requested on {new Date(organization.patRequestedAt).toLocaleDateString()}{' '}
              and is waiting on an organization admin. Paste it in below once it arrives.
            </p>
          )}

          <ol className="workforce-panel__steps">
            <li>
              {tokensUrl === undefined ? (
                <>
                  In Dynamic Content, go to <b>Development → Personal Access Tokens</b> and create
                  one.
                </>
              ) : (
                <>
                  Open{' '}
                  <a href={tokensUrl} target="_blank" rel="noreferrer">
                    Development → Personal Access Tokens
                  </a>{' '}
                  in Dynamic Content and create one.
                </>
              )}{' '}
              An organization admin gets it straight away; anyone else submits a request an admin
              approves.
            </li>
            <li>
              Copy the value <b>there and then</b> — it is shown once and never again.
            </li>
            <li>Paste it below.</li>
          </ol>

          <div className="workforce-panel__action workforce-panel__action--paste">
            <label htmlFor="workforce-token">
              Token{' '}
              <a href={PAT_DOCS} target="_blank" rel="noreferrer">
                How tokens work
              </a>
            </label>
            <input
              id="workforce-token"
              type="password"
              autoComplete="off"
              value={token}
              placeholder="Paste the token"
              onChange={(e) => setToken(e.target.value)}
            />
            <div className="workforce-panel__buttons">
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => {
                  void handleSave()
                }}
                disabled={busy || token.trim() === ''}
              >
                Save token
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => {
                  void handleRequested()
                }}
                disabled={busy}
              >
                I’ve requested one
              </button>
            </div>
          </div>
        </>
      )}

      {notice !== null && <p className="workforce-panel__waiting">{notice}</p>}
      {error !== null && <p className="env-card__stats-error">{error}</p>}

      <p className="perm-panel__note">
        Nothing else needs this. A hub seeds, serves content and gets a site with no Workforce
        access at all — only the flows features go quiet.
      </p>
    </div>
  )
}
