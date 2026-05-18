// Shared lint-staged config per ADR-0011 §4 D1.
//
// Prettier formats every supported file type. ESLint then auto-fixes
// everything it has fixers for and fails on any remaining warning or
// error (`--max-warnings=0`). The unused-imports/vars rules are wrapped
// by eslint-plugin-no-autofix so they remain as warnings — and therefore
// block the commit — until the developer cleans them up deliberately.

export default {
  '*.{ts,tsx,js,jsx,cjs,mjs,json,md,css,yml,yaml}': 'prettier --write',
  '*.{ts,tsx,js,jsx,cjs,mjs}': 'eslint --fix --max-warnings=0',
}
