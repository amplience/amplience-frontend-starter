// Hand-written declarations for the webhooks resolver, which stays plain ESM
// (.mjs) so `node scripts/hub-import.mjs` imports it without a TS loader.

export type WebAppConfig = {
  url: string
  label?: string
  name?: string
}

export type WebhookHeader = {
  key: string
  value: string
  secret?: boolean
}

export type WebhookDefinition = {
  label?: string
  active?: boolean
  method?: string
  events?: string[]
  handlers?: string[]
  headers?: WebhookHeader[]
  filters?: unknown[]
  customPayload?: { type: string; value: string }
  secret?: string
}

export type ResolvedWebhook = WebhookDefinition & { label: string; id?: string }

export type ExpandOptions = {
  webApps: WebAppConfig[]
  hub?: string
  secrets?: Map<string, string>
  source?: string
}

export type WebhookDiff = {
  create: ResolvedWebhook[]
  update: ResolvedWebhook[]
  prune: ResolvedWebhook[]
}

export const MANAGED_LABEL_PREFIX: string
export const WEBHOOK_INSTANCE_FIELDS: readonly string[]

export function requiredSecrets(definition: WebhookDefinition): Set<string>
export function normaliseUrl(url: string): string
export function siteLabel(webApp: WebAppConfig): string
export function expandDefinition(
  definition: WebhookDefinition,
  options: ExpandOptions,
): ResolvedWebhook[]
export function diffWebhooks(desired: ResolvedWebhook[], existing: ResolvedWebhook[]): WebhookDiff
export function redact(webhook: ResolvedWebhook): ResolvedWebhook
