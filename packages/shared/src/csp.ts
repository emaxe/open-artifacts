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

export const DEFAULT_CDN_ALLOWLIST = [
  "https://cdnjs.cloudflare.com",
  "https://cdn.jsdelivr.net",
  "https://code.jquery.com",
];
