import { fontFaceCss, tokensCss } from "@open-artifacts/shared";

/**
 * Shared CSS for every server-rendered public-viewer page (`/s/:token` shell, the password form,
 * the "restricted to team members" page, and generic error pages). Inlined as a single
 * `<style nonce>` block by `viewer-shell.ts` — see the CSP built by `buildViewerShellCsp`, which
 * requires every `<style>`/`<script>` on these pages to carry that same nonce (and allows fonts from
 * 'self' only, which is where `/fonts/*` is served).
 *
 * The palette, type and shape tokens are the product's single source of truth
 * (packages/shared/src/design, three-state theme contract included: explicit `data-theme` on
 * `<html>` or none to follow `prefers-color-scheme`); a visitor who is also a logged-in user sees
 * their own theme choice honored here too (see the anti-FOUC inline script in `viewer-shell.ts`).
 *
 * House rules for this file: flat tonal surfaces (no hairlines, no shadows at rest — only popovers
 * float), one corner radius (`--oa-radius`), type no smaller than 13px.
 */
export const VIEWER_CSS = /* css */ `
${fontFaceCss("/fonts/")}
${tokensCss}

* { box-sizing: border-box; }
html, body {
  height: 100%;
  margin: 0;
  font: 15px/1.5 var(--oa-font-sans);
  color: var(--oa-fg);
  background: var(--oa-bg);
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; }
:focus-visible { outline: 2px solid var(--oa-ring); outline-offset: 2px; }
::selection { background: var(--oa-accent); color: var(--oa-accent-fg); }
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}

/* ---- viewer shell: panel + iframe ---- */
body.oa-viewer { display: flex; flex-direction: column; }
/* Deliberately no max-height / overflow on the panel: every popover below is absolutely positioned
   inside it, and any overflow other than "visible" would clip them at the panel's own edge (which
   is exactly how the visibility control's "Apply" button used to end up unreachable). The panel is
   short by construction — one row, plus a details block that only managers can expand. */
.oa-panel {
  flex: 0 0 auto;
  position: relative; /* with z-index, lifts the panel and its popovers above the iframe below */
  z-index: 1;
  background: var(--oa-panel);
}
.oa-panel-row {
  display: flex;
  align-items: center;
  gap: 8px 14px;
  flex-wrap: wrap;
  padding: 10px 16px;
}
.oa-panel-title {
  flex: 1 1 260px;
  min-width: 0; /* required for text-overflow:ellipsis to take effect inside a flex item */
  display: flex;
  align-items: center;
  gap: 10px;
}
.oa-logo {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  transition: transform var(--oa-dur-fast) var(--oa-ease-out);
}
.oa-logo:hover { transform: scale(1.08); }
.oa-logo img { display: block; width: 22px; height: 22px; }
.oa-panel-title h1 {
  flex: 0 1 auto;
  min-width: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.015em;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.oa-kind {
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 500;
  color: var(--oa-accent);
  background: var(--oa-accent-soft);
  border-radius: var(--oa-radius);
  padding: 1px 8px;
}
.oa-meta {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 0;
  padding: 0;
  font-size: 14px;
  color: var(--oa-muted);
}
.oa-meta li { white-space: nowrap; }
/* The inline meta sits in the title row and takes whatever room the title leaves over — it is
   clipped, never wrapped, so the primary row stays exactly one line tall. */
.oa-meta-inline { flex: 1 1 0; min-width: 0; flex-wrap: nowrap; overflow: hidden; }
.oa-meta-inline li { flex: 0 0 auto; }

.oa-actions { margin-left: auto; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.oa-btn {
  appearance: none;
  border: 0;
  background: var(--oa-panel-muted);
  color: var(--oa-fg);
  border-radius: var(--oa-radius);
  min-height: 36px;
  padding: 0 14px;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background-color var(--oa-dur-fast) var(--oa-ease-out), color var(--oa-dur-fast), transform var(--oa-dur-fast) var(--oa-ease-out);
}
.oa-btn:hover { background: var(--oa-accent-soft); }
.oa-btn:active { transform: translateY(1px); }
.oa-btn:disabled { opacity: 0.6; cursor: default; }
.oa-btn-primary { background: var(--oa-accent); color: var(--oa-accent-fg); }
.oa-btn-primary:hover { background: var(--oa-field); color: var(--oa-field-fg); }
.oa-icon-btn { padding: 0 10px; }
.oa-icon { display: inline-flex; flex: 0 0 auto; width: 14px; height: 14px; }
.oa-icon svg { display: block; width: 14px; height: 14px; }
/* Visually hidden, still read by assistive tech (the live region, the "Visibility:" prefix). */
.oa-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* ---- popover: a <details> whose menu is anchored under its OWN trigger ---- */
.oa-pop { position: relative; }
.oa-pop > summary { list-style: none; cursor: pointer; user-select: none; }
.oa-pop > summary::-webkit-details-marker { display: none; }
.oa-pop[open] > summary { background: var(--oa-accent-soft); }
.oa-chip { gap: 6px; }
.oa-chevron { transition: transform 0.15s; }
.oa-pop[open] > summary .oa-chevron { transform: rotate(180deg); }
.oa-pop-menu {
  position: absolute;
  z-index: 2;
  top: calc(100% + 6px);
  right: 0;
  min-width: 240px;
  max-width: min(340px, calc(100vw - 24px));
  max-height: 340px;
  overflow-y: auto; /* the menu scrolls itself; the panel never does */
  padding: 6px;
  background: var(--oa-panel);
  border-radius: var(--oa-radius);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
}
.oa-pop-title {
  margin: 0;
  padding: 6px 8px 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--oa-muted);
}
.oa-pop-menu a {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 8px;
  border-radius: var(--oa-radius);
  font-size: 14px;
  text-decoration: none;
  color: var(--oa-fg);
}
.oa-pop-menu a:hover { background: var(--oa-panel-muted); }
.oa-pop-menu a[aria-current="true"] { background: var(--oa-accent-soft); font-weight: 600; }
.oa-pop-menu .oa-version-msg {
  display: block;
  min-width: 0;
  color: var(--oa-muted);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.oa-versions-more { padding: 6px 8px; font-size: 13px; color: var(--oa-muted); }

/* ---- visibility control ---- */
.oa-mode-menu { min-width: 300px; }
.oa-mode-list { display: flex; flex-direction: column; gap: 2px; }
.oa-mode-opt {
  appearance: none;
  display: grid;
  grid-template-columns: 14px 1fr 14px;
  grid-template-areas: "icon label check" "icon hint check";
  column-gap: 10px;
  align-items: center;
  width: 100%;
  padding: 10px 8px;
  border: 0;
  border-radius: var(--oa-radius);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}
.oa-mode-opt .oa-mode-icon { grid-area: icon; align-self: start; margin-top: 4px; }
.oa-mode-label { grid-area: label; font-weight: 600; }
.oa-mode-hint { grid-area: hint; font-size: 13px; color: var(--oa-muted); }
.oa-mode-check { grid-area: check; visibility: hidden; }
.oa-mode-opt:hover:not([disabled]) { background: var(--oa-panel-muted); }
.oa-mode-opt[aria-checked="true"] { background: var(--oa-accent-soft); }
.oa-mode-opt[aria-checked="true"] .oa-mode-check { visibility: visible; }
.oa-mode-opt[disabled] { opacity: 0.5; cursor: not-allowed; }
/* While a change is in flight the whole list ignores input; the row being saved shows a spinner
   where its checkmark will land. */
.oa-share-mode[data-busy] .oa-mode-opt { pointer-events: none; }
.oa-share-mode[data-busy] .oa-mode-opt:not([data-busy]) { opacity: 0.6; }
.oa-mode-opt[data-busy] .oa-mode-check { visibility: visible; }
.oa-mode-opt[data-busy] .oa-mode-check svg { display: none; }
.oa-mode-opt[data-busy] .oa-mode-check::after {
  content: "";
  width: 12px;
  height: 12px;
  margin: 1px;
  border: 2px solid var(--oa-panel-muted);
  border-top-color: var(--oa-fg);
  border-radius: 50%;
  animation: oa-spin 0.7s linear infinite;
}
@keyframes oa-spin { to { transform: rotate(360deg); } }
.oa-mode-pw { display: flex; gap: 6px; padding: 6px 8px 4px; }
.oa-mode-pw .oa-btn { flex: 0 0 auto; white-space: nowrap; justify-content: center; }
.oa-mode-pw input[type="password"] {
  flex: 1 1 auto;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--oa-border);
  border-radius: var(--oa-radius);
  background: var(--oa-bg);
  color: var(--oa-fg);
  font: inherit;
  font-size: 14px;
}
.oa-pop-status { margin: 0; padding: 4px 8px 2px; font-size: 13px; color: var(--oa-muted); }
.oa-pop-status:empty { display: none; }
.oa-pop-menu .oa-error { margin: 0; padding: 4px 8px 2px; }
/* Native [hidden] already sets display:none, but a later class selector setting display on the
   same element would win on specificity and silently defeat it — this keeps hiding the password
   field robust regardless. */
[hidden] { display: none !important; }

.oa-banner {
  padding: 10px 16px;
  font-size: 14px;
  background: var(--oa-accent-soft);
  color: var(--oa-fg);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.oa-banner a { font-weight: 600; color: var(--oa-accent); }

/* ---- details block (managers only): secondary meta + description, collapsed by default ---- */
.oa-panel-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 16px 12px 48px; /* left edge lines up with the title, past the logo mark */
}
.oa-desc { margin: 0; font-size: 14px; color: var(--oa-muted); }
html[data-oa-panel="collapsed"] .oa-panel-details { display: none; }
.oa-toggle .oa-icon { transition: transform 0.15s; }
html:not([data-oa-panel="collapsed"]) .oa-toggle .oa-icon { transform: rotate(180deg); }

.oa-frame {
  flex: 1 1 auto;
  min-height: 0; /* without this a flex child cannot shrink below its content size, and the
                    iframe pushes the panel off-screen instead of sharing the viewport with it */
  width: 100%;
  border: 0;
  display: block;
  background: var(--oa-bg);
}

/* Progressively drop the least important inline meta instead of wrapping the row. */
@media (max-width: 720px) {
  .oa-meta-inline [data-hide="md"] { display: none; }
}
@media (max-width: 640px) {
  /* On a phone a menu anchored to its trigger would run off the left edge, so every popover drops
     its own positioning context and spans the panel's width just underneath it instead. */
  .oa-pop { position: static; }
  .oa-pop-menu { top: calc(100% + 4px); left: 12px; right: 12px; max-width: none; }
  .oa-panel-details { padding-left: 16px; }
  /* Title on its own line, all actions on one line beneath it, the details toggle pinned right. */
  .oa-actions { flex: 1 1 100%; margin-left: 0; }
  .oa-toggle { margin-left: auto; }
}
@media (max-width: 520px) {
  .oa-meta-inline [data-hide="sm"] { display: none; }
  .oa-panel-row { padding: 10px 12px; }
  /* Keep every action on that one line: drop the chips' chevrons (the menus still open on tap) and
     cap the visibility label (as long as "Password protected" — the icon and the menu still say which). */
  .oa-chip .oa-chevron { display: none; }
  .oa-chip { gap: 4px; }
  #oa-mode-summary-label { max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
  border-radius: var(--oa-radius);
  padding: 32px;
  width: 100%;
  max-width: 380px;
  text-align: left;
}
.oa-card h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.025em; line-height: 1.1; margin: 0 0 12px; }
.oa-card p { font-size: 15px; color: var(--oa-muted); margin: 0 0 20px; }
.oa-card a { color: var(--oa-accent); font-weight: 600; }
.oa-card input[type="password"] {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  margin-bottom: 10px;
  border: 1px solid var(--oa-border);
  border-radius: var(--oa-radius);
  background: var(--oa-bg);
  color: var(--oa-fg);
  font: inherit;
}
.oa-card button { width: 100%; min-height: 44px; justify-content: center; }
/* Not scoped to .oa-card — reused by the visibility control's popup in .oa-panel too. */
.oa-error {
  color: var(--oa-danger);
  font-size: 14px;
  margin: 8px 0 0;
  display: none;
}
.oa-error[data-visible="true"] { display: block; }
`;
