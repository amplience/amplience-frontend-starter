// Popup entry point.

const pillEl = document.querySelector<HTMLSpanElement>('#pill')
const pillLabel = document.querySelector<HTMLSpanElement>('#pill-label')
const brandSelect = document.querySelector<HTMLSelectElement>('#brand-select')

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
// INTERIM: Brand switcher — direct DOM manipulation via executeScript.
// No bridge required: reads/writes data-brand on <html> directly.
// Replace with bridge brand:set command once QL-84 handshake is in place.
// ---------------------------------------------------------------------------

async function readBrand(tabId: number): Promise<string> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.documentElement.dataset.brand ?? 'default',
    })
    return (result?.result as string | null) ?? 'default'
  } catch {
    return 'default'
  }
}

async function setBrand(tabId: number, brand: string): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (b: string) => {
      document.documentElement.dataset.brand = b
    },
    args: [brand],
  })
}

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------

async function init(): Promise<void> {
  const tab = await getActiveTab()
  if (!tab?.id || !tab.url) return

  const { id: tabId, url: tabUrl } = tab

  // Run bridge detection and brand read in parallel.
  const [, currentBrand] = await Promise.all([detectBridge(tabId, tabUrl), readBrand(tabId)])

  if (brandSelect != null) {
    brandSelect.value = currentBrand

    brandSelect.addEventListener('change', () => {
      void setBrand(tabId, brandSelect.value)
    })
  }
}

init().catch(() => undefined)
