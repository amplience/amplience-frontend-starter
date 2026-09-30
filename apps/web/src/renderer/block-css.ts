/**
 * Per-block custom CSS (ADR-0026): scopes a block's optional `customCss` to it
 * with native nesting (`.block-css-<hash> { … }`), after a containment check.
 * Client-safe — the live visualization imports it too.
 */

/** Longest accepted value, in characters. Mirrors the schema's `maxLength`. */
export const BLOCK_CSS_MAX_LENGTH = 4000

/** React `precedence` group shared by every block stylesheet. */
export const BLOCK_CSS_PRECEDENCE = 'amplience-block-css'

/** Prefix of the scoping class (and of each stylesheet's `href`). */
export const BLOCK_CSS_CLASS_PREFIX = 'block-css-'

/** At-rules that can't nest inside the wrapper (or cost a request). Group rules like `@media` are fine. */
const DISALLOWED_AT_RULES = new Set([
  'import',
  'charset',
  'namespace',
  'font-face',
  'keyframes',
  '-webkit-keyframes',
  'property',
  'page',
  'counter-style',
  'font-feature-values',
  'font-palette-values',
])

export type BlockCssRejection =
  | { readonly reason: 'too-long'; readonly length: number }
  | { readonly reason: 'unbalanced-braces' }
  | { readonly reason: 'unterminated-comment' }
  | { readonly reason: 'unterminated-string' }
  | { readonly reason: 'disallowed-at-rule'; readonly atRule: string }

export type PreparedBlockCss =
  | {
      readonly ok: true
      /** The scoping class to add to the block's root. */
      readonly className: string
      /** The stylesheet's `href` (its dedupe key). */
      readonly href: string
      /** The scoped, `</style>`-safe stylesheet text. */
      readonly css: string
    }
  | ({ readonly ok: false } & BlockCssRejection)

/** 32-bit FNV-1a, base36 — stable across server and client renders. */
function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

const isIdentChar = (ch: string): boolean => /[A-Za-z0-9_-]/.test(ch)

/**
 * Linear scan counting braces and at-rules only where the CSS parser sees them.
 * Conservative by design: a newline ends a string, as CSS's bad-string does.
 */
function findProblem(css: string): BlockCssRejection | undefined {
  let depth = 0
  let i = 0
  const n = css.length

  while (i < n) {
    const ch = css.charAt(i)

    // Comment.
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      if (end === -1) return { reason: 'unterminated-comment' }
      i = end + 2
      continue
    }

    // String.
    if (ch === '"' || ch === "'") {
      i += 1
      let closed = false
      while (i < n) {
        const c = css.charAt(i)
        if (c === '\\') {
          i += 2
          continue
        }
        if (c === '\n' || c === '\r' || c === '\f') break
        if (c === ch) {
          closed = true
          i += 1
          break
        }
        i += 1
      }
      if (!closed) return { reason: 'unterminated-string' }
      continue
    }

    // Escape outside a string (e.g. `\}` in an identifier) — not a brace.
    if (ch === '\\') {
      i += 2
      continue
    }

    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth < 0) return { reason: 'unbalanced-braces' }
    } else if (ch === '@') {
      let j = i + 1
      while (j < n && isIdentChar(css.charAt(j))) j += 1
      const name = css.slice(i + 1, j).toLowerCase()
      if (DISALLOWED_AT_RULES.has(name)) return { reason: 'disallowed-at-rule', atRule: `@${name}` }
      i = j
      continue
    }

    i += 1
  }

  return depth === 0 ? undefined : { reason: 'unbalanced-braces' }
}

/** Same `</style>` escape as lib/custom-css-schema.ts, kept local to the renderer. */
const escapeStyleClose = (css: string): string => css.replace(/<\/(style)/gi, '<\\/$1')

/** A scoped stylesheet, a rejection, or null when there's nothing to apply. */
export function prepareBlockCss(raw: unknown): PreparedBlockCss | null {
  if (typeof raw !== 'string') return null
  const source = raw.trim()
  if (source === '') return null

  if (source.length > BLOCK_CSS_MAX_LENGTH) {
    return { ok: false, reason: 'too-long', length: source.length }
  }

  const problem = findProblem(source)
  if (problem !== undefined) return { ok: false, ...problem }

  const className = `${BLOCK_CSS_CLASS_PREFIX}${hash(source)}`
  return {
    ok: true,
    className,
    href: className,
    css: escapeStyleClose(`.${className} {\n${source}\n}`),
  }
}
