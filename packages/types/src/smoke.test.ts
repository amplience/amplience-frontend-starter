// Smoke test — proves the Vitest toolchain is wired up correctly across the
// workspace (per QL-20). Delete or replace once real type-contract tests land.

import { describe, expect, it } from 'vitest'

describe('toolchain smoke', () => {
  it('runs Vitest under the shared @amplience/frontend-starter-config preset', () => {
    expect(1 + 1).toBe(2)
  })
})
