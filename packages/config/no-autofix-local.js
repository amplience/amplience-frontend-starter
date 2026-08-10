// Local replacement for `eslint-plugin-no-autofix`, per ADR-0011 Open Q #6.
//
// The published plugin is unmaintained (last release 2024-09) and depends on
// `eslint-rule-composer` (last release 2018), which calls `context.getFilename()`
// — an API removed in ESLint 10. The ADR anticipated this: "If it ever goes
// unmaintained we can fork." This is that fork, reduced to the one behaviour
// the config actually uses.
//
// `noAutofixPlugin(plugin, prefix)` returns a plugin object exposing every rule
// of `plugin` under `<prefix>/<rule>`, with the autofixer removed. Registering
// the result under the `no-autofix` namespace reproduces the published plugin's
// rule ids exactly — `no-autofix/unused-imports/no-unused-imports` and friends —
// so the config's rule names are unchanged.
//
// Two things strip the fixer, because ESLint consults both:
//   - `meta.fixable` / `meta.hasSuggestions` cleared, so ESLint doesn't consider
//     the rule fixable at all (and `--fix-type` filtering behaves).
//   - `context.report` proxied to drop `fix` and `suggest` from each descriptor,
//     so a fixer the rule tries to emit anyway never reaches ESLint. The two
//     discarded properties take `_` aliases because this config's own
//     unused-vars rule flags them otherwise — the per-call-site opt-out ADR-0011
//     documents, applied to the file that implements the rule doing the flagging.
//
// Uses only APIs stable across ESLint 9 and 10. Verified on both: unused imports
// survive `--fix`, every other rule still autofixes, and `--max-warnings=0`
// still fails the run.

/**
 * @param {{ rules: Record<string, import('eslint').Rule.RuleModule> }} plugin
 * @param {string} prefix
 * @returns {{ rules: Record<string, import('eslint').Rule.RuleModule> }}
 */
export const noAutofixPlugin = (plugin, prefix) => ({
  rules: Object.fromEntries(
    Object.entries(plugin.rules).map(([name, rule]) => [
      `${prefix}/${name}`,
      {
        ...rule,
        meta: { ...rule.meta, fixable: undefined, hasSuggestions: false },
        create(context) {
          const proxy = Object.create(context, {
            report: {
              value: ({ fix: _fix, suggest: _suggest, ...descriptor }) =>
                context.report(descriptor),
            },
          })
          return rule.create(proxy)
        },
      },
    ]),
  ),
})
