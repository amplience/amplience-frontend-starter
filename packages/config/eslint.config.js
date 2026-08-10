// Shared flat ESLint config per ADR-0011.
//
// Composition (in order):
//   1. @eslint/js recommended
//   2. typescript-eslint recommendedTypeChecked + stylisticTypeChecked
//   3. eslint-plugin-react + react-hooks for *.{jsx,tsx}
//   4. @next/eslint-plugin-next + core-web-vitals for apps/web
//   5. eslint-plugin-jsx-a11y for *.{jsx,tsx}
//   6. unused-imports wrapped by a local no-autofix fork (block but never auto-remove)
//   7. eslint-config-prettier last (turns off stylistic rules that fight Prettier)
//
// Each workspace re-exports this from its own eslint.config.js. Per-package
// type-aware linting works because typescript-eslint's `projectService: true`
// resolves the closest tsconfig.json automatically.

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import prettierConfig from 'eslint-config-prettier'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import * as regexpPlugin from 'eslint-plugin-regexp'
import unusedImports from 'eslint-plugin-unused-imports'
import tseslint from 'typescript-eslint'

import { noAutofixPlugin } from './no-autofix-local.js'

// Resolve the repo root from this file's own location: packages/config/ → ../..
// We can't trust process.cwd() because lint-staged v15+ chdir's into the
// package containing each staged file before running commands. When the
// staged file lives in packages/config/, cwd ends up there and any
// cwd-relative path resolution (including tsconfigRootDir) breaks.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

// `pnpm lint:cleanup` sets this env var to opt-out of the no-autofix wrapper
// for a deliberate bulk import/var cleanup. Default (unset) is the safe path:
// wrap unused-imports rules so editor on-save autofix can't quietly delete
// code mid-refactor. Per ADR-0011 §4.
const cleanupMode = process.env.ESLINT_DISABLE_NO_AUTOFIX_WRAPPER === '1'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/.next/**',
      '**/.wxt/**',
      '**/.output/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
    ],
  },

  js.configs.recommended,

  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Build-config files (eslint.config.js, prettier.config.js,
          // vitest.config.ts, etc.) aren't part of any tsconfig project.
          // Let them parse under the default project so type-aware rules can
          // be selectively disabled below.
          // typescript-eslint disallows `**` in allowDefaultProject globs
          // (performance footgun). Enumerate the exact depths instead.
          allowDefaultProject: [
            '*.config.*',
            'eslint.config.*',
            'prettier.config.*',
            'lint-staged.config.*',
            'vitest.config.*',
            'packages/*/eslint.config.*',
            'packages/*/prettier.config.*',
            'packages/*/lint-staged.config.*',
            'packages/*/vitest.config.*',
            'apps/*/eslint.config.*',
            'apps/*/prettier.config.*',
            'apps/*/vitest.config.*',
          ],
          defaultProject: 'tsconfig.json',
        },
        tsconfigRootDir: REPO_ROOT,
      },
    },
  },

  // React + hooks for JSX/TSX
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      // Next.js doesn't need React in scope (automatic JSX runtime).
      'react/react-in-jsx-scope': 'off',
      // We use TypeScript for prop types.
      'react/prop-types': 'off',
    },
  },

  // Next.js rules apply only inside apps/web
  {
    files: ['apps/web/**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // App Router only — no pages/ directory exists. This rule is a
      // Pages-Router check that scans for `pages/` at the project root
      // and warns when it can't find one; it has no meaning here.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },

  // The "block but never auto-remove" wrapper.
  // unused-imports/* rules have autofixers — we want the *checks* without the
  // fixers, so editor on-save autofix can't quietly delete code mid-refactor.
  // Severity stays at `warn` (yellow squiggle), and CI/pre-commit run with
  // --max-warnings=0 so warnings block.
  //
  // When `ESLINT_DISABLE_NO_AUTOFIX_WRAPPER=1` (i.e. `pnpm lint:cleanup`), the
  // wrapper is bypassed and the original rules — with their autofixers — are
  // used so a deliberate bulk cleanup can strip unused imports/vars in one pass.
  cleanupMode
    ? {
        plugins: {
          'unused-imports': unusedImports,
        },
        rules: {
          '@typescript-eslint/no-unused-vars': 'off',
          'unused-imports/no-unused-imports': 'warn',
          'unused-imports/no-unused-vars': [
            'warn',
            {
              vars: 'all',
              varsIgnorePattern: '^_',
              args: 'after-used',
              argsIgnorePattern: '^_',
            },
          ],
        },
      }
    : {
        plugins: {
          'unused-imports': unusedImports,
          // Local fork of eslint-plugin-no-autofix — see no-autofix-local.js.
          'no-autofix': noAutofixPlugin(unusedImports, 'unused-imports'),
        },
        rules: {
          '@typescript-eslint/no-unused-vars': 'off',
          'unused-imports/no-unused-imports': 'off',
          'unused-imports/no-unused-vars': 'off',
          'no-autofix/unused-imports/no-unused-imports': 'warn',
          'no-autofix/unused-imports/no-unused-vars': [
            'warn',
            {
              vars: 'all',
              varsIgnorePattern: '^_',
              args: 'after-used',
              argsIgnorePattern: '^_',
            },
          ],
        },
      },

  // Build-config files (eslint.config.js, prettier.config.js, vitest.config.ts,
  // lint-staged.config.js, etc.) and package scripts/ directories run in Node
  // and aren't part of any tsconfig project. Disable type-aware rules and
  // declare Node globals.
  {
    files: [
      '**/*.config.{js,ts,mjs,cjs}',
      '**/eslint.config.{js,mjs,cjs}',
      '**/prettier.config.{js,mjs,cjs}',
      '**/lint-staged.config.{js,mjs,cjs}',
      '**/scripts/**/*.{js,mjs,cjs}',
    ],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: {
        process: 'readonly',
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
      },
    },
  },

  // Disable type-aware rules in plain JS files (no project to drive them).
  {
    files: ['**/*.{js,cjs,mjs}'],
    ...tseslint.configs.disableTypeChecked,
  },

  // Project-wide overrides to stylisticTypeChecked defaults.
  {
    rules: {
      // Prefer `type` over `interface` throughout the project — consistent
      // with the codebase convention and avoids declaration-merging surprises.
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    },
  },

  // Regex safety (QL-40; Quadratic 1.0 audit finding #18).
  //
  // The v1 finding wasn't one bad regex — it was a regex *compiled at
  // runtime from CMS config* (with unescaped interpolation) and matched
  // against request URLs in the SSR hot path. Two rules make the safe
  // posture a property of the toolchain rather than of review discipline:
  //
  //  - regexp/no-super-linear-backtracking rejects patterns whose
  //    worst-case runtime is super-linear (catastrophic backtracking).
  //    Linear-safe patterns pass untouched — regex stays available.
  //  - no-restricted-syntax rejects RegExp construction whose pattern is
  //    anything but a literal: a pattern that doesn't exist until runtime
  //    can't be statically analysed. A genuinely needed dynamic regex
  //    carries an explicit eslint-disable with a justification, so review
  //    happens exactly where the risk is.
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    plugins: {
      regexp: regexpPlugin,
    },
    rules: {
      'regexp/no-super-linear-backtracking': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='RegExp'][arguments.0.type!='Literal']",
          message:
            'Build regexes as literals (/…/). A pattern assembled at runtime cannot be ' +
            'checked for catastrophic backtracking — the exact shape of the v1 ReDoS ' +
            'finding (audit #18). If a dynamic pattern is unavoidable, disable this ' +
            'rule for the line with a justification.',
        },
        {
          selector: "CallExpression[callee.name='RegExp'][arguments.0.type!='Literal']",
          message:
            'Build regexes as literals (/…/). A pattern assembled at runtime cannot be ' +
            'checked for catastrophic backtracking — the exact shape of the v1 ReDoS ' +
            'finding (audit #18). If a dynamic pattern is unavoidable, disable this ' +
            'rule for the line with a justification.',
        },
      ],
    },
  },

  // MUST be last: turn off stylistic rules that would fight Prettier.
  prettierConfig,
)
