/**
 * Home page — POC wiring (QL-23).
 *
 * Server Component that fetches the home content via the mock ContentClient
 * and renders it in the simplest possible way. The actual recursive
 * renderer (ADR-0010 / QL-17) is a separate ticket; this page just proves
 * content flows from the port through to the DOM.
 *
 * When the SDK adapter lands (QL-43), the only change here is the import
 * line — the port surface stays identical.
 */

import { Fragment } from 'react'

import { Button } from '@amplience/quadratic-components/button'
import { Container } from '@amplience/quadratic-components/container'
import { Divider } from '@amplience/quadratic-components/divider'
import { Icon, ICON_NAMES } from '@amplience/quadratic-components/icon'
import { Image } from '@amplience/quadratic-components/image'
import { Link } from '@amplience/quadratic-components/link'
import { Placeholder } from '@amplience/quadratic-components/placeholder'
import { Stack } from '@amplience/quadratic-components/stack'
import { Typography } from '@amplience/quadratic-components/typography'
import { makeMockContentClient } from '@amplience/quadratic-content/mock'

type HomeBody = {
  title: string
  description: string
}

const client = makeMockContentClient()

// Temporary button mapping (This will move to Storybook when that's up and running)
// At that point, page.tsx will be a simple composer file.
const BUTTONVARIANTS = ['text', 'solid', 'outlined'] as const
const BUTTONCOLORS = ['primary', 'secondary', 'black', 'white'] as const
const ALL_ICON_NAMES = Array.from(ICON_NAMES as ArrayLike<unknown>, (name) => String(name))

export default async function HomePage() {
  const home = await client.getByKey<HomeBody>('home', { depth: 'all' })

  return (
    <main>
      {/* Page header */}
      <header style={{ background: 'var(--color-gray-200)', padding: 'var(--site-gutter) 0' }}>
        <Container gutter>
          <Stack>
            <Typography variant="h1">{home.title}</Typography>
            <Typography>{home.description}</Typography>
          </Stack>
        </Container>
      </header>

      {/* Typography atom smoke — QL-24. Remove once Storybook lands. */}
      <section aria-label="Typography scale (QL-24)" style={{ padding: 'var(--site-gutter) 0' }}>
        <Container gutter>
          <Stack>
            <Typography variant="h2">Typography</Typography>
            <Divider />
            <Typography variant="h1">Heading 1</Typography>
            <Typography variant="h2">Heading 2</Typography>
            <Typography variant="h3">Heading 3</Typography>
            <Typography variant="h4">Heading 4</Typography>
            <Typography variant="h5">Heading 5</Typography>
            <Typography variant="h6">Heading 6</Typography>
            <Typography variant="p">
              Body — the quick brown fox <em>jumps</em> over the <strong>lazy</strong> dog, with an{' '}
              <Link href="/docs">internal link</Link> and an{' '}
              <Link href="https://example.com">external link</Link>.
            </Typography>
            <Typography variant="caption" as="p">
              Caption — supplementary text at small size.
            </Typography>
            <Divider />
            <Typography as="p" variant="h2">
              Variant/element decoupled: h2 style on a &lt;p&gt;
            </Typography>
          </Stack>
        </Container>
      </section>

      {/* Button atom smoke — QL-25. Remove once Storybook lands. */}
      <section style={{ background: 'var(--color-gray-200)', padding: 'var(--site-gutter) 0' }}>
        <Container gutter>
          <Stack>
            <Typography variant="h2">Buttons</Typography>
            <Divider />
            <Typography variant="h3">Buttons as links</Typography>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${BUTTONVARIANTS.length}, auto)`,
                gap: 'calc(var(--spacing) * 4)',
              }}
            >
              {BUTTONVARIANTS.map((variant) => (
                <div
                  key={variant}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'subgrid',
                    gap: 'calc(var(--spacing) * 4)',
                    marginBottom: '1rem',
                  }}
                >
                  {BUTTONCOLORS.map((color) => (
                    <Button key={`${variant}-${color}`} variant={variant} color={color} href="#">
                      {`${variant} ${color}`}
                    </Button>
                  ))}
                </div>
              ))}
            </div>
            <Divider />
            <Typography variant="h3">Buttons as buttons</Typography>
            <Typography>
              <em>To be added once we have client components in Storybook.</em>
            </Typography>
          </Stack>
        </Container>
      </section>

      {/* Container variants smoke — QL-27. Remove once Storybook lands. */}
      <section style={{ padding: 'var(--site-gutter) 0' }}>
        <Container gutter>
          <Stack>
            <Typography variant="h2">Containers</Typography>
            <Divider />
          </Stack>
        </Container>
        <Stack style={{ marginTop: 'var(--gap)' }}>
          {(['narrow', 'default', 'wide', 'full'] as const).map((maxWidth) => (
            <Fragment key={maxWidth}>
              <Container maxWidth={maxWidth} gutter>
                <Placeholder text={`maxWidth="${maxWidth}" with gutter`} />
              </Container>
              <Container maxWidth={maxWidth}>
                <Placeholder text={`maxWidth="${maxWidth}" with no gutter`} />
              </Container>
            </Fragment>
          ))}
        </Stack>
      </section>

      {/* Divider variants smoke — QL-27. Remove once Storybook lands. */}
      <section style={{ background: 'var(--color-gray-200)', padding: 'var(--site-gutter) 0' }}>
        <Container gutter>
          <Stack>
            <Typography variant="h2">Dividers</Typography>
            <Divider />
            <Typography variant="h3">Horizontal (default)</Typography>
            <Divider />
            <Typography variant="h3">Vertical (inside a row Stack)</Typography>
            <Stack direction="row" gap="md" style={{ height: 48, alignItems: 'center' }}>
              <Typography>Left</Typography>
              <Divider orientation="vertical" />
              <Typography>Right</Typography>
            </Stack>
          </Stack>
        </Container>
      </section>

      {/* Stack variants smoke — QL-27. Remove once Storybook lands. */}
      <section style={{ padding: 'var(--site-gutter) 0' }}>
        <Container gutter>
          <Stack>
            <Typography variant="h2">Stacks</Typography>
            <Divider />
            <Typography variant="h3">Column (default) — gap scale</Typography>
            {(['none', 'xs', 'sm', 'md', 'lg', 'xl'] as const).map((gap) => (
              <div key={gap}>
                <Typography variant="caption" as="p">
                  <code>gap=&quot;{gap}&quot;</code>
                </Typography>
                <Stack gap={gap}>
                  <Placeholder />
                  <Placeholder />
                  <Placeholder />
                </Stack>
              </div>
            ))}
            <Divider />
            <Typography variant="h3">Row — gap md</Typography>
            <Stack direction="row" gap="md">
              <Placeholder />
              <Placeholder />
              <Placeholder />
            </Stack>
          </Stack>
        </Container>
      </section>

      {/* Image atom smoke — QL-26. Remove once Storybook lands. */}
      <section style={{ background: 'var(--color-gray-200)', padding: 'var(--site-gutter) 0' }}>
        <Container gutter>
          <Stack>
            <Typography variant="h2">Images</Typography>
            <Divider />

            <Typography variant="h3">Default (intrinsic ratio)</Typography>
            <Typography variant="caption" as="p">
              No <code>aspectRatio</code> prop — height follows the intrinsic dimensions.
            </Typography>
            <div style={{ maxWidth: 480 }}>
              <Image
                src="https://picsum.photos/seed/ql26a/800/400"
                alt="A placeholder landscape image"
                width={800}
                height={400}
                unoptimized
              />
            </div>

            <Divider />
            <Typography variant="h3">With aspectRatio override</Typography>
            <Typography variant="caption" as="p">
              <code>aspectRatio=&quot;1 / 1&quot;</code> — same image, cropped square via{' '}
              <code>object-fit: cover</code>. Width is fluid; the CSS variable controls the ratio.
            </Typography>
            <div style={{ maxWidth: 320 }}>
              <Image
                src="https://picsum.photos/seed/ql26a/800/400"
                alt="The same image cropped to a square"
                width={800}
                height={400}
                aspectRatio="1 / 1"
                unoptimized
              />
            </div>

            <Divider />
            <Typography variant="h3">16 / 9 ratio</Typography>
            <div style={{ maxWidth: 480 }}>
              <Image
                src="https://picsum.photos/seed/ql26b/1200/800"
                alt="A placeholder portrait image cropped to 16:9"
                width={1200}
                height={800}
                aspectRatio="16 / 9"
                unoptimized
              />
            </div>
          </Stack>
        </Container>
      </section>

      {/* Icon atom smoke — QL-26. Remove once Storybook lands. */}
      <section style={{ padding: 'var(--site-gutter) 0' }}>
        <Container gutter>
          <Stack>
            <Typography variant="h2">Icons</Typography>
            <Divider />

            <Typography variant="h3">Decorative (no label, inherits colour)</Typography>
            <Stack direction="row" gap="md" wrap style={{ alignItems: 'center' }}>
              {ALL_ICON_NAMES.map((name) => (
                <Icon key={name} name={name as never} />
              ))}
            </Stack>

            <Divider />
            <Typography variant="h3">Named colours</Typography>
            <Stack direction="row" gap="md" wrap style={{ alignItems: 'center' }}>
              <Icon name="star" color="primary" label="Primary colour" />
              <Icon name="star" color="secondary" label="Secondary colour" />
              <Icon name="star" color="black" label="Black" />
              <span
                style={{
                  background: 'var(--color-black)',
                  padding: '4px 8px',
                  display: 'inline-flex',
                  borderRadius: 4,
                }}
              >
                <Icon name="star" color="white" label="White (on dark background)" />
              </span>
            </Stack>

            <Divider />
            <Typography variant="h3">Size — inherits from surrounding text (default)</Typography>
            <Typography variant="caption" as="p">
              No <code>size</code> prop. Icon scales with the font-size of its context.
            </Typography>
            <Stack direction="row" gap="md" wrap style={{ alignItems: 'baseline' }}>
              <Typography variant="h1">
                <Icon name="star" /> h1
              </Typography>
              <Typography variant="h3">
                <Icon name="star" /> h3
              </Typography>
              <Typography variant="p">
                <Icon name="star" /> body
              </Typography>
              <Typography variant="caption" as="p">
                <Icon name="star" /> caption
              </Typography>
            </Stack>

            <Divider />
            <Typography variant="h3">Size — explicit</Typography>
            <Stack direction="row" gap="md" wrap style={{ alignItems: 'center' }}>
              {([12, 16, 20, 24, 32, 48] as const).map((size) => (
                <div key={size} style={{ textAlign: 'center' }}>
                  <Icon name="star" size={size} label={`${size}px star`} />
                  <Typography variant="caption" as="p">
                    {size}px
                  </Typography>
                </div>
              ))}
            </Stack>

            <Divider />
            <Typography variant="h3">Inline with text</Typography>
            <Typography variant="p">
              <Icon name="check-circle" color="success" /> Your order has been confirmed
            </Typography>
            <Typography variant="p">
              <Icon name="alert-circle" color="warning" /> Please review before continuing
            </Typography>
            <Button href="#">
              Continue <Icon name="chevron-right" />
            </Button>
          </Stack>
        </Container>
      </section>

      {/* Content tree debug */}
      <section style={{ background: 'var(--color-gray-200)', padding: 'var(--site-gutter) 0' }}>
        <Container gutter>
          <Stack>
            <Typography variant="h2">Content tree (debug)</Typography>
            <Divider />
            <details>
              <summary>Resolved content tree</summary>
              <pre>{JSON.stringify(home, null, 2)}</pre>
            </details>
          </Stack>
        </Container>
      </section>
    </main>
  )
}
