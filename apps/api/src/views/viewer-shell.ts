import type { ArtifactKind } from "@open-artifacts/shared";
import { escapeHtml, truncate } from "../services/html.js";
import { VIEWER_CSS } from "./viewer-styles.js";

/**
 * `manager` = full write access (`resolveOrgArtifactAccess.write`): the artifact's owner, an
 * owner/admin of its team, or a superadmin. `member` = logged in and a member (any role) of the
 * artifact's team, but without write access. `anon` = everyone else (including a logged-in user
 * from an unrelated team). This is a property of the VIEWER, never of the share's own mode — a
 * team member sees the `member` panel on a `public` share too, not only on a `team` share.
 *
 * Modeled as a discriminated union rather than optional fields on purpose: `vm.manage` on an
 * `anon`-branch is a compile error, not an accidentally-rendered leak. A future edit to this
 * template that tries to read a manager-only field from the wrong branch fails to typecheck
 * instead of shipping author names to anonymous visitors.
 */
export type ViewerAudience = "anon" | "member" | "manager";

export interface ViewerVersionEntry {
  versionNo: number;
  createdAt: Date;
  message: string | null;
  isCurrent: boolean;
  isPinned: boolean;
  isActive: boolean;
  href: string;
}

interface BaseFields {
  title: string;
  kind: ArtifactKind;
  /** The version number actually rendered in the iframe right now — never the total version count. */
  versionNo: number;
  /** The DISPLAYED version's own `createdAt` — deliberately not `artifacts.updatedAt`, which also
   *  moves on metadata-only edits and, on a pinned share, would announce "a newer version exists"
   *  to a viewer who was deliberately not given it. */
  versionDate: Date;
  embedSrc: string;
  downloadHref: string;
  /** The share URL with no `?v=` — what "Copy link" always copies, regardless of what's on screen. */
  canonicalHref: string;
}

interface MemberFields {
  authorName: string;
  orgName: string;
  /** Null when this member lacks read access to a `private` artifact they weren't the owner of
   *  (possible on a `team` share, which grants membership-based access independent of the
   *  visibility matrix) — a link into the cabinet would just 403 for them. */
  cabinetHref: string | null;
}

interface ManagerFields extends MemberFields {
  cabinetHref: string;
  description: string | null;
  versionMessage: string | null;
  sizeBytes: number;
  expiresAt: Date | null;
  viewCount: number;
  versions: ViewerVersionEntry[];
  versionsTruncated: boolean;
  /** Set when `?v=` resolved to something other than the share's default (current/pinned) version. */
  nonDefaultNotice: { canonicalHref: string } | null;
}

export type ViewerShellModel =
  | ({ audience: "anon" } & BaseFields)
  | ({ audience: "member" } & BaseFields & MemberFields)
  | ({ audience: "manager" } & BaseFields & ManagerFields);

const KIND_LABELS: Record<ArtifactKind, string> = {
  html: "HTML",
  markdown: "Markdown",
  svg: "SVG",
  mermaid: "Mermaid",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  // Round to one decimal below 10 (e.g. "2.5 KB") and to a whole number at or above it (e.g. "128
  // KB") — using a numeric round (not `toFixed`) so a whole value like "2 KB" doesn't print "2.0".
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[i]}`;
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(d: Date): string {
  return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Runs in `<head>`, before first paint, on every public-viewer page — the classic anti-FOUC
 * pattern. Deliberately contains zero server-supplied data: it only ever reads two well-known
 * localStorage keys and mirrors the exact contract `apps/web/src/lib/theme.tsx` uses for
 * `oa_theme`, so a visitor who is also a logged-in user of the product sees their own theme choice
 * honored here too, with no flash of the wrong theme.
 */
const HEAD_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('oa_theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}try{if(localStorage.getItem('oa.viewer.panelCollapsed')==='1'){document.documentElement.setAttribute('data-oa-panel','collapsed');}}catch(e){}})();`;

/**
 * Runs at the end of `<body>` on the viewer shell only. Also contains zero server-supplied data —
 * both behaviors read only `window.location`/the DOM, which is precisely what keeps this script
 * safe to serve alongside artifact/team/user-supplied strings elsewhere on the same page: there is
 * no template hole here for an escaping mistake to land in.
 */
const PANEL_SCRIPT = `(function(){
  var toggle=document.getElementById('oa-toggle');
  function sync(){
    var collapsed=document.documentElement.getAttribute('data-oa-panel')==='collapsed';
    if(toggle){toggle.setAttribute('aria-expanded',String(!collapsed));toggle.textContent=collapsed?'Expand panel':'Collapse panel';}
  }
  sync();
  if(toggle){
    toggle.addEventListener('click',function(){
      var collapsed=document.documentElement.getAttribute('data-oa-panel')==='collapsed';
      if(collapsed){document.documentElement.removeAttribute('data-oa-panel');}else{document.documentElement.setAttribute('data-oa-panel','collapsed');}
      try{localStorage.setItem('oa.viewer.panelCollapsed',collapsed?'0':'1');}catch(e){}
      sync();
    });
  }
  var copyBtn=document.getElementById('oa-copy');
  if(copyBtn&&navigator.clipboard){
    copyBtn.addEventListener('click',function(e){
      e.preventDefault();
      var url=new URL(window.location.href);
      url.search='';
      navigator.clipboard.writeText(url.toString()).then(function(){
        var original=copyBtn.textContent;
        copyBtn.textContent='Copied!';
        setTimeout(function(){copyBtn.textContent=original;},1500);
      }).catch(function(){});
    });
  }
})();`;

function documentShell(opts: { title: string; nonce: string; bodyClass?: string; headExtra?: string; body: string }): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${opts.title}</title><style nonce="${opts.nonce}">${VIEWER_CSS}</style><script nonce="${opts.nonce}">${HEAD_BOOT_SCRIPT}</script>${opts.headExtra ?? ""}</head><body${opts.bodyClass ? ` class="${opts.bodyClass}"` : ""}>${opts.body}</body></html>`;
}

function renderVersionPicker(vm: Extract<ViewerShellModel, { audience: "manager" }>): string {
  const items = vm.versions
    .map((v) => {
      const tag = v.isPinned ? " (pinned)" : v.isCurrent ? " (current)" : "";
      const msg = v.message ? `<span class="oa-version-msg">${escapeHtml(truncate(v.message, 80))}</span>` : "";
      return `<a href="${escapeHtml(v.href)}" aria-current="${v.isActive}"><span>Version ${v.versionNo}${escapeHtml(tag)} — ${escapeHtml(formatDateShort(v.createdAt))}</span>${msg}</a>`;
    })
    .join("");
  const more = vm.versionsTruncated ? `<div class="oa-versions-more">Showing the most recent versions only.</div>` : "";
  return `<details class="oa-versions"><summary class="oa-btn">Version ${vm.versionNo} ▾</summary><div class="oa-versions-menu">${items}${more}</div></details>`;
}

export function renderViewerShell(vm: ViewerShellModel, nonce: string): string {
  const kindLabel = KIND_LABELS[vm.kind];
  const escapedTitle = escapeHtml(vm.title);

  const metaItems: string[] = [
    `<li>Version ${vm.versionNo}</li>`,
    `<li><time datetime="${vm.versionDate.toISOString()}" title="${escapeHtml(formatDateTime(vm.versionDate))}">${escapeHtml(formatDateShort(vm.versionDate))}</time></li>`,
  ];
  if (vm.audience === "member" || vm.audience === "manager") {
    metaItems.push(`<li>By ${escapeHtml(vm.authorName)}</li>`, `<li>${escapeHtml(vm.orgName)}</li>`);
  }
  if (vm.audience === "manager") {
    metaItems.push(
      `<li data-secondary>${formatBytes(vm.sizeBytes)}</li>`,
      `<li data-secondary>${vm.viewCount} view${vm.viewCount === 1 ? "" : "s"}</li>`,
      `<li data-secondary>${vm.expiresAt ? `Expires ${escapeHtml(formatDateShort(vm.expiresAt))}` : "Never expires"}</li>`,
    );
    if (vm.versionMessage) metaItems.push(`<li data-secondary>“${escapeHtml(truncate(vm.versionMessage, 120))}”</li>`);
  }

  const actions: string[] = [];
  if (vm.audience === "manager") actions.push(renderVersionPicker(vm));
  actions.push(`<a id="oa-copy" class="oa-btn" href="${escapeHtml(vm.canonicalHref)}">Copy link</a>`);
  actions.push(`<a class="oa-btn" href="${escapeHtml(vm.downloadHref)}">Download source</a>`);
  if ((vm.audience === "member" || vm.audience === "manager") && vm.cabinetHref) {
    actions.push(`<a class="oa-btn" href="${escapeHtml(vm.cabinetHref)}" target="_blank" rel="noopener noreferrer">Open in workspace</a>`);
  }
  actions.push(
    `<button type="button" id="oa-toggle" class="oa-btn oa-toggle" aria-expanded="true" aria-controls="oa-panel-body">Collapse panel</button>`,
  );

  const notice =
    vm.audience === "manager" && vm.nonDefaultNotice
      ? `<div class="oa-banner">You're viewing an older version — visitors of this link see the current one. <a href="${escapeHtml(vm.nonDefaultNotice.canonicalHref)}">Back to the shared version</a></div>`
      : "";

  const description =
    vm.audience === "manager" && vm.description
      ? `<div class="oa-banner oa-panel-secondary">${escapeHtml(truncate(vm.description, 200))}</div>`
      : "";

  const body = `${notice}<header class="oa-panel">
<div class="oa-panel-row">
<div class="oa-panel-title"><h1 title="${escapedTitle}">${escapedTitle}</h1><span class="oa-kind">${kindLabel}</span></div>
<div class="oa-actions">${actions.join("")}</div>
</div>
<div class="oa-panel-row oa-panel-secondary" id="oa-panel-body"><ul class="oa-meta">${metaItems.join("")}</ul></div>
${description}
</header>
<iframe class="oa-frame" title="Shared artifact content" src="${escapeHtml(vm.embedSrc)}" sandbox="allow-scripts allow-forms allow-popups allow-modals"></iframe>
<script nonce="${nonce}">${PANEL_SCRIPT}</script>`;

  return documentShell({ title: escapedTitle, nonce, bodyClass: "oa-viewer", body });
}

export function renderPasswordFormPage(nonce: string): string {
  const script = `document.getElementById('f').addEventListener('submit', function (e) {
  e.preventDefault();
  var password = document.getElementById('pw').value;
  var err = document.getElementById('err');
  fetch(window.location.pathname + '/unlock', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: password }),
  }).then(function (res) {
    if (res.ok) { window.location.reload(); } else { err.setAttribute('data-visible', 'true'); }
  }).catch(function () { err.setAttribute('data-visible', 'true'); });
});`;
  const body = `<div class="oa-page"><div class="oa-card">
<h1>Password required</h1>
<p>This shared artifact is protected. Enter the password to view it.</p>
<form id="f">
<input type="password" id="pw" placeholder="Password" autofocus autocomplete="current-password" />
<button type="submit" class="oa-btn oa-btn-primary">Unlock</button>
<p class="oa-error" id="err">Incorrect password.</p>
</form>
</div></div>`;
  return documentShell({ title: "Password required", nonce, headExtra: `<script nonce="${nonce}">${script}</script>`, body });
}

export function renderRestrictedPage(loginHref: string, nonce: string): string {
  const body = `<div class="oa-page"><div class="oa-card">
<h1>Members only</h1>
<p>This link is only available to members of that team. Ask whoever shared it to invite you, <a href="${escapeHtml(loginHref)}">log in as someone else</a>, or go to your workspace.</p>
</div></div>`;
  return documentShell({ title: "Restricted", nonce, body });
}

export function renderErrorPage(message: string, nonce: string): string {
  const body = `<div class="oa-page"><div class="oa-card"><p>${escapeHtml(message)}</p></div></div>`;
  return documentShell({ title: "Unavailable", nonce, body });
}
