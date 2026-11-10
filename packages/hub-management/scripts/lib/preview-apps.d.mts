// Hand-written declarations for the preview-application helpers, which stay
// plain ESM (.mjs) so `node scripts/hub-import.mjs` can import them directly.

export type PreviewApplication = { name: string; templatedUri: string }
export type WebApp = { label?: string; url: string }

export declare const webAppLabel: (site: WebApp) => string
export declare const previewTemplate: (url: string) => string
export declare const previewApplications: (opts: {
  localhostUrl: string
  webApps: readonly WebApp[]
}) => PreviewApplication[]
export declare const withPreviewApplications: <
  T extends { settings?: { applications?: PreviewApplication[] } & Record<string, unknown> },
>(
  settingsJson: T,
  applications: readonly PreviewApplication[],
) => T & { settings: { applications: PreviewApplication[] } }
export declare const missingApplications: (
  expected: readonly PreviewApplication[],
  hubApplications: readonly { name: string }[] | undefined,
) => string[]
