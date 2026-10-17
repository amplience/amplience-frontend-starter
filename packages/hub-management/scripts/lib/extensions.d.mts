// Hand-written declarations for the extension-install logic, which stays plain
// ESM (.mjs) so the scripts import it without a TS loader.

import type { FlowFixture, RegistryInstance } from './flows.d.mts'

/** An extension whose id the catalogue asserts is the same on every hub. */
export type CatalogueEntry = {
  label: string
  extensionId: string
  /**
   * Whether this repo can install it, defaulting to true. False records the id
   * as stable without an install recipe — then `releases` and `env` must be
   * absent, since nothing would read them.
   */
  installable: boolean
  description?: string
  /** version → extensionReleaseId. Optional: the hub picks when none is pinned. */
  releases?: Record<string, string>
  /** `${secret:NAME}`, `${hub:id}`, `${hub:name}` or a literal. */
  env: Record<string, unknown>
}

/** One entry plus the file it came from, so a clash can name both. */
export type SourcedEntry = { source: string; value: CatalogueEntry }

/** What resolution needs to know about an id — not the install recipe. */
export type CatalogueFact = { label: string; installable: boolean }

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
/** Merge the checked-in and `local/` catalogues, refusing a clash on either id or label. */
export function mergeCatalogue(shared?: SourcedEntry[], local?: SourcedEntry[]): CatalogueEntry[]
/** The catalogue keyed by extension id, as `resolveGraph` takes it. */
export function catalogueIndex(catalogue?: CatalogueEntry[]): Map<string, CatalogueFact>
/** Extensions these fixtures bind to that the hub has no instance of. */
export function missingExtensions(
  fixtures: FlowFixture[],
  instances?: RegistryInstance[],
): MissingExtension[]
export function versionOfHandle(handle: string | undefined): string | undefined
