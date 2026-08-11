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
 *   The curated top-level pages (see UPDATE_ONLY) are the exception: their heroes
 *   are hand-authored and localized across every hub locale, so the generator
 *   never writes hero text for them — only the page's SEO fields and the
 *   markdown-block body, both of which are single-locale by nature (Markdown).
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

/**
 * Slug for a repo-relative md path. Two top-level pages are remapped: the repo
 * README is the `/docs` landing, and `docs/index.md` is the `/about` overview.
 * Both page generation and link rewriting run through here, so a link to either
 * file resolves to the right site path automatically (README → /docs,
 * docs/index.md → /about). Otherwise index.md / README.md collapse to the folder.
 */
const SLUG_OVERRIDES = { README: 'docs', CONTRIBUTING: 'contributing', 'docs/index': 'about' }
const slugForPath = (relPath) => {
  const noExt = relPath.replace(/\.md$/i, '')
  if (noExt in SLUG_OVERRIDES) return SLUG_OVERRIDES[noExt]
  return noExt.replace(/\/(index|README)$/i, '')
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

/**
 * Replace `> [!TYPE]` alert markers with an emoji-prefixed blockquote.
 *
 * Two authoring forms exist in the docs, and they need different treatment:
 *
 *   > [!NOTE]                 bare marker — the emoji just prefixes the body
 *   > Body text…
 *
 *   > [!NOTE] A title         titled — GitHub renders the title as a heading
 *   > Body text…              above the body, so the site must break the line
 *
 * For the titled form a plain swap isn't enough: consecutive blockquote lines
 * are one paragraph in Markdown, and the renderer (react-markdown + remark-gfm,
 * no remark-breaks) folds the newline to a space — so the title ran into the
 * body as `ℹ️ A title Body text…`. The title is emphasised and terminated with a
 * backslash, CommonMark's hard line break, which keeps it tight to the body
 * rather than opening a paragraph gap the way a blank `>` line would.
 *
 * The backslash is only added when a non-empty quote line actually follows: on
 * the last line of a blockquote CommonMark renders a trailing backslash
 * literally instead of as a break.
 */
const swapGitHubAlerts = (md) =>
  md.replace(
    /^([ \t]*>[ \t]*)\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*([^\r\n]*)/gim,
    (whole, prefix, type, title, offset, full) => {
      const emoji = ALERT_EMOJI[type.toUpperCase()]
      const heading = title.trim()
      if (heading === '') return `${prefix}${emoji}`
      const next = /^\r?\n([ \t]*>[^\r\n]*)/.exec(full.slice(offset + whole.length))
      const bodyFollows = next !== null && next[1].replace(/^[ \t]*>[ \t]*/, '').trim() !== ''
      return `${prefix}**${emoji} ${heading}**${bodyFollows ? '\\' : ''}`
    },
  )

/**
 * Strip a leading `[← Back](..)` navigation link from the top of a doc. That
 * link is a repo-only convenience (GitHub has no site chrome); on the generated
 * site the hero's parent/child CTAs already provide back-navigation, so it must
 * never reach a fixture. Keyed on the `←` in the label so it only ever removes
 * an actual back-link, and only at the very top of the file.
 */
const stripBackLink = (md) => md.replace(/^[ \t]*\[\u2190[^\]]*\]\([^)]*\)[ \t]*\r?\n\s*/, '')

// ---------------------------------------------------------------------------
// Build the doc model
// ---------------------------------------------------------------------------

if (!existsSync(docsDir)) {
  console.error(`docs:generate — no docs/ directory at ${docsDir}`)
  process.exit(1)
}

// Every docs/*.md plus the repo-root pages: README → /docs, CONTRIBUTING → /contributing.
const relPaths = [...findMarkdown(docsDir), 'README.md', 'CONTRIBUTING.md'].sort()

// First pass: parse every doc so we know the full slug set (for link rewriting
// and parent/child CTA wiring).
const docs = relPaths.map((relPath) => {
  const slug = slugForPath(relPath)
  const fallback = humanize(slug.split('/').pop() || slug)
  const parsed = parseDoc(
    stripBackLink(readFileSync(path.join(repoRoot, relPath), 'utf8')),
    fallback,
  )
  return { relPath, slug, ...parsed }
})

const slugSet = new Set(docs.map((d) => d.slug))
const bySlug = new Map(docs.map((d) => [d.slug, d]))

// A few top-level pages are curated fixtures, not fully generated: /docs (from
// the repo README), /about (from docs/index.md) and /contributing. For these the
// generator refreshes the page's SEO title/description and the markdown-block
// body from the source file, and touches nothing else — the hero fixture is
// hand-authored in full (text, design, media, colours, CTAs), as are the slot
// wiring and IDs.
//
// Hero text is deliberately outside the generator's remit here: those heroes
// carry localized-value title/description spanning every hub locale, while a
// Markdown file can only ever supply one. Leaving them alone is what lets the
// curated copy be translated, and lets it diverge from the doc's H1 where the
// page wants a different voice. Everything else under docs/ stays fully
// generated (plain hero + programmatic parent/child CTAs).
const UPDATE_ONLY = {
  docs: {
    // /docs pins its own title/description; only its body comes from the README.
    title: 'Documentation',
    description: 'Helpful information for installing & using Quadratic Lite',
    page: 'pages/docs.json',
    markdown: 'components/docs-markdown.json',
  },
  about: {
    page: 'pages/about.json',
    markdown: 'components/about-markdown.json',
  },
  contributing: {
    page: 'pages/contributing.json',
    markdown: 'components/contributing-markdown.json',
  },
}

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
// A page's effective title — its UPDATE_ONLY override if it pins one, else the
// title parsed from its source file.
const effectiveTitle = (slug) => UPDATE_ONLY[slug]?.title ?? bySlug.get(slug)?.title

const parentCtaFor = (slug) => {
  const segs = slug.split('/')
  for (let i = segs.length - 1; i > 0; i--) {
    const ancestor = segs.slice(0, i).join('/')
    if (slugSet.has(ancestor)) {
      return { label: `← ${effectiveTitle(ancestor)}`, href: `/${ancestor}` }
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

/** Set a field when the value is truthy, otherwise remove it. */
const patchText = (obj, key, value) => {
  if (value) obj[key] = value
  else delete obj[key]
}

/**
 * Refresh only the generator-owned text of a curated top-level page (see
 * UPDATE_ONLY): the page's SEO title/description, and the markdown-block body.
 * The hero fixture is not touched at all — its localized copy is hand-authored —
 * and neither are IDs or slot wiring. These files are loaded by the mock loader
 * directly (not via the generated manifest), so they're written here but never
 * added to `generated`.
 */
const updateTopLevel = ({ page, markdown }, title, description, body) => {
  const patch = (rel, mutate) => {
    const abs = path.join(fixturesBase, rel)
    const json = JSON.parse(readFileSync(abs, 'utf8'))
    mutate(json)
    writeFileSync(abs, `${JSON.stringify(json, null, 2)}\n`)
  }
  patch(page, (j) => {
    j.body.title = title
    patchText(j.body, 'description', description)
  })
  patch(markdown, (j) => {
    j.body.content = localized(body)
  })
}

for (const doc of docs) {
  const { slug, relPath, title, description } = doc

  let body = rewriteLinks(doc.body, relPath, slugSet)
  body = swapGitHubAlerts(body)

  // Curated top-level pages (/docs, /about): refresh text only, keep the rest.
  // A page may pin its own title/description (e.g. /docs); otherwise they come
  // from the source file's H1 + intro paragraph (e.g. /about).
  if (UPDATE_ONLY[slug]) {
    const cfg = UPDATE_ONLY[slug]
    updateTopLevel(cfg, cfg.title ?? title, cfg.description ?? description, body)
    continue
  }

  // Fully-generated subpage: plain hero + programmatic parent/child CTAs.
  const pageId = uuidFrom(`${slug}#page`)
  const slotId = uuidFrom(`${slug}#slot`)
  const heroId = uuidFrom(`${slug}#hero`)
  const mdId = uuidFrom(`${slug}#markdown`)

  // Hero CTAs: parent (outlined/white) then each child (solid/primary).
  const ctas = []
  const parentCta = parentCtaFor(slug)
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

  const slot = {
    id: slotId,
    label: `${title} — main slot`,
    body: {
      _meta: { name: `${title} — main slot`, schema: SCHEMA.slot },
      components: [link(heroId, SCHEMA.hero), link(mdId, SCHEMA.markdown)],
    },
  }

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

  writeFixture(`components/${slug}-hero.json`, hero, identFrom(slug, 'hero'))
  writeFixture(`components/${slug}-markdown.json`, markdown, identFrom(slug, 'markdown'))
  writeFixture(`slots/${slug}-main.json`, slot, identFrom(slug, 'slot'))
  writeFixture(`pages/${slug}.json`, page, identFrom(slug, 'page'))
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
  const updateOnlyFiles = Object.values(UPDATE_ONLY)
    .flatMap((x) => [x.page, x.markdown])
    .map((rel) => path.join(fixturesBase, rel))
  const targets = [
    ...generated.map((g) =>
      path.join(fixturesBase, `${g.importPath.replace('../../fixtures/base-site/', '')}.json`),
    ),
    ...updateOnlyFiles,
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
