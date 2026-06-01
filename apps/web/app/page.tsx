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

import { Button } from '@amplience/quadratic-components/button'
import { Link } from '@amplience/quadratic-components/link'
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

export default async function HomePage() {
  const home = await client.getByKey<HomeBody>('home', { depth: 'all' })

  return (
    <main>
      <Header title={home.title}>
        <Typography>{home.description}</Typography>
      </Header>

      {/* Typography atom smoke — QL-24. Remove once Storybook lands. */}
      <Section title="Typography" aria-label="Typography scale (QL-24)">
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

        <hr />

        <Typography as="p" variant="h2">
          Variant/element decoupled: h2 style on a &lt;p&gt;
        </Typography>
      </Section>

      {/* Button atom smoke — QL-25. Remove once Storybook lands. */}
      <Section title="Buttons" background="var(--color-gray-200)">
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

        <hr />

        <Typography variant="h3">Buttons as buttons</Typography>
        <Typography>
          <em>To be added once we have client components in storybook.</em>
        </Typography>
      </Section>

      <Section title="Content tree (debug)">
        <details>
          <summary>Resolved content tree (debug)</summary>
          <pre>{JSON.stringify(home, null, 2)}</pre>
        </details>
      </Section>
    </main>
  )
}

// Temporary layout components to structure the page. These will be replaced by real atoms and molecules as those are built out.

const Section = ({
  title,
  background,
  children,
}: {
  title: string
  background?: string
  children: React.ReactNode
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--gap)',
      padding: 'var(--gutter)',
      background,
    }}
  >
    <Typography variant="h2">{title}</Typography>
    <hr />
    {children}
  </div>
)

const Header = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <header
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--gap)',
      background: 'var(--color-gray-200)',
      padding: 'var(--gutter)',
    }}
  >
    <Typography variant="h1">{title}</Typography>
    {children}
  </header>
)
