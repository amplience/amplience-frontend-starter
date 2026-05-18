// Shared Prettier config per ADR-0011 §3.
//
// House-style calls:
//   - No end-of-line semicolons (`semi: false`). Prettier handles ASI edge
//     cases automatically — lines that would misparse get a leading `;`.
//   - Trailing commas everywhere they're legal (`trailingComma: 'all'`) so
//     reordering or adding a line in arrays, objects, and parameter lists
//     produces a clean single-line diff.
//
// Import sorting (per ADR-0011 §3 C1) is owned by Prettier via
// `@ianvs/prettier-plugin-sort-imports` — the actively maintained successor
// to the deprecated @trivago plugin.

/** @type {import("prettier").Config} */
export default {
  printWidth: 100,
  singleQuote: true,
  trailingComma: 'all',
  semi: false,
  arrowParens: 'always',
  plugins: ['@ianvs/prettier-plugin-sort-imports'],
  importOrder: [
    '<BUILTIN_MODULES>',
    '<THIRD_PARTY_MODULES>',
    '',
    '^@amplience/(.*)$',
    '',
    '^@/(.*)$',
    '',
    '^[./]',
  ],
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
}
