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
  const [headerResult, footerResult] = await Promise.allSettled([
    client.getByKey('site/header', { depth: 'all' }),
    client.getByKey('site/footer', { depth: 'all' }),
  ])
  const header =
    headerResult.status === 'fulfilled' ? renderContent(headerResult.value, registry) : null
  const footer =
    footerResult.status === 'fulfilled' ? renderContent(footerResult.value, registry) : null
  return (
    <>
      {header}
      <main>{children}</main>
      {footer}
    </>
  )
}
