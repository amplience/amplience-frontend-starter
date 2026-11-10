'use client'

/**
 * Schedule-preview banner (ADR-0028): what date the site is pinned to, a
 * picker to move it, and a way back to the live page.
 *
 * Moving the date asks Amplience's Virtual Staging API to re-pin the current
 * host, then does a full navigation — every server-rendered part of the page,
 * header and footer included, has to be read again from the new host.
 */
import { usePathname } from 'next/navigation'
import { useState, useSyncExternalStore, type FormEvent } from 'react'

import {
  isVseHost,
  pinnedAt,
  previewBasePath,
  splitPreviewPath,
  VIRTUAL_STAGING_API,
} from '../../lib/preview'
import styles from './PreviewBanner.module.css'

const subscribe = () => () => undefined

/** True after hydration — dates are shown in the viewer's time zone, which the server can't know. */
const useIsClient = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )

const pad = (n: number) => String(n).padStart(2, '0')

/** `YYYY-MM-DDTHH:mm` in local time — the value a datetime-local input takes. */
const toInputValue = (ms: number): string => {
  const d = new Date(ms)
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const formatInstant = (ms: number): string =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(ms)

type Props = {
  /** The validated staging host this page was rendered from. */
  readonly host: string
}

export function PreviewBanner({ host }: Props) {
  const pathname = usePathname()
  const sitePath = splitPreviewPath(pathname)?.path ?? '/'
  const pinned = pinnedAt(host)
  const isClient = useIsClient()
  const [status, setStatus] = useState<'idle' | 'busy' | 'error'>('idle')

  const repin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const raw = new FormData(event.currentTarget).get('at')
    const ms = typeof raw === 'string' && raw !== '' ? new Date(raw).getTime() : Number.NaN
    if (!Number.isFinite(ms)) {
      setStatus('error')
      return
    }
    setStatus('busy')
    try {
      const res = await fetch(`${VIRTUAL_STAGING_API}/${host}?timestamp=${String(ms)}`)
      const next = (await res.text()).trim()
      // The API answers for any input, so its output is validated like any other host.
      if (!res.ok || !isVseHost(next)) throw new Error('Virtual Staging API returned no host')
      window.location.assign(`${previewBasePath(next)}${sitePath === '/' ? '' : sitePath}`)
    } catch {
      setStatus('error')
    }
  }

  return (
    <aside className={styles.root} aria-label="Schedule preview" data-preview-banner>
      <span className={styles.badge}>Preview</span>
      <span className={styles.label} data-preview-pinned={pinned}>
        {pinned === undefined
          ? 'Showing staged content'
          : isClient
            ? `Showing the site as of ${formatInstant(pinned)}`
            : 'Showing a scheduled date'}
      </span>
      {isClient && (
        <form className={styles.form} onSubmit={(event) => void repin(event)}>
          <label className={styles.picker}>
            <span className={styles.visuallyHidden}>Preview date and time</span>
            <input
              type="datetime-local"
              name="at"
              required
              {...(pinned !== undefined && { defaultValue: toInputValue(pinned) })}
            />
          </label>
          <button type="submit" disabled={status === 'busy'}>
            {status === 'busy' ? 'Loading…' : 'Go'}
          </button>
          {status === 'error' && (
            <span role="alert" className={styles.error}>
              Couldn’t move the preview to that date.
            </span>
          )}
        </form>
      )}
      {/* A plain anchor, not next/link: leaving needs a full load of the live page. */}
      <a className={styles.exit} href={sitePath}>
        Exit preview
      </a>
    </aside>
  )
}
