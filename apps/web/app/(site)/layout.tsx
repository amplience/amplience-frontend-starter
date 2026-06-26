import type { ReactNode } from 'react'

import { client } from '../../lib/content-client'
import { registry } from '../../lib/registry'
import { renderContent } from '../../src/renderer'

/**
 * Site layout — wraps every public-facing page with the header and footer.
 *
 * Header content is fetched from the CMS by delivery key so editors control
 * it without a code deploy. A fetch failure silently renders nothing rather
 * than crashing every page — site furniture should degrade gracefully.
 *
 * Visualization routes sit outside this group and manage their own chrome;
 * this layout never runs for them.
 */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  let header: ReactNode = null
  try {
    const headerContent = await client.getByKey('site/header', { depth: 'all' })
    header = renderContent(headerContent, registry)
  } catch {
    // Header is site furniture — a fetch failure must not break the page tree.
  }
  return (
    <>
      {header}
      <main>{children}</main>
      <footer>Footer goes here</footer>
    </>
  )
}
