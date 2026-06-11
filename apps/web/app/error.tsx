'use client'

/**
 * Last-resort error boundary (QL-37). Known content failures never reach
 * this — they're caught server-side and rendered as ContentUnavailable
 * cards — so landing here means something genuinely unexpected threw during
 * render. Next requires error boundaries to be Client Components, so this
 * file is the one deliberate `'use client'` in the failure surface; it uses
 * plain elements + theme tokens rather than the component library to keep
 * the client bundle minimal and to depend on as little as possible while in
 * a broken state.
 */
import { useEffect } from 'react'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Console only — Next redacts server error details into `digest` in
    // production, so nothing sensitive is exposed here.
    console.error('[renderer] UnexpectedError', error)
  }, [error])

  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: 'var(--site-gutter, 1rem)',
      }}
    >
      <section
        role="alert"
        style={{
          maxWidth: '36rem',
          background: 'var(--color-gray-100)',
          border: 'solid 1px var(--color-gray-400)',
          borderLeft: 'solid 4px var(--color-error, #b3261e)',
          borderRadius: 'var(--radius)',
          padding: 'var(--gap)',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Something went wrong</h1>
        <p style={{ color: 'var(--color-gray-600)' }}>
          An unexpected error stopped this page from rendering. It has been logged.
          {error.digest === undefined ? '' : ` Reference: ${error.digest}`}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            background: 'var(--color-primary, #7340e7)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius)',
            padding: 'calc(var(--gap) / 2) var(--gap)',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </section>
    </main>
  )
}
