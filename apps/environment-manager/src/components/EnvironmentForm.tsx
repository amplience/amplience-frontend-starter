import { useEffect, useRef, useState } from 'react'

import type { Environment } from '../types.js'
import { EMPTY_ENV } from '../types.js'

type Props = {
  initial?: Environment
  onSave: (env: Environment) => Promise<void>
  onCancel: () => void
  onDelete?: () => void
}

type Field = keyof Environment

const TEXT_FIELDS: { key: Field; label: string; required?: boolean; placeholder?: string }[] = [
  { key: 'label', label: 'Label', required: true, placeholder: 'e.g. Client A — Staging' },
  {
    key: 'name',
    label: 'Identifier',
    required: true,
    placeholder: 'e.g. client-a-staging (no spaces)',
  },
  { key: 'hubName', label: 'Hub name', required: true, placeholder: 'e.g. quadraticlite' },
  { key: 'hubId', label: 'Hub ID', required: true, placeholder: 'dc-cli hub ID' },
  { key: 'appUrl', label: 'App URL', required: true, placeholder: 'https://...' },
  { key: 'repoContent', label: 'Content repo ID', required: true, placeholder: 'DC repository ID' },
  { key: 'repoSlots', label: 'Slots repo ID', required: true, placeholder: 'DC repository ID' },
  { key: 'clientId', label: 'Client ID', placeholder: 'Leave blank to use dc-cli credentials' },
  {
    key: 'clientSecret',
    label: 'Client secret',
    placeholder: 'Leave blank to use dc-cli credentials',
  },
  {
    key: 'stagingHost',
    label: 'Staging host (VSE)',
    placeholder: 'Optional — enables staging preview',
  },
]

export function EnvironmentForm({ initial, onSave, onCancel, onDelete }: Props) {
  const isEdit = initial !== undefined
  const [form, setForm] = useState<Environment>(initial ?? EMPTY_ENV)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  // Auto-focus first editable field
  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saving, onCancel])

  function set(key: Field, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal__header">
          <h2>{isEdit ? 'Edit hub' : 'Add hub'}</h2>
          <button
            type="button"
            className="modal__close"
            onClick={onCancel}
            disabled={saving}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
          noValidate
        >
          <div className="form-fields">
            {TEXT_FIELDS.map(({ key, label, required, placeholder }, idx) => (
              <div className="field" key={key}>
                <label htmlFor={key}>
                  {label}
                  {required && <span className="required">*</span>}
                </label>
                <input
                  ref={idx === 0 ? firstFieldRef : undefined}
                  id={key}
                  type={key === 'clientSecret' ? 'password' : 'text'}
                  value={String(form[key])}
                  placeholder={placeholder}
                  required={required}
                  autoComplete="off"
                  onChange={(e) => set(key, e.target.value)}
                  disabled={isEdit && key === 'name'}
                />
                {isEdit && key === 'name' && (
                  <p className="hint">Identifier cannot be changed after creation.</p>
                )}
              </div>
            ))}

            <div className="field field--checkbox">
              <label htmlFor="republish">
                <input
                  id="republish"
                  type="checkbox"
                  checked={form.republish}
                  onChange={(e) => set('republish', e.target.checked)}
                />
                Force republish on import (--republish)
              </label>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add hub'}
            </button>
          </div>
        </form>

        {isEdit && onDelete !== undefined && (
          <div className="form-danger-zone">
            <p className="form-danger-zone__label">Danger zone</p>
            <button
              type="button"
              className="btn btn--danger"
              disabled={saving}
              onClick={() => {
                if (
                  confirm(
                    `Permanently delete "${initial?.name ?? 'this environment'}"? This cannot be undone.`,
                  )
                ) {
                  onDelete()
                }
              }}
            >
              Delete environment
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
