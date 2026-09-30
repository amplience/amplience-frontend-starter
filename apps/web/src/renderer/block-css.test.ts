// Unit tests for per-block custom CSS preparation (ADR-0026).

import { describe, expect, it } from 'vitest'

import { BLOCK_CSS_CLASS_PREFIX, BLOCK_CSS_MAX_LENGTH, prepareBlockCss } from './block-css'

const ok = (raw: string) => {
  const prepared = prepareBlockCss(raw)
  if (!prepared?.ok) throw new Error(`expected ok, got ${JSON.stringify(prepared)}`)
  return prepared
}

describe('prepareBlockCss — nothing to apply', () => {
  it.each([undefined, null, 42, {}, '', '   \n  '])('returns null for %j', (raw) => {
    expect(prepareBlockCss(raw)).toBeNull()
  })
})

describe('prepareBlockCss — scoping', () => {
  it('wraps the CSS in a class selector that the class name matches', () => {
    const prepared = ok('background: hotpink;\nh2 { color: white; }')
    expect(prepared.className.startsWith(BLOCK_CSS_CLASS_PREFIX)).toBe(true)
    expect(prepared.href).toBe(prepared.className)
    expect(prepared.css).toBe(
      `.${prepared.className} {\nbackground: hotpink;\nh2 { color: white; }\n}`,
    )
  })

  it('is deterministic, and trims before hashing', () => {
    expect(ok('color: red;').className).toBe(ok('  color: red;\n').className)
  })

  it('gives different CSS different classes', () => {
    expect(ok('color: red;').className).not.toBe(ok('color: blue;').className)
  })

  it('allows the conditional group rules that nest', () => {
    const css = [
      '@media (min-width: 992px) { padding: 2rem; }',
      '@supports (display: grid) { display: grid; }',
      '@container (min-width: 20rem) { h2 { font-size: 2rem; } }',
      '@layer brand { color: red; }',
    ].join('\n')
    expect(prepareBlockCss(css)).toMatchObject({ ok: true })
  })

  it('counts braces inside strings and comments as text', () => {
    expect(
      prepareBlockCss('/* } */ h2::after { content: "}"; } p::before { content: \'{\'; }'),
    ).toMatchObject({ ok: true })
  })

  it('treats an escaped brace outside a string as text', () => {
    expect(prepareBlockCss('.a\\}b { color: red; }')).toMatchObject({ ok: true })
  })

  it('neutralises a </style> breakout', () => {
    const prepared = ok('h2::after { content: "</style><script>alert(1)</script>"; }')
    expect(prepared.css).not.toMatch(/<\/style/i)
    expect(prepared.css).toContain('<\\/style>')
  })
})

describe('prepareBlockCss — rejection', () => {
  it('rejects CSS that would close the scoping wrapper early', () => {
    expect(prepareBlockCss('} body { display: none; } x {')).toMatchObject({
      ok: false,
      reason: 'unbalanced-braces',
    })
  })

  it('rejects an unclosed rule', () => {
    expect(prepareBlockCss('h2 { color: red;')).toMatchObject({
      ok: false,
      reason: 'unbalanced-braces',
    })
  })

  it('rejects an unterminated comment', () => {
    expect(prepareBlockCss('color: red; /* never closed')).toMatchObject({
      ok: false,
      reason: 'unterminated-comment',
    })
  })

  it('rejects an unterminated string', () => {
    expect(prepareBlockCss('h2::after { content: "open; }')).toMatchObject({
      ok: false,
      reason: 'unterminated-string',
    })
  })

  it('ends a string at an unescaped newline, as CSS does', () => {
    // CSS turns this into a bad-string at the newline, so the `}` on the next
    // line is a real closing brace. Treating the string as still open would
    // let that brace through uncounted.
    expect(prepareBlockCss('x { content: "a\n} body { display: none; } y { "; }')).toMatchObject({
      ok: false,
      reason: 'unterminated-string',
    })
  })

  it.each([
    '@import url(x.css);',
    '@font-face { font-family: X; }',
    '@keyframes spin { }',
    '@IMPORT "x.css";',
  ])('rejects %j', (css) => {
    expect(prepareBlockCss(css)).toMatchObject({ ok: false, reason: 'disallowed-at-rule' })
  })

  it('names the offending at-rule', () => {
    expect(prepareBlockCss('@keyframes spin { }')).toMatchObject({ atRule: '@keyframes' })
  })

  it('rejects CSS over the length cap', () => {
    const css = `color: red;${' '.repeat(BLOCK_CSS_MAX_LENGTH)}x`
    expect(prepareBlockCss(css)).toMatchObject({ ok: false, reason: 'too-long' })
  })

  it('accepts CSS at exactly the length cap', () => {
    const css = `/*${'x'.repeat(BLOCK_CSS_MAX_LENGTH - 4)}*/`
    expect(css).toHaveLength(BLOCK_CSS_MAX_LENGTH)
    expect(prepareBlockCss(css)).toMatchObject({ ok: true })
  })
})
