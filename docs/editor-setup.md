# Editor setup

Quadratic Lite is editor-agnostic. The repo enforces output (formatting, lint rules) but never the editor — `.vscode/` is gitignored, and there is no mandated IDE. Anyone cloning the repo gets the same outcome on macOS, Linux, or Windows because of three repo-level mechanisms (per [ADR-0011](../04-architecture/adr/0011-typescript-and-lint.md)):

- `.editorconfig` covers indentation, line endings, charset, trailing whitespace, final-newline behaviour.
- `.gitattributes` pins LF line endings at the source-control layer.
- The Husky pre-commit hook runs Prettier and ESLint over staged files. No matter what your editor did or didn't do, the commit either matches house style or it doesn't land.

This document lists the optional-but-recommended on-save settings that give you the smoothest day-to-day experience. None of these are required to contribute — they just save round-trips through the pre-commit hook.

## Universal — install these plugins

Whatever editor you use, install the plugin for each tool listed below. They're available everywhere.

- **EditorConfig** — most modern editors respect `.editorconfig` natively. Install a plugin only if your editor doesn't.
- **Prettier** — formats on save.
- **ESLint** — surfaces warnings inline, autofixes on save where rules support it.

## VS Code / Cursor

Settings live in your own `.vscode/settings.json` (not committed — `.vscode/` is gitignored).

```jsonc
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
  },
  "eslint.useFlatConfig": true,
}
```

Recommended extensions are listed in `.vscode/extensions.json`, so VS Code will offer to install them the first time you open the repo:

- `esbenp.prettier-vscode`
- `dbaeumer.vscode-eslint`
- `EditorConfig.EditorConfig`

(`.vscode/settings.json` is gitignored — your personal editor settings stay yours. Only the workspace-level extension recommendations are checked in.)

## JetBrains (WebStorm, IntelliJ IDEA Ultimate, RustRover, etc.)

- **Prettier:** _Settings → Languages & Frameworks → JavaScript → Prettier._ Enable "Run on save" and set "Run for files" to `**/*.{ts,tsx,js,jsx,cjs,mjs,json,md,css,yml,yaml}`.
- **ESLint:** _Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint._ Choose "Automatic ESLint configuration" and enable "Run eslint --fix on save".
- **EditorConfig:** Bundled, enabled by default.

## Neovim / Vim

Use the LSP entry points — they read the repo's flat ESLint config and Prettier config without extra wiring.

- **Prettier:** install via [conform.nvim](https://github.com/stevearc/conform.nvim) or [null-ls](https://github.com/jose-elias-alvarez/null-ls.nvim). Format on save with `BufWritePre`.
- **ESLint:** the [`eslint-lsp`](https://github.com/microsoft/vscode-eslint/tree/main/server) server (via `nvim-lspconfig` / `mason`) supports flat config out of the box.

## Zed

Zed reads `.editorconfig`, `.prettierrc`, and flat ESLint configs natively. In your `~/.config/zed/settings.json`:

```jsonc
{
  "format_on_save": "on",
  "formatter": "prettier",
  "code_actions_on_format": {
    "source.fixAll.eslint": true,
  },
}
```

## One thing that may surprise you on first read

We use `semi: false` (no end-of-line semicolons). Prettier handles the [ASI edge cases](https://prettier.io/docs/en/rationale.html#semicolons) automatically — lines that would misparse under ASI (those starting with `[`, `(`, `` ` ``, `+`, `-`, `/`) get a Prettier-inserted leading `;`. So if you see a stray-looking leading semicolon, that's why. Don't remove it.

## What gets blocked on commit (and why)

Per [ADR-0011 §4](../04-architecture/adr/0011-typescript-and-lint.md), the pre-commit hook runs `prettier --write` followed by `eslint --fix --max-warnings=0` over staged files. The "block but never auto-remove" policy lives at the rule level: ESLint's `unused-imports/*` rules are wrapped by `eslint-plugin-no-autofix` so they report as warnings rather than auto-deleting code mid-refactor.

In practice that means:

- **Other lint warnings** auto-fix silently — you won't notice.
- **Unused imports/vars** stay as yellow squiggles in your editor and block the commit until you remove them deliberately.
- **Bulk cleanup** when you're done refactoring: prefix deliberately-unused args with `_` (e.g. `function onClick(_event) { ... }`), use the TypeScript "Remove all unused declarations" code action, or run `pnpm lint:cleanup` to autofix everything including the wrapped rules.
