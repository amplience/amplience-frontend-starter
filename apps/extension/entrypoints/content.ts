// Content script stub — will implement the bridge handshake in QL-84.
// Injected only into pages matching the host_permissions in wxt.config.ts.
export default defineContentScript({
  matches: ['http://localhost:*/*', 'https://*.vercel.app/*'],
  runAt: 'document_end',
  main() {
    // Placeholder: no-op until bridge is implemented.
  },
})
