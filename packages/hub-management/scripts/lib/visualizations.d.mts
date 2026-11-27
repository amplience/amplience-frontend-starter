// Hand-written declarations for the visualization helpers, which stay plain
// ESM (.mjs) so `node scripts/hub-import.mjs` can import them directly.

export type WebApp = { label?: string; url: string; thumbnail?: boolean }

export declare const thumbnailSite: <T extends WebApp>(webApps: readonly T[]) => T | undefined
export declare const withWebAppVisualizations: <T extends object>(
  contentType: T,
  webApps: readonly WebApp[],
) => T
