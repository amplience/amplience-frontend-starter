// Popup entry point — placeholder until bridge handshake is implemented (QL-84).
// On open, attempts to detect whether the active tab is a Quadratic site by
// checking for the bridge marker (data-quadratic on <html>). For now, the
// content script doesn't publish the marker yet, so the pill will always show
// "not a Quadratic site".

const pillEl = document.querySelector<HTMLSpanElement>('.pill')
const pillLabel = document.querySelector<HTMLSpanElement>('#pill-label')

async function detectBridge(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (!tab.id || !tab.url) return

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.documentElement.dataset.quadratic ?? null,
    })

    const bridgeVersion = result?.result as string | null

    if (bridgeVersion != null && pillEl != null && pillLabel != null) {
      pillEl.className = 'pill pill--connected'
      pillLabel.textContent = new URL(tab.url).hostname
    }
  } catch {
    // Tab may not be injectable (e.g. chrome:// pages) — leave pill as OFF.
  }
}

detectBridge().catch(() => undefined)
