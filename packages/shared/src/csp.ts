export interface EmbedCspOptions {
  /** Additional script origins allowed beyond 'unsafe-inline'/'unsafe-eval' (e.g. CDN allowlist from instance settings). */
  scriptAllowlist: string[];
  /** Origin the frame is permitted to be embedded from, e.g. the app's own origin. */
  frameAncestor: string;
}

/**
 * Builds the Content-Security-Policy for the sandboxed artifact-content response (`/embed/:token`).
 * This is the second line of defense after the iframe `sandbox` attribute (which lacks `allow-same-origin`).
 * `connect-src 'none'` blocks fetch/XHR/WebSocket back to the app's API even if same-origin were ever granted.
 */
export function buildEmbedCsp(opts: EmbedCspOptions): string {
  const scriptSrc = ["'unsafe-inline'", "'unsafe-eval'", ...opts.scriptAllowlist].join(" ");
  const directives = [
    "default-src 'none'",
    `script-src ${scriptSrc}`,
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    "img-src data: blob: https:",
    "font-src https://fonts.gstatic.com data:",
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
