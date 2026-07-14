/**
 * Hardcoded 404 body — the last-resort fallback (QL-37).
 *
 * The editable, localized 404 lives in the CMS as the `${siteName}/site/not-found`
 * slot and is fetched by the not-found boundaries. This component is what
 * renders when that fetch can't be trusted — which is precisely the moment a
 * 404 is most likely to fire (the hub is unreachable, so fetching *more*
 * content for the 404 body would fail too). It carries no network dependency
 * and no client JavaScript, so it renders no matter what.
 *
 * It emits only the HeroBlock, not a `<main>` wrapper: the caller owns the
 * landmark. Under the localized site layout the surrounding `<main>` is already
 * provided, so wrapping here would nest `<main>` elements.
 */

import { HeroBlock } from '@amplience/quadratic-components/hero-block'

export function NotFoundContent() {
  return (
    <HeroBlock
      title="Page not found 🙈"
      subtitle="There's no content at this address — the page may have been moved, unpublished, or never existed."
      ctas={[
        {
          href: '/',
          label: 'Back to the home page',
        },
      ]}
      minHeight={600}
      verticalPosition="center"
    />
  )
}
