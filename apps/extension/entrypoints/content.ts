/**
 * Content script — Quadratic Helper preference applier.
 *
 * Runs once per full page load (document_end). Responsibilities:
 *
 *   1. Read persisted preferences from chrome.storage.local and apply them
 *      immediately — this is what makes preferences survive full refreshes.
 *
 *   2. Watch document.head with a MutationObserver so that if Next.js App
 *      Router flushes the head during a client-side navigation and removes the
 *      injected <style> tag, we re-inject it automatically.
 *
 *   3. Listen for 'ql-apply' messages from the popup so that toggling a
 *      preference in the popup takes effect instantly without a reload.
 *
 * Storage keys (shared with popup/main.ts):
 *   'ql-brand'             — string, e.g. 'default' | 'anyafinn'; absent or
 *                            'current' means "leave data-brand as the site set it"
 *   'ql-guides-containers' — boolean
 */

// ---------------------------------------------------------------------------
// Constants — must match popup/main.ts
// ---------------------------------------------------------------------------

const GUIDES_CONTAINERS_ID = 'ql-guides-containers'

const GUIDES_CONTAINERS_CSS = [
  '[class^="Container-module"] {',
  '  --ql-guide: transparent;',
  '  box-shadow: -1px 0 0 0 var(--ql-guide), 1px 0 0 0 var(--ql-guide);',
  '}',
  '[class^="Container-module"][data-max-width="narrow"]  { --ql-guide: red; }',
  '[class^="Container-module"][data-max-width="default"] { --ql-guide: orange; }',
  '[class^="Container-module"][data-max-width="wide"]    { --ql-guide: green; }',
  '[class^="Container-module"][data-max-width="none"]    { --ql-guide: blue; }',
  '[class^="Container-module"][data-gutter] {',
  '  box-shadow:',
  '    -1px 0 0 0 var(--ql-guide),',
  '     1px 0 0 0 var(--ql-guide),',
  '    inset var(--site-gutter) 0 0 0 rgb(255 0 255 / 0.12),',
  '    inset calc(-1 * var(--site-gutter)) 0 0 0 rgb(255 0 255 / 0.12);',
  '}',
].join('\n')

// ---------------------------------------------------------------------------
// Apply helpers
// ---------------------------------------------------------------------------

function applyBrand(brand: string): void {
  document.documentElement.dataset.brand = brand
}

/**
 * Restores data-brand to the value the site rendered into the HTML — called
 * when the user switches back to "Current Theme" in the popup.
 */
function resetBrand(originalBrand: string | undefined): void {
  if (originalBrand != null) {
    document.documentElement.dataset.brand = originalBrand
  } else {
    delete document.documentElement.dataset.brand
  }
}

function applyGuidesContainers(enabled: boolean): void {
  const existing = document.getElementById(GUIDES_CONTAINERS_ID)
  if (enabled && existing == null) {
    const style = document.createElement('style')
    style.id = GUIDES_CONTAINERS_ID
    style.textContent = GUIDES_CONTAINERS_CSS
    document.head.appendChild(style)
  } else if (!enabled && existing != null) {
    existing.remove()
  }
}

// ---------------------------------------------------------------------------
// MutationObserver — re-inject guide style if Next.js flushes <head>
// ---------------------------------------------------------------------------

function watchHead(getGuidesOn: () => boolean): MutationObserver {
  const observer = new MutationObserver(() => {
    if (getGuidesOn() && document.getElementById(GUIDES_CONTAINERS_ID) == null) {
      applyGuidesContainers(true)
    }
  })
  observer.observe(document.head, { childList: true })
  return observer
}

// ---------------------------------------------------------------------------
// Message listener — popup sends 'ql-apply' for immediate effect
// ---------------------------------------------------------------------------

type ApplyMessage =
  | { type: 'ql-apply'; brand: string | null } // null = reset to site's original value
  | { type: 'ql-apply'; guidesContainers: boolean }

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export default defineContentScript({
  matches: ['http://localhost:*/*', 'https://*.vercel.app/*'],
  runAt: 'document_end',

  async main() {
    // Snapshot the server-rendered data-brand before we touch anything.
    // This lets us restore it if the user later picks "Current Theme".
    const originalBrand = document.documentElement.dataset.brand

    // Read all persisted preferences in one call.
    const stored = await chrome.storage.local.get(['ql-brand', 'ql-guides-containers'])
    const brand = stored['ql-brand'] as string | undefined
    let guidesOn = (stored['ql-guides-containers'] as boolean | undefined) ?? false

    // Apply on initial load — skip if no brand stored or 'current' selected,
    // leaving data-brand exactly as the site set it.
    if (brand !== undefined && brand !== 'current') {
      applyBrand(brand)
    }
    applyGuidesContainers(guidesOn)

    // Re-inject guide style if Next.js SPA navigation removes it from <head>.
    watchHead(() => guidesOn)

    // Respond to popup changes instantly (no reload needed).
    chrome.runtime.onMessage.addListener((message: ApplyMessage) => {
      if (message.type !== 'ql-apply') return
      if ('brand' in message) {
        if (message.brand === null) {
          resetBrand(originalBrand)
        } else {
          applyBrand(message.brand)
        }
      }
      if ('guidesContainers' in message) {
        guidesOn = message.guidesContainers
        applyGuidesContainers(guidesOn)
      }
    })
  },
})
