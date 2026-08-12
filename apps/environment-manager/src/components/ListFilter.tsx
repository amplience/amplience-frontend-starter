import { useEffect, useId, useState } from 'react'

/**
 * Delay before the result count is announced. Filtering itself is instant — it's
 * an in-memory array — but announcing on every keystroke would give a screen
 * reader a burst of partial counts instead of one useful answer.
 */
const ANNOUNCE_DEBOUNCE_MS = 400

const SearchIcon = () => (
  <svg aria-hidden="true" width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
    <path d="M6.5 0a6.5 6.5 0 0 1 5.06 10.59l4.15 4.15-1.41 1.41-4.15-4.15A6.5 6.5 0 1 1 6.5 0zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z" />
  </svg>
)

/** Returns `value` once it has stopped changing for `delayMs`. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

type Props = {
  /** Accessible name for the input; visually hidden. */
  label: string
  placeholder: string
  /** Plural noun for the count and announcement, e.g. 'hubs'. */
  noun: string
  value: string
  onChange: (next: string) => void
  resultCount: number
  totalCount: number
}

/** Filter input for a titled list section. */
export function ListFilter({
  label,
  placeholder,
  noun,
  value,
  onChange,
  resultCount,
  totalCount,
}: Props) {
  const inputId = useId()
  const isFiltering = value.trim() !== ''

  // Announce only while filtering, so clearing the box goes quiet rather than
  // reporting the full count back.
  const announcement = useDebouncedValue(
    isFiltering ? `${resultCount} of ${totalCount} ${noun} match` : '',
    ANNOUNCE_DEBOUNCE_MS,
  )

  return (
    <div className="list-filter">
      <label className="visually-hidden" htmlFor={inputId}>
        {label}
      </label>

      {/* The visible count updates immediately; the announcement below is the
          debounced one, so it's hidden from assistive tech to avoid a double read. */}
      {isFiltering && (
        <span className="list-filter__count" aria-hidden="true">
          Showing {resultCount} of {totalCount}
        </span>
      )}

      <div className="list-filter__field">
        <span className="list-filter__icon">
          <SearchIcon />
        </span>
        <input
          id={inputId}
          className="list-filter__input"
          type="search"
          placeholder={placeholder}
          value={value}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onChange('')
          }}
        />
        {value !== '' && (
          <button
            type="button"
            className="btn--icon-only list-filter__clear"
            onClick={() => onChange('')}
            aria-label={`Clear ${noun} filter`}
            title="Clear filter"
          >
            ✕
          </button>
        )}
      </div>

      <span className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}
