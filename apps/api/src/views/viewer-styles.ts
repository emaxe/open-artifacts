/**
 * Shared CSS for every server-rendered public-viewer page (`/s/:token` shell, the password form,
 * the "restricted to team members" page, and generic error pages). Inlined as a single
 * `<style nonce>` block by `viewer-shell.ts` — see the CSP built by `buildViewerShellCsp`, which
 * requires every `<style>`/`<script>` on these pages to carry that same nonce.
 *
 * Color tokens intentionally mirror `apps/web/src/styles.css`'s `--oa-*` variables and its
 * three-state theme contract (explicit `data-theme="light"|"dark"` on `<html>`, or no attribute to
 * follow `prefers-color-scheme`) — a public viewer page should look like part of the same product,
 * and a visitor who is also a logged-in user sees their own theme choice honored here too (see the
 * anti-FOUC inline script in `viewer-shell.ts` that reads the same `oa_theme` localStorage key).
 */
export const VIEWER_CSS = /* css */ `
:root {
  color-scheme: light;
  --oa-bg: #fafafa;
  --oa-panel: #ffffff;
  --oa-panel-muted: #f4f4f5;
  --oa-border: #e4e4e7;
  --oa-fg: #18181b;
  --oa-muted: #71717a;
  --oa-accent: #111827;
  --oa-accent-fg: #ffffff;
  --oa-danger: #dc2626;
  --oa-ring: #a1a1aa;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --oa-bg: #0a0a0b;
    --oa-panel: #18181b;
    --oa-panel-muted: #232326;
    --oa-border: #2c2c31;
    --oa-fg: #f4f4f5;
    --oa-muted: #a1a1aa;
    --oa-accent: #e4e4e7;
    --oa-accent-fg: #18181b;
    --oa-danger: #f87171;
    --oa-ring: #52525b;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --oa-bg: #0a0a0b;
  --oa-panel: #18181b;
  --oa-panel-muted: #232326;
  --oa-border: #2c2c31;
  --oa-fg: #f4f4f5;
  --oa-muted: #a1a1aa;
  --oa-accent: #e4e4e7;
  --oa-accent-fg: #18181b;
  --oa-danger: #f87171;
  --oa-ring: #52525b;
}

* { box-sizing: border-box; }
html, body {
  height: 100%;
  margin: 0;
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--oa-fg);
  background: var(--oa-bg);
}
a { color: inherit; }
:focus-visible { outline: 2px solid var(--oa-ring); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}

/* ---- viewer shell: panel + iframe ---- */
body.oa-viewer { display: flex; flex-direction: column; }
.oa-panel {
  flex: 0 0 auto;
  position: relative; /* the iframe below creates its own stacking context; without this the
                          <details> version-picker popover would render underneath it */
  z-index: 1;
  border-bottom: 1px solid var(--oa-border);
  background: var(--oa-panel);
  max-height: 40vh;
  overflow-y: auto;
}
.oa-panel-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 14px;
}
.oa-panel-title {
  flex: 1 1 240px;
  min-width: 0; /* required for text-overflow:ellipsis to take effect inside a flex item */
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.oa-panel-title h1 {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.oa-kind {
  flex: 0 0 auto;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--oa-muted);
  border: 1px solid var(--oa-border);
  border-radius: 999px;
  padding: 1px 8px;
}
.oa-meta {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0;
  padding: 0;
  font-size: 12px;
  color: var(--oa-muted);
}
.oa-meta li { white-space: nowrap; }
.oa-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.oa-btn {
  appearance: none;
  border: 1px solid var(--oa-border);
  background: var(--oa-panel-muted);
  color: var(--oa-fg);
  border-radius: 6px;
  padding: 5px 10px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.oa-btn:hover { border-color: var(--oa-ring); }
.oa-btn-primary { background: var(--oa-accent); color: var(--oa-accent-fg); border-color: var(--oa-accent); }

.oa-versions summary {
  list-style: none;
  cursor: pointer;
}
.oa-versions summary::-webkit-details-marker { display: none; }
.oa-versions[open] summary { border-radius: 6px 6px 0 0; }
.oa-versions-menu {
  position: absolute;
  right: 14px;
  margin-top: 4px;
  background: var(--oa-panel);
  border: 1px solid var(--oa-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  min-width: 220px;
  max-height: 280px;
  overflow-y: auto;
  padding: 4px;
}
.oa-versions-menu a {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  text-decoration: none;
  color: var(--oa-fg);
}
.oa-versions-menu a:hover { background: var(--oa-panel-muted); }
.oa-versions-menu a[aria-current="true"] { background: var(--oa-panel-muted); font-weight: 600; }
.oa-versions-menu .oa-version-msg {
  display: block;
  color: var(--oa-muted);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.oa-versions-more { padding: 6px 8px; font-size: 11px; color: var(--oa-muted); }

.oa-banner {
  padding: 6px 14px;
  font-size: 12px;
  background: var(--oa-panel-muted);
  border-bottom: 1px solid var(--oa-border);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Collapsed state: the panel shrinks to a thin strip with just the title and a re-expand
   control — never fully disappears, or the viewer has no way back in. */
html[data-oa-panel="collapsed"] .oa-panel-secondary { display: none; }
html[data-oa-panel="collapsed"] .oa-panel { max-height: none; }
.oa-toggle { margin-left: auto; }

.oa-frame {
  flex: 1 1 auto;
  min-height: 0; /* without this a flex child cannot shrink below its content size, and the
                    iframe pushes the panel off-screen instead of sharing the viewport with it */
  width: 100%;
  border: 0;
  display: block;
  background: #fff;
}

@media (max-width: 480px) {
  .oa-meta li[data-secondary] { display: none; }
  .oa-panel-row { padding: 8px 10px; gap: 8px; }
}

@media print {
  .oa-panel { display: none !important; }
  html, body { height: auto; }
  .oa-frame { height: 100vh; min-height: 100vh; }
}

/* ---- standalone card pages: password form, restricted, generic error ---- */
.oa-page {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}
.oa-card {
  background: var(--oa-panel);
  border: 1px solid var(--oa-border);
  border-radius: 12px;
  padding: 28px;
  width: 100%;
  max-width: 320px;
  text-align: center;
}
.oa-card h1 { font-size: 16px; margin: 0 0 12px; }
.oa-card p { font-size: 13px; color: var(--oa-muted); margin: 0 0 16px; }
.oa-card input[type="password"] {
  width: 100%;
  padding: 8px 10px;
  margin-bottom: 10px;
  border: 1px solid var(--oa-border);
  border-radius: 6px;
  background: var(--oa-bg);
  color: var(--oa-fg);
  font: inherit;
}
.oa-card button { width: 100%; justify-content: center; }
.oa-card .oa-error {
  color: var(--oa-danger);
  font-size: 12px;
  margin: 8px 0 0;
  display: none;
}
.oa-card .oa-error[data-visible="true"] { display: block; }
`;
