import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { client, siteName } from '../../../lib/content-client'
import { localeBasePath, localeForSlug } from '../../../lib/locales'
import { registry } from '../../../lib/registry'
import { renderContent } from '../../../src/renderer'

/**
 * Site layout — wraps every public-facing page with the header and footer.
 *
 * Header content is fetched from the CMS by delivery key so editors control
 * it without a code deploy. A fetch failure silently renders nothing rather
 * than crashing every page — site furniture should degrade gracefully.
 *
 * The layout sits under `[locale]` (ADR-0015) so the furniture localizes with
 * the page: it reads the active locale from the segment and fetches header and
 * footer at that locale, keeping nav labels in step with the body rather than
 * leaving English chrome around French content.
 *
 * Visualization routes sit outside this group and manage their own chrome;
 * this layout never runs for them.
 */
export default async function SiteLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: localeSlug } = await params
  const locale = localeForSlug(localeSlug)
  if (locale === undefined) notFound()
  const ctx = { localeBasePath: localeBasePath(locale) }
  const [headerResult, footerResult] = await Promise.allSettled([
    client.getByKey(`${siteName}/site/header`, { depth: 'all', locale: locale.delivery }),
    client.getByKey(`${siteName}/site/footer`, { depth: 'all', locale: locale.delivery }),
  ])
  const header =
    headerResult.status === 'fulfilled' ? renderContent(headerResult.value, registry, ctx) : null
  const footer =
    footerResult.status === 'fulfilled' ? renderContent(footerResult.value, registry, ctx) : null
  return (
    <>
      {header}
      <main>{children}</main>
      {footer}
    </>
  )
}
