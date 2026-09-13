export interface EmbedCspOptions {
  /** Additional script origins allowed beyond 'unsafe-inline'/'unsafe-eval' (e.g. CDN allowlist from instance settings). */
  scriptAllowlist: string[];
  /** Origin the frame is permitted to be embedded from, e.g. the app's own origin. */
  frameAncestor: string;
  /**
   * Origin serving this instance's own uploaded artifact files (`/af/:token`), when storage is
   * enabled — e.g. `ARTIFACT_ORIGIN` or `APP_ORIGIN`. Must be an absolute origin, never `'self'`:
   * `/embed/:token` renders inside an iframe WITHOUT `allow-same-origin`, so it's an opaque
   * origin and `'self'` would match nothing there. `img-src` already allows any `https:` origin,
   * so this mainly unlocks `media-src`/`font-src`, which have no such open-ended fallback under
   * `default-src 'none'`. Omit when storage is disabled — nothing changes without it.
   */
  assetOrigin?: string;
}

/**
 * Builds the Content-Security-Policy for the sandboxed artifact-content response (`/embed/:token`).
 * This is the second line of defense after the iframe `sandbox` attribute (which lacks `allow-same-origin`).
 * `connect-src 'none'` blocks fetch/XHR/WebSocket back to the app's API even if same-origin were ever granted.
 */
export function buildEmbedCsp(opts: EmbedCspOptions): string {
  const scriptSrc = ["'unsafe-inline'", "'unsafe-eval'", ...opts.scriptAllowlist].join(" ");
  const asset = opts.assetOrigin ? ` ${opts.assetOrigin}` : "";
  const directives = [
    "default-src 'none'",
    `script-src ${scriptSrc}`,
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    `img-src data: blob: https:${asset}`,
    `font-src https://fonts.gstatic.com data:${asset}`,
    // No media-src fallback under default-src 'none' otherwise — audio/video only ever come from
    // this instance's own asset origin, never a third party, so it's never opened beyond that.
    ...(opts.assetOrigin ? [`media-src ${opts.assetOrigin}`] : []),
    "connect-src 'none'",
    `frame-ancestors ${opts.frameAncestor}`,
  ];
  return directives.join("; ");
}

export interface ViewerShellCspOptions {
  /** Per-response nonce authorizing the shell's own inline `<style>`/`<script>` — never reused across responses. */
  nonce: string;
  /** True only on the password-entry page, whose inline script `fetch`es `POST /s/:token/unlock`. */
  allowConnectSelf?: boolean;
}

/**
 * Builds the Content-Security-Policy for the public viewer shell (`/s/:token`) — the page around
 * the sandboxed `/embed/:token` iframe. Unlike `buildEmbedCsp`, this document is same-origin and,
 * as of the viewer panel, interpolates artifact/team/user-supplied strings (title, author name,
 * team name, version message) into its HTML — so this CSP is a second line of defense behind
 * escaping, not a substitute for it. `'nonce-<n>'` (never `'unsafe-inline'`) is why the shell must
 * never be cached: a cached response ships a stale, guessable nonce, defeating the policy.
 */
export function buildViewerShellCsp(opts: ViewerShellCspOptions): string {
  const directives = [
    "default-src 'none'",
    `script-src 'nonce-${opts.nonce}'`,
    `style-src 'nonce-${opts.nonce}'`,
    // The shell's only child resource is its own /embed/:token iframe — never a third party.
    "frame-src 'self'",
    `connect-src ${opts.allowConnectSelf ? "'self'" : "'none'"}`,
    "form-action 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ];
  return directives.join("; ");
}

export const DEFAULT_CDN_ALLOWLIST = [
  "https://cdnjs.cloudflare.com",
  "https://cdn.jsdelivr.net",
  "https://code.jquery.com",
  "https://cdn.tailwindcss.com",
];
