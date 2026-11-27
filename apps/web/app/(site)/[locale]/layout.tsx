import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { addChildCategories } from '../../../lib/child-categories'
import { client, siteName } from '../../../lib/content-client'
import { localeForSlug } from '../../../lib/locales'
import { getPreviewHost, siteBasePath } from '../../../lib/preview-request'
import { registry } from '../../../lib/registry'
import { resolveLinks } from '../../../lib/resolve-links'
import { PreviewBanner } from '../../../src/components/PreviewBanner'
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
  const previewHost = await getPreviewHost()
  const fetchChrome = async (key: string) =>
    addChildCategories(
      await client.getByKey(`${siteName}/site/${key}`, { depth: 'all', locale: locale.delivery }),
      locale,
    )
  const [headerResult, footerResult] = await Promise.allSettled([
    fetchChrome('header'),
    fetchChrome('footer'),
  ])
  const fetched = [headerResult, footerResult].flatMap((r) =>
    r.status === 'fulfilled' ? [r.value] : [],
  )
  const ctx = {
    localeBasePath: await siteBasePath(locale),
    locale: locale.code,
    links: await resolveLinks(fetched, locale),
  }
  const header =
    headerResult.status === 'fulfilled' ? renderContent(headerResult.value, registry, ctx) : null
  const footer =
    footerResult.status === 'fulfilled' ? renderContent(footerResult.value, registry, ctx) : null
  return (
    <>
      {previewHost !== undefined && <PreviewBanner host={previewHost} />}
      {header}
      <main>{children}</main>
      {footer}
    </>
  )
}
