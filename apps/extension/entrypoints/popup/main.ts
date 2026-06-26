/**
 * Popup entry point.
 *
 * Reads preferences from chrome.storage.local (not the DOM), so the popup
 * reflects the persisted state rather than whatever happens to be injected in
 * the current tab right now.
 *
 * On change:
 *   1. Write the new value to storage (persists across refreshes).
 *   2. Send an 'ql-apply' message to the content script (applies instantly
 *      without a reload; the content script also re-applies on every page
 *      load, so no DOM-read fallback is needed here).
 *
 * Storage keys (shared with entrypoints/content.ts):
 *   'ql-brand'             — string
 *   'ql-guides-containers' — boolean
 */

const pillEl = document.querySelector<HTMLSpanElement>('#pill')
const pillLabel = document.querySelector<HTMLSpanElement>('#pill-label')
const brandSelect = document.querySelector<HTMLSelectElement>('#brand-select')
const guidesContainersEl = document.querySelector<HTMLInputElement>('#guides-containers')

// ---------------------------------------------------------------------------
// Tab helpers
// ---------------------------------------------------------------------------

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  return tab ?? null
}

// ---------------------------------------------------------------------------
// Connection pill — detects data-quadratic bridge marker on the active tab.
// Pill stays grey until QL-84 publishes the marker from the content script.
// ---------------------------------------------------------------------------

async function detectBridge(tabId: number, tabUrl: string): Promise<void> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.documentElement.dataset.quadratic ?? null,
    })

    const bridgeVersion = result?.result as string | null

    if (bridgeVersion != null && pillEl != null && pillLabel != null) {
      pillEl.className = 'pill pill--connected'
      pillLabel.textContent = new URL(tabUrl).hostname
    }
  } catch {
    // Tab may not be injectable (e.g. chrome:// pages) — leave pill as OFF.
  }
}

// ---------------------------------------------------------------------------
// Helpers — write to storage then message the content script
// ---------------------------------------------------------------------------

/**
 * Send a message to the content script running in `tabId`. Swallows errors
 * silently: if the content script isn't injected (e.g. non-matching origin)
 * the storage write still happened and will take effect on the next page load.
 */
async function applyNow(tabId: number, payload: Record<string, unknown>): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'ql-apply', ...payload })
  } catch {
    // Content script not present — change will apply on next full load.
  }
}

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------

async function init(): Promise<void> {
  const tab = await getActiveTab()
  if (!tab?.id || !tab.url) return

  const { id: tabId, url: tabUrl } = tab

  // Read persisted preferences and detect bridge in parallel.
  const [, stored] = await Promise.all([
    detectBridge(tabId, tabUrl),
    chrome.storage.local.get(['ql-brand', 'ql-guides-containers']),
  ])

  // No stored brand means "leave the site alone" — represented in the UI as 'current'.
  const currentBrand = (stored['ql-brand'] as string | undefined) ?? 'current'
  const guidesContainersOn = (stored['ql-guides-containers'] as boolean | undefined) ?? false

  if (brandSelect != null) {
    brandSelect.value = currentBrand

    brandSelect.addEventListener('change', () => {
      const brand = brandSelect.value
      if (brand === 'current') {
        // Remove the preference entirely — content script will restore the
        // site's original data-brand on next load; do it instantly now.
        void chrome.storage.local.remove('ql-brand')
        void applyNow(tabId, { brand: null })
      } else {
        void chrome.storage.local.set({ 'ql-brand': brand })
        void applyNow(tabId, { brand })
      }
    })
  }

  if (guidesContainersEl != null) {
    guidesContainersEl.checked = guidesContainersOn

    guidesContainersEl.addEventListener('change', () => {
      const guidesContainers = guidesContainersEl.checked
      void chrome.storage.local.set({ 'ql-guides-containers': guidesContainers })
      void applyNow(tabId, { guidesContainers })
    })
  }
}

init().catch(() => undefined)
