// Hand-written declarations for the shared Workforce round-trips, which stay
// plain ESM (.mjs) so the scripts import them without a TS loader.

import type { FlowRegistry } from './flows.d.mts'

export const GRAPHQL_API: string
export const AMPLIENCE_API: string
export const AMPLIENCE_AUTH: string
export const PAT_ENV_VARS: readonly string[]

export function requiredEnv(
  name: string,
  why: string,
  env?: Record<string, string | undefined>,
): string
export function personalAccessToken(env?: Record<string, string | undefined>): string
export function graphql(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined>
export function managementToken(env?: Record<string, string | undefined>): Promise<string>
export function managementGet(token: string, url: string): Promise<Record<string, unknown>>
export function cmsHubId(organizationId: string, hubId: string): string
export function organizationOf(
  mgmtToken: string,
  hubId: string,
  env?: Record<string, string | undefined>,
): Promise<string>

/** Read a hub's instances, listeners and workflow states, probing for version. */
export function readRegistry(
  token: string,
  mgmtToken: string,
  hubId: string,
  organizationId: string,
): Promise<{ registry: FlowRegistry; warnings: string[] }>
/** Turn the Workforce and Management API shapes into the pure modules' shape. */
export function shapeRegistry(hub: unknown, states: unknown): FlowRegistry
/** The API's maximum page size; asking for more is refused, not clamped. */
export const PAGE_SIZE: number
/** Every webhook listener on the hub, paged — an unpaged read truncates. */
export function readListeners(
  token: string,
  hubRef: string,
): Promise<{ id: string; label: string; url?: string }[]>
/** A release's version, from `version` or from a version-shaped `label`. */
export function versionFrom(
  release: { version?: string; label?: string } | undefined,
): string | undefined
