// Hand-written declarations for the extension-install logic, which stays plain
// ESM (.mjs) so the scripts import it without a TS loader.

import type { FlowFixture, RegistryInstance } from './flows.d.mts'

/** A public extension as the catalogue records it. */
export type CatalogueEntry = {
  label: string
  extensionId: string
  description?: string
  /** version → extensionReleaseId. Optional: the hub picks when none is pinned. */
  releases?: Record<string, string>
  /** `${secret:NAME}`, `${hub:id}`, `${hub:name}` or a literal. */
  env: Record<string, unknown>
}

export type EnvContext = {
  env?: Record<string, string | undefined>
  hubId?: string
  hubName?: string
  source?: string
}

export type MissingExtension = {
  extensionId: string
  handle: string
  version?: string
}

export function parseEntry(json: unknown, source?: string): CatalogueEntry
export function releaseFor(entry: CatalogueEntry, version?: string): string | undefined
export function resolveEnv(
  template: Record<string, unknown>,
  context?: EnvContext,
): Record<string, unknown>
export function instanceLabel(entry: CatalogueEntry, version?: string): string
export function installInput(
  entry: CatalogueEntry,
  options: { version?: string; hubRef: string; env: Record<string, unknown> },
): {
  cmsHubId: string
  extensionId: string
  label: string
  description?: string
  extensionReleaseId?: string
  env: Record<string, unknown>
}
export function findEntry(
  catalogue: CatalogueEntry[],
  extensionId: string,
): CatalogueEntry | undefined
/** Extensions these fixtures bind to that the hub has no instance of. */
export function missingExtensions(
  fixtures: FlowFixture[],
  instances?: RegistryInstance[],
): MissingExtension[]
export function versionOfHandle(handle: string | undefined): string | undefined
