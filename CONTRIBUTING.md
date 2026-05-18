# Contributing Guide

Thank you for your interest in contributing to this project.

## Getting Started

1. Fork the repository to your GitHub account
2. Clone your fork locally
3. Create a feature branch from `main`
4. Make your changes
5. Push to your fork and submit a pull request

## Branch Naming Convention

Use the following prefixes for branches:

- `feature/` - New features
- `bugfix/` - Bug fixes
- `hotfix/` - Urgent production fixes
- `chore/` - Maintenance tasks
- `docs/` - Documentation updates

Example: `feature/add-user-authentication`

## Editor setup

The repo enforces output (formatting, lint rules) but never the editor — `.vscode/` is gitignored and there is no mandated IDE. `.editorconfig`, `.gitattributes`, and the Husky pre-commit hook are the floor: whatever your editor does or doesn't do, the commit either matches house style or it doesn't land.

For the smoothest day-to-day experience, enable format-on-save with Prettier as the default formatter and turn on ESLint fix-all-on-save. Copy-pasteable settings for VS Code, JetBrains, neovim, and Zed live in [`docs/editor-setup.md`](docs/editor-setup.md).

### Unused imports and vars: block, but never auto-remove

Per [ADR-0011 §4](04-architecture/adr/0011-typescript-and-lint.md), unused imports and unused variables are wrapped by `eslint-plugin-no-autofix` — they surface as warnings (yellow squiggles) in your editor, and `--max-warnings=0` makes them block the commit and CI. They are deliberately **not** auto-removed by editor on-save autofix, so a save mid-refactor never silently deletes an import you were about to wire up.

When you need to do a deliberate bulk cleanup, you have three options:

- Prefix a deliberately-unused argument with `_` (e.g. `function onClick(_event) { ... }`) to opt out per-call-site.
- Use TypeScript's "Remove all unused declarations" code action (in VS Code: Source Action → Remove all unused imports). It uses the TS language service rather than ESLint, so it works regardless of the wrapper.
- Run `pnpm lint:cleanup`, which bypasses the wrapper and lets ESLint auto-strip in one pass.

## Commit Guidelines

- Write clear, concise commit messages
- Use present tense ("Add feature" not "Added feature")
- Sign your commits if required by the repository

## Pull Request Process

1. Ensure your fork is up to date with the upstream `main` branch
2. Open a pull request from your fork to the upstream repository
3. Complete the PR template
4. Respond to review comments promptly
5. Ensure all CI checks pass

## Contributor License Agreement

By submitting a pull request, you agree that your contributions will be licensed under the same license as the project.

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributions from everyone.
