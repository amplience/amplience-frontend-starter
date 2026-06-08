/**
 * Fires all webhooks listed in KEEPALIVE_WEBHOOK_URLS (comma-separated) in
 * parallel, then reports results and exits non-zero if any failed.
 *
 * Used by the algolia-keep-alive GitHub Actions workflow to prevent demo
 * Algolia accounts from being suspended due to inactivity on their linked
 * demo sites.
 *
 * Set KEEPALIVE_WEBHOOK_URLS as a GitHub Actions secret (comma-separated list
 * of POST webhook URLs). Adding a new demo account = append its URL to the
 * secret; no code change required.
 */

export {}

const raw = process.env.KEEPALIVE_WEBHOOK_URLS ?? ''
const urls = raw
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean)

if (urls.length === 0) {
  console.error(
    'Error: KEEPALIVE_WEBHOOK_URLS is not set or empty.\n' +
      'Set it as a comma-separated list of webhook URLs.',
  )
  process.exit(1)
}

console.log(`Firing ${urls.length} keep-alive webhook(s)…\n`)

const results = await Promise.allSettled(
  urls.map(async (url) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
    return url
  }),
)

let failed = 0
for (const result of results) {
  if (result.status === 'fulfilled') {
    console.log(`  ✓  ${result.value}`)
  } else {
    const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
    console.error(`  ✗  ${message}`)
    failed++
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${urls.length} webhook(s) failed.`)
  process.exit(1)
}

console.log('\nAll webhooks fired successfully.')
