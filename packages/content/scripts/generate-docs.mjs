/**
 * docs:generate — turn the repo's Markdown docs into fixture content.
 *
 * WHY
 *   The `.md` files under `docs/` are the single source of truth for
 *   documentation. They serve GitHub readers directly; this script projects the
 *   same files onto the demo site's `/docs` pages (and, via `hub:import`, onto
 *   any seeded hub) so the docs never drift between the repo and the site.
 *
 * WHAT IT DOES
 *   For every `docs/**\/*.md` file it derives a page from the file itself — no
 *   front-matter required (that's a deliberate first-cut simplification; see the
 *   design note). Everything is programmatic:
 *
 *     slug        ← file path relative to the repo (index/README ⇒ the folder)
 *     title       ← the document's first H1                  (page <title> + hero)
 *     description ← the paragraph following that first H1    (SEO + hero)
 *     body        ← the rest of the document                 (markdown-block)
 *     hero CTAs   ← ← parent doc (outlined/white) + each child doc (solid/primary)
 *
 *   It emits the standard page → slot → [hero, markdown-block] fixture quartet
 *   per doc, with deterministic IDs (stable across runs, so diffs stay clean),
 *   then writes `src/mock/docs.generated.ts` — the static-import manifest the
 *   mock loader spreads in (the loader can't scan disk; it must import).
 *
 * IDEMPOTENT
 *   Re-running produces byte-identical output for unchanged docs. CI runs this
 *   then fails on any diff, so generated fixtures can't fall behind their source.
 *
 * USAGE
 *   node packages/content/scripts/generate-docs.mjs        (or: pnpm docs:generate)
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../../..')
const docsDir = path.join(repoRoot, 'docs')
const fixturesBase = path.join(repoRoot, 'packages/content/fixtures/base-site')
const generatedTsPath = path.join(repoRoot, 'packages/content/src/mock/docs.generated.ts')

// Schema URIs (mirror the hand-authored fixtures exactly).
const SCHEMA = {
  page: 'https://quadratic.amplience.com/v2/content/page',
  slot: 'https://quadratic.amplience.com/v2/slots/slot',
  hero: 'https://quadratic.amplience.com/v2/content/hero',
  markdown: 'https://quadratic.amplience.com/v2/content/markdown-block',
  contentLink: 'http://bigcontent.io/cms/schema/v1/core#/definitions/content-link',
  localizedValue: 'http://bigcontent.io/cms/schema/v1/core#/definitions/localized-value',
}

// Locales emitted for localized fields. First is the default; the Delivery API
// wildcard fallback (ADR-0015) covers any locale not listed. Docs are authored
// in English only for now, so both entries carry the same value.
const LOCALES = ['en-US', 'en-GB']

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Deterministic UUID (v5-shaped) from a seed — stable IDs across runs. */
const uuidFrom = (seed) => {
  const h = createHash('sha1').update(seed).digest('hex').slice(0, 32).split('')
  h[12] = '5' // version nibble
  h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) // variant bits
  const s = h.join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`
}

/** A localized-value field carrying the same value across the emitted locales. */
const localized = (value) => ({
  values: LOCALES.map((locale) => ({ locale, value })),
  _meta: { schema: SCHEMA.localizedValue },
})

/** A content-link stub referencing another item by id. */
const link = (id, contentType) => ({ id, contentType, _meta: { schema: SCHEMA.contentLink } })

/** camelCase JS identifier from a slug + role, for the generated import names. */
const identFrom = (slug, role) => {
  const camel = slug
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .split(/\s+/)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('')
  return camel + role[0].toUpperCase() + role.slice(1)
}

/** Title-case a slug segment as a last-resort title when a doc has no H1. */
const humanize = (segment) =>
  segment.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// ---------------------------------------------------------------------------
// Discovery + parsing
// ---------------------------------------------------------------------------

/** All `.md` files under docs/, as repo-relative POSIX paths. */
const findMarkdown = (dir) => {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...findMarkdown(abs))
    else if (entry.isFile() && entry.name.endsWith('.md'))
      out.push(path.relative(repoRoot, abs).split(path.sep).join('/'))
  }
  return out
}

/** Slug for a repo-relative md path. index.md / README.md collapse to the folder. */
const slugForPath = (relPath) => {
  let s = relPath.replace(/\.md$/i, '')
  s = s.replace(/\/(index|README)$/i, '')
  return s
}

/**
 * Split a document into title / description / body.
 *   title       — text of the first H1 (`# ...`)
 *   description — the first non-empty paragraph after that H1 (blank if the next
 *                 block is a heading, i.e. no intro prose)
 *   body        — everything else, with the H1 and the intro paragraph removed
 *                 so they aren't duplicated (the hero already shows them)
 */
const parseDoc = (raw, fallbackTitle) => {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const h1Index = lines.findIndex((l) => /^#\s+/.test(l))

  if (h1Index === -1) {
    return { title: fallbackTitle, description: '', body: raw.trim() }
  }

  const title = lines[h1Index].replace(/^#\s+/, '').trim()

  // Walk past blank lines to the first content block after the H1.
  let i = h1Index + 1
  while (i < lines.length && lines[i].trim() === '') i++

  let description = ''
  const bodyLines = lines.slice(0, h1Index) // keep anything above the H1 (rare)

  const startsHeading = i < lines.length && /^#{1,6}\s+/.test(lines[i])
  if (i < lines.length && !startsHeading) {
    // Consume the intro paragraph (until the next blank line) as the description.
    const para = []
    while (i < lines.length && lines[i].trim() !== '') {
      para.push(lines[i].trim())
      i++
    }
    description = para.join(' ')
  }

  // Remaining lines (after the consumed intro) form the body.
  while (i < lines.length && lines[i].trim() === '') i++
  bodyLines.push(...lines.slice(i))

  return { title, description, body: bodyLines.join('\n').trim() }
}

/**
 * Rewrite relative `*.md` links to site paths. A link resolving to another
 * generated doc becomes `/<slug>` (+ any `#anchor`); links that resolve outside
 * the docs set, or are absolute/anchor-only, are left untouched.
 */
const rewriteLinks = (body, relPath, slugSet) => {
  const fileDir = path.posix.dirname(relPath)
  return body.replace(/\]\(([^)]+)\)/g, (whole, target) => {
    if (/^(https?:|mailto:|#|\/)/i.test(target)) return whole // absolute / anchor / already-rooted
    const [rawPath, anchor] = target.split('#')
    if (!/\.md$/i.test(rawPath)) return whole
    const resolved = path.posix.normalize(path.posix.join(fileDir, rawPath))
    const slug = slugForPath(resolved)
    if (!slugSet.has(slug)) return whole // outside the docs set — leave as-is
    return `](/${slug}${anchor ? `#${anchor}` : ''})`
  })
}

// GitHub "alert" blockquotes (`> [!NOTE]`, `> [!TIP]`, …) are a GitHub-only
// extension, not GFM — react-markdown would render the literal `[!NOTE]` text.
// Swap the marker for an emoji so the intent survives on the site while the
// source stays GitHub-friendly.
const ALERT_EMOJI = {
  NOTE: 'ℹ️',
  TIP: '💡',
  IMPORTANT: '❗',
  WARNING: '⚠️',
  CAUTION: '🛑',
}

/** Replace `> [!TYPE]` alert markers with an emoji-prefixed blockquote. */
const swapGitHubAlerts = (md) =>
  md.replace(
    /^([ \t]*>[ \t]*)\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/gim,
    (_whole, prefix, type) => `${prefix}${ALERT_EMOJI[type.toUpperCase()]}`,
  )

// ---------------------------------------------------------------------------
// Build the doc model
// ---------------------------------------------------------------------------

if (!existsSync(docsDir)) {
  console.error(`docs:generate — no docs/ directory at ${docsDir}`)
  process.exit(1)
}

const relPaths = findMarkdown(docsDir).sort()

// First pass: parse every doc so we know the full slug set (for link rewriting
// and parent/child CTA wiring).
const docs = relPaths.map((relPath) => {
  const slug = slugForPath(relPath)
  const fallback = humanize(slug.split('/').pop() || slug)
  const parsed = parseDoc(readFileSync(path.join(repoRoot, relPath), 'utf8'), fallback)
  return { relPath, slug, ...parsed }
})

const slugSet = new Set(docs.map((d) => d.slug))
const bySlug = new Map(docs.map((d) => [d.slug, d]))

// The root /docs page is composed (design decision B): the soft, purpose-driven
// intro from docs/index.md, then the repo README appended beneath it with its
// own title + strapline stripped. parseDoc() removes the first H1 and the intro
// paragraph, which is exactly the README title + strapline — so getting-started
// / technical detail lives in exactly one place (README) and is never
// duplicated. README sits outside docs/, so this is the one deliberate
// cross-file compose.
const ROOT_SLUG = 'docs'
const readmePath = path.join(repoRoot, 'README.md')
const readmeBody = existsSync(readmePath)
  ? parseDoc(readFileSync(readmePath, 'utf8'), 'README').body
  : ''

/** Immediate children of a slug (one path segment deeper). */
const childrenOf = (slug) =>
  docs
    .filter((d) => d.slug !== slug && path.posix.dirname(d.slug) === slug)
    .sort((a, b) => a.slug.localeCompare(b.slug))

/**
 * Parent CTA target for a slug. Walks up the path to the nearest ancestor that
 * is itself a doc (so a page nested under a folder with no index.md still gets a
 * way back), falling back to home. Every page therefore has a back-link.
 */
const parentCtaFor = (slug) => {
  const segs = slug.split('/')
  for (let i = segs.length - 1; i > 0; i--) {
    const ancestor = segs.slice(0, i).join('/')
    if (slugSet.has(ancestor)) {
      return { label: `← ${bySlug.get(ancestor).title}`, href: `/${ancestor}` }
    }
  }
  return { label: '← Home', href: '/' }
}

// ---------------------------------------------------------------------------
// Emit fixtures
// ---------------------------------------------------------------------------

const generated = [] // { varName, importPath } for the manifest
let fileCount = 0

const writeFixture = (relFromBase, obj, varName) => {
  const abs = path.join(fixturesBase, relFromBase)
  mkdirSync(path.dirname(abs), { recursive: true })
  writeFileSync(abs, `${JSON.stringify(obj, null, 2)}\n`)
  // importPath is extension-less; the manifest and the prettier targets each
  // append `.json` themselves.
  const importPath = `../../fixtures/base-site/${relFromBase}`.replace(/\.json$/, '')
  generated.push({ varName, importPath })
  fileCount++
}

for (const doc of docs) {
  const { slug, relPath, title, description } = doc
  const isIndex = slug === ROOT_SLUG

  // Reuse the legacy flat filenames for the /docs index (overwrite in place);
  // nest everything else under a docs/ subtree the generator owns.
  const stem = isIndex ? 'docs' : slug // e.g. 'docs/runbooks/hub-setup'
  const pageFile = isIndex ? 'pages/docs.json' : `pages/${slug}.json`
  const slotFile = isIndex ? 'slots/docs-main.json' : `slots/${slug}-main.json`
  const heroFile = isIndex ? 'components/docs-hero.json' : `components/${slug}-hero.json`
  const mdFile = isIndex ? 'components/docs-markdown.json' : `components/${slug}-markdown.json`

  const pageId = uuidFrom(`${stem}#page`)
  const slotId = uuidFrom(`${stem}#slot`)
  const heroId = uuidFrom(`${stem}#hero`)
  const mdId = uuidFrom(`${stem}#markdown`)

  let body = rewriteLinks(doc.body, relPath, slugSet)
  if (isIndex && readmeBody) {
    // README links resolve relative to the repo root, not docs/, so rewrite its
    // half with README.md as the base before appending.
    body += `\n\n${rewriteLinks(readmeBody, 'README.md', slugSet)}`
  }
  body = swapGitHubAlerts(body)

  // Hero CTAs: parent (outlined/white) then each child (solid/primary).
  const parentCta = parentCtaFor(slug)
  const ctas = []
  if (parentCta) {
    ctas.push({
      label: localized(parentCta.label),
      href: parentCta.href,
      variant: 'outlined',
      color: 'white',
    })
  }
  for (const child of childrenOf(slug)) {
    ctas.push({
      label: localized(child.title),
      href: `/${child.slug}`,
      variant: 'solid',
      color: 'primary',
    })
  }

  // --- markdown-block ---
  const markdown = {
    id: mdId,
    label: `${title} — markdown`,
    body: {
      _meta: { name: `${title} — markdown`, schema: SCHEMA.markdown, deliveryId: mdId },
      content: localized(body),
      maxWidth: 'default',
      gutter: true,
    },
  }

  // --- hero (dark, no media) ---
  const heroBody = {
    _meta: { name: `${title} — hero`, schema: SCHEMA.hero, deliveryId: heroId },
    title,
    ...(description ? { description } : {}),
    backgroundColor: 'dark',
    textColor: 'white',
    contentPositionMobile: 'beneath',
    verticalPosition: 'center',
    ...(ctas.length ? { ctas } : {}),
  }
  const hero = { id: heroId, label: `${title} — hero`, body: heroBody }

  // --- slot (hero + markdown) ---
  const slot = {
    id: slotId,
    label: `${title} — main slot`,
    body: {
      _meta: { name: `${title} — main slot`, schema: SCHEMA.slot },
      components: [link(heroId, SCHEMA.hero), link(mdId, SCHEMA.markdown)],
    },
  }

  // --- page ---
  const page = {
    id: pageId,
    label: `${title} page`,
    body: {
      _meta: {
        name: `${title} page`,
        schema: SCHEMA.page,
        deliveryKeys: { values: [{ value: `base-site/${slug}` }] },
      },
      title,
      ...(description ? { description } : {}),
      slots: [link(slotId, SCHEMA.slot)],
    },
  }

  writeFixture(heroFile, hero, identFrom(stem, 'hero'))
  writeFixture(mdFile, markdown, identFrom(stem, 'markdown'))
  writeFixture(slotFile, slot, identFrom(stem, 'slot'))
  writeFixture(pageFile, page, identFrom(stem, 'page'))
}

// ---------------------------------------------------------------------------
// Emit the static-import manifest for the mock loader
// ---------------------------------------------------------------------------

const importLines = generated
  .map((g) => `import ${g.varName} from '${g.importPath}.json' with { type: 'json' }`)
  .join('\n')

const arrayLines = generated.map((g) => `  ${g.varName},`).join('\n')

const manifest = `/**
 * GENERATED by packages/content/scripts/generate-docs.mjs — do not edit by hand.
 * Run \`pnpm docs:generate\` to refresh. Source of truth: the repo's docs/*.md.
 *
 * The mock loader can't scan disk (it must work in the browser / edge runtime),
 * so generated docs fixtures are surfaced as static imports here and spread into
 * the loader's fixture set.
 */

import type { EnrichedContentItem } from '../types'

${importLines}

export const docsFixtures = [
${arrayLines}
] as unknown as EnrichedContentItem[]
`

writeFileSync(generatedTsPath, manifest)

// ---------------------------------------------------------------------------
// Format outputs so `format:check` stays green (best-effort).
// ---------------------------------------------------------------------------

const prettierBin = path.join(repoRoot, 'node_modules/.bin/prettier')
if (existsSync(prettierBin)) {
  const targets = [
    ...generated.map((g) =>
      path.join(fixturesBase, `${g.importPath.replace('../../fixtures/base-site/', '')}.json`),
    ),
    generatedTsPath,
  ]
  const res = spawnSync(prettierBin, ['--write', '--log-level', 'warn', ...targets], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
  if (res.status !== 0) console.warn('docs:generate — prettier formatting skipped/failed')
}

console.log(
  `docs:generate — ${docs.length} doc(s) → ${fileCount} fixture file(s) + docs.generated.ts`,
)
for (const d of docs) console.log(`  ${d.relPath}  →  /${d.slug}`)
