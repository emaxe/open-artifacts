import type { ArtifactKind, ShareMode } from "@open-artifacts/shared";
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
  /** This share's own id (not the artifact's) — the visibility control PATCHes `/api/v1/shares/:id`. */
  shareId: string;
  shareMode: ShareMode;
  /** Modes the team's policy currently allows choosing; `"public"` is absent when forbidden — see
   *  the visibility control, which renders it anyway as a disabled row rather than hiding it. */
  allowedModes: ShareMode[];
}

export type ViewerShellModel =
  | ({ audience: "anon" } & BaseFields)
  | ({ audience: "member" } & BaseFields & MemberFields)
  | ({ audience: "manager" } & BaseFields & ManagerFields);

type ManagerModel = Extract<ViewerShellModel, { audience: "manager" }>;

const KIND_LABELS: Record<ArtifactKind, string> = {
  html: "HTML",
  markdown: "Markdown",
  svg: "SVG",
  mermaid: "Mermaid",
};

// English-only, like the rest of this shell's chrome — a separate vocabulary from the Russian
// SHARE_MODE_LABELS in apps/web/src/lib/labels.ts, which serves the cabinet UI instead.
const SHARE_MODE_LABELS: Record<ShareMode, string> = {
  team: "Team only",
  password: "Password protected",
  public: "Public",
};

const SHARE_MODE_HINTS: Record<ShareMode, string> = {
  team: "Signed-in members of this team",
  password: "Anyone with the link and the password",
  public: "Anyone with the link",
};

const SHARE_MODE_ICONS: Record<ShareMode, IconName> = {
  team: "users",
  password: "lock",
  public: "globe",
};

/** Row order in the visibility menu: narrowest audience first. */
const SHARE_MODES = ["team", "password", "public"] as const satisfies readonly ShareMode[];

/**
 * Inline 14px stroke icons. Static markup only — never interpolated with server data, and no
 * `style` attributes anywhere (the shell's CSP allows inline styles only via the nonce'd `<style>`).
 */
const ICON_PATHS = {
  users:
    '<circle cx="6" cy="5.5" r="2.5"/><path d="M1.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"/><path d="M10.5 3.2a2.5 2.5 0 0 1 0 4.6"/><path d="M12.5 9.4c1.4.5 2.5 1.7 2.5 3.6"/>',
  lock: '<rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/>',
  globe:
    '<circle cx="8" cy="8" r="6.5"/><path d="M1.5 8h13"/><path d="M8 1.5c2 2 3 4.2 3 6.5s-1 4.5-3 6.5c-2-2-3-4.2-3-6.5s1-4.5 3-6.5z"/>',
  chevron: '<path d="m4 6 4 4 4-4"/>',
  dots: '<circle cx="3.5" cy="8" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="12.5" cy="8" r="1"/>',
  check: '<path d="m3.5 8.5 3 3 6-7"/>',
} as const;

type IconName = keyof typeof ICON_PATHS;

function svg(name: IconName): string {
  const fill = name === "dots" ? "currentColor" : "none";
  return `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false" fill="${fill}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name]}</svg>`;
}

function icon(name: IconName, extraClass = ""): string {
  return `<span class="oa-icon${extraClass ? ` ${extraClass}` : ""}">${svg(name)}</span>`;
}

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
 *
 * The details block is collapsed unless the visitor explicitly opened it before (`oa.viewer.details`
 * = 'open'). That is a fresh key rather than a re-read of the old `oa.viewer.panelCollapsed`, whose
 * meaning was the opposite (expanded by default) — reusing it would flip everyone's saved choice.
 */
const HEAD_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('oa_theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}var open=false;try{open=localStorage.getItem('oa.viewer.details')==='open';}catch(e){}if(!open){document.documentElement.setAttribute('data-oa-panel','collapsed');}})();`;

/**
 * Runs at the end of `<body>` on the viewer shell only. Also contains zero server-supplied data —
 * everything it reads comes from `window.location` or from the DOM it is attached to (including the
 * visibility control's row labels and icons, which it copies rather than duplicating), which is
 * precisely what keeps this script safe to serve alongside artifact/team/user-supplied strings
 * elsewhere on the same page: there is no template hole here for an escaping mistake to land in.
 */
const PANEL_SCRIPT = `(function(){
  var root=document.documentElement;
  var live=document.getElementById('oa-live');
  function announce(msg){
    if(!live)return;
    live.textContent='';
    setTimeout(function(){live.textContent=msg;},30);
  }

  var toggle=document.getElementById('oa-toggle');
  if(toggle){
    var syncToggle=function(){
      var collapsed=root.getAttribute('data-oa-panel')==='collapsed';
      var label=collapsed?'Show details':'Hide details';
      toggle.setAttribute('aria-expanded',String(!collapsed));
      toggle.setAttribute('aria-label',label);
      toggle.setAttribute('title',label);
    };
    syncToggle();
    toggle.addEventListener('click',function(){
      var collapsed=root.getAttribute('data-oa-panel')==='collapsed';
      if(collapsed){root.removeAttribute('data-oa-panel');}else{root.setAttribute('data-oa-panel','collapsed');}
      try{localStorage.setItem('oa.viewer.details',collapsed?'open':'closed');}catch(e){}
      syncToggle();
    });
  }

  // Every popover in the header (versions, visibility, "more") is a <details>; browsers don't
  // auto-close them, so this keeps at most one open, and closes it on an outside click, on Escape
  // (returning focus to its trigger) and when focus moves into the artifact iframe — clicks inside
  // a cross-origin iframe never bubble up to this document, but the window does lose focus.
  var pops=Array.prototype.slice.call(document.querySelectorAll('.oa-pop'));
  pops.forEach(function(d){
    d.addEventListener('toggle',function(){
      if(!d.open)return;
      pops.forEach(function(o){if(o!==d)o.open=false;});
    });
  });
  function closeAll(){pops.forEach(function(d){d.open=false;});}
  document.addEventListener('click',function(e){
    pops.forEach(function(d){if(d.open&&!d.contains(e.target))d.open=false;});
  });
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape')return;
    pops.forEach(function(d){
      if(!d.open)return;
      var hadFocus=d.contains(document.activeElement);
      d.open=false;
      var s=d.querySelector('summary');
      if(hadFocus&&s)s.focus();
    });
  });
  window.addEventListener('blur',function(){
    if(document.activeElement&&document.activeElement.tagName==='IFRAME')closeAll();
  });

  function legacyCopy(text){
    var ta=document.createElement('textarea');
    ta.value=text;
    ta.style.position='fixed';
    ta.style.opacity='0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    var ok=false;
    try{ok=document.execCommand('copy');}catch(e){ok=false;}
    document.body.removeChild(ta);
    return ok;
  }
  var copyBtn=document.getElementById('oa-copy');
  if(copyBtn){
    copyBtn.addEventListener('click',function(e){
      var url=new URL(window.location.href);
      url.search='';
      var text=url.toString();
      function onCopied(){
        e.preventDefault();
        var original=copyBtn.textContent;
        copyBtn.textContent='Copied!';
        announce('Link copied');
        setTimeout(function(){copyBtn.textContent=original;},1500);
      }
      // navigator.clipboard is unavailable on insecure origins (plain HTTP) and its write can
      // also be denied by the browser/embedder — neither surfaces an error, so fall back to
      // execCommand('copy'), and only let the link's own default navigation through if both fail.
      if(navigator.clipboard&&window.isSecureContext){
        navigator.clipboard.writeText(text).then(onCopied).catch(function(){
          if(legacyCopy(text)){onCopied();}
        });
      }else if(legacyCopy(text)){
        onCopied();
      }
    });
  }

  // Visibility control: picking a row saves it straight away (team / public), or — for a password,
  // which the API refuses without one — reveals the password field and saves on "Set password".
  // The panel is updated in place from the row that was clicked; nothing reloads, so the artifact
  // iframe keeps its scroll position and state.
  (function(details){
    if(!details)return;
    var shareId=details.dataset.shareId;
    var rows=Array.prototype.slice.call(details.querySelectorAll('.oa-mode-opt'));
    var pwWrap=details.querySelector('.oa-mode-pw');
    var pwInput=document.getElementById('oa-mode-pw');
    var pwApply=document.getElementById('oa-mode-pw-apply');
    var pwRow=details.querySelector('.oa-mode-opt[data-mode="password"]');
    var statusEl=document.getElementById('oa-mode-status');
    var errEl=document.getElementById('oa-mode-err');
    var sumIcon=document.getElementById('oa-mode-summary-icon');
    var sumLabel=document.getElementById('oa-mode-summary-label');
    var busy=false;

    function enabledRows(){return rows.filter(function(r){return !r.disabled;});}
    function showError(msg){
      errEl.textContent=msg;
      errEl.setAttribute('data-visible','true');
    }
    function clearFeedback(){
      errEl.removeAttribute('data-visible');
      statusEl.textContent='';
    }
    function setBusy(on,row){
      busy=on;
      if(on){details.setAttribute('data-busy','true');}else{details.removeAttribute('data-busy');}
      rows.forEach(function(r){r.removeAttribute('data-busy');});
      if(on&&row)row.setAttribute('data-busy','true');
      pwApply.disabled=on;
      pwInput.disabled=on;
    }
    function onSaved(row){
      setBusy(false);
      rows.forEach(function(r){
        var on=r===row;
        r.setAttribute('aria-checked',String(on));
        r.tabIndex=on?0:-1;
      });
      var label=row.querySelector('.oa-mode-label').textContent;
      sumIcon.replaceChildren(row.querySelector('.oa-mode-icon svg').cloneNode(true));
      sumLabel.textContent=label;
      pwInput.value='';
      pwWrap.hidden=true;
      statusEl.textContent='Visibility updated';
      announce('Visibility changed to '+label);
      setTimeout(function(){
        if(!details.open)return;
        var hadFocus=details.contains(document.activeElement);
        details.open=false;
        if(hadFocus)details.querySelector('summary').focus();
      },900);
    }
    function save(mode,password,row){
      if(busy)return;
      clearFeedback();
      setBusy(true,row);
      statusEl.textContent='Saving\\u2026';
      var payload={mode:mode};
      if(password)payload.password=password;
      function failed(msg){
        setBusy(false);
        statusEl.textContent='';
        showError(msg);
      }
      fetch('/api/v1/shares/'+encodeURIComponent(shareId),{
        method:'PATCH',
        credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),
      }).then(function(res){
        if(res.ok){onSaved(row);return;}
        return res.json().catch(function(){return {};}).then(function(body){
          failed((body&&body.error&&body.error.message)||'Could not change visibility.');
        });
      }).catch(function(){failed('Could not change visibility.');});
    }
    function submitPassword(){
      var value=pwInput.value;
      if(value.length<4){
        showError('Password must be at least 4 characters.');
        pwInput.focus();
        return;
      }
      save('password',value,pwRow);
    }

    rows.forEach(function(r){
      r.addEventListener('click',function(){
        if(busy||r.disabled)return;
        clearFeedback();
        var mode=r.getAttribute('data-mode');
        if(mode==='password'){
          pwWrap.hidden=false;
          pwInput.focus();
          return;
        }
        if(r.getAttribute('aria-checked')==='true')return;
        save(mode,'',r);
      });
      r.addEventListener('focus',function(){
        rows.forEach(function(o){o.tabIndex=o===r?0:-1;});
      });
    });
    pwApply.addEventListener('click',submitPassword);
    pwInput.addEventListener('keydown',function(e){
      if(e.key==='Enter'){e.preventDefault();submitPassword();}
    });
    details.addEventListener('keydown',function(e){
      var list=enabledRows();
      var i=list.indexOf(document.activeElement);
      if(i<0||!list.length)return;
      var next=-1;
      if(e.key==='ArrowDown')next=(i+1)%list.length;
      else if(e.key==='ArrowUp')next=(i-1+list.length)%list.length;
      else if(e.key==='Home')next=0;
      else if(e.key==='End')next=list.length-1;
      if(next<0)return;
      e.preventDefault();
      list[next].focus();
    });
    details.addEventListener('toggle',function(){
      if(details.open){
        var current=details.querySelector('.oa-mode-opt[aria-checked="true"]:not([disabled])')||enabledRows()[0];
        if(current)current.focus();
      }else if(!busy){
        clearFeedback();
        pwInput.value='';
        pwWrap.hidden=true;
      }
    });
  })(document.querySelector('.oa-share-mode'));
})();`;

function documentShell(opts: { title: string; nonce: string; bodyClass?: string; headExtra?: string; body: string }): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${opts.title}</title><style nonce="${opts.nonce}">${VIEWER_CSS}</style><script nonce="${opts.nonce}">${HEAD_BOOT_SCRIPT}</script>${opts.headExtra ?? ""}</head><body${opts.bodyClass ? ` class="${opts.bodyClass}"` : ""}>${opts.body}</body></html>`;
}

function renderVersionPicker(vm: ManagerModel): string {
  const items = vm.versions
    .map((v) => {
      const tag = v.isPinned ? " (pinned)" : v.isCurrent ? " (current)" : "";
      const msg = v.message ? `<span class="oa-version-msg">${escapeHtml(truncate(v.message, 80))}</span>` : "";
      return `<a href="${escapeHtml(v.href)}" aria-current="${v.isActive}"><span>Version ${v.versionNo}${escapeHtml(tag)} — ${escapeHtml(formatDateShort(v.createdAt))}</span>${msg}</a>`;
    })
    .join("");
  const more = vm.versionsTruncated ? `<div class="oa-versions-more">Showing the most recent versions only.</div>` : "";
  return `<details class="oa-pop oa-versions"><summary class="oa-btn oa-chip" title="Switch version"><span>Version ${vm.versionNo}</span>${icon("chevron", "oa-chevron")}</summary><div class="oa-pop-menu oa-versions-menu"><p class="oa-pop-title">Versions</p>${items}${more}</div></details>`;
}

/**
 * Visibility control for a manager: who can open THIS link, changeable in place (same token, same
 * URL — see `PATCH /shares/:id`). The only server data it carries into the DOM is `data-share-id`
 * (escaped) plus `aria-checked` / `tabindex` / `disabled` on its own statically-labelled rows; the
 * handlers that read and submit it live entirely in PANEL_SCRIPT, which per its own docblock must
 * never gain a server-supplied value of its own.
 *
 * A mode the team's policy forbids is rendered as a disabled row (with the reason) rather than
 * hidden, so a manager can see it exists and why it can't be picked.
 */
function renderShareModeControl(vm: ManagerModel): string {
  const isAllowed = (mode: ShareMode) => vm.allowedModes.includes(mode);
  // Roving tabindex: exactly one row is a Tab stop — the current mode, or the first pickable one
  // when the current mode is itself no longer allowed (a disabled row cannot take focus).
  const tabStop = isAllowed(vm.shareMode) ? vm.shareMode : SHARE_MODES.find(isAllowed);

  const rows = SHARE_MODES.map((mode) => {
    const allowed = isAllowed(mode);
    const hint = allowed ? SHARE_MODE_HINTS[mode] : "Disabled for this team";
    return `<button type="button" class="oa-mode-opt" role="menuitemradio" data-mode="${mode}" aria-checked="${mode === vm.shareMode}" tabindex="${mode === tabStop ? 0 : -1}"${allowed ? "" : " disabled"}>${icon(SHARE_MODE_ICONS[mode], "oa-mode-icon")}<span class="oa-mode-label">${escapeHtml(SHARE_MODE_LABELS[mode])}</span><span class="oa-mode-hint">${escapeHtml(hint)}</span>${icon("check", "oa-mode-check")}</button>`;
  }).join("");

  return `<details class="oa-pop oa-share-mode" data-share-id="${escapeHtml(vm.shareId)}">
<summary class="oa-btn oa-chip" title="Who can open this link"><span class="oa-sr-only">Visibility: </span><span class="oa-icon" id="oa-mode-summary-icon">${svg(SHARE_MODE_ICONS[vm.shareMode])}</span><span id="oa-mode-summary-label">${escapeHtml(SHARE_MODE_LABELS[vm.shareMode])}</span>${icon("chevron", "oa-chevron")}</summary>
<div class="oa-pop-menu oa-mode-menu">
<p class="oa-pop-title" id="oa-mode-title">Who can open this link</p>
<div class="oa-mode-list" role="menu" aria-labelledby="oa-mode-title">${rows}</div>
<div class="oa-mode-pw" hidden><input type="password" id="oa-mode-pw" placeholder="New password" aria-label="New password" autocomplete="new-password" maxlength="200"><button type="button" id="oa-mode-pw-apply" class="oa-btn oa-btn-primary">Set password</button></div>
<p class="oa-pop-status" id="oa-mode-status"></p>
<p class="oa-error" id="oa-mode-err" role="alert"></p>
</div>
</details>`;
}

interface SecondaryAction {
  label: string;
  href: string;
  external?: boolean;
}

/**
 * Secondary actions: a single one stays a plain button (a menu of one is just an extra click); two
 * or more collapse into one "more" menu so the primary row keeps room for what matters.
 */
function renderSecondaryActions(actions: SecondaryAction[]): string {
  const attrs = (a: SecondaryAction) => (a.external ? ` target="_blank" rel="noopener noreferrer"` : "");
  if (actions.length === 0) return "";
  if (actions.length === 1) {
    const a = actions[0]!;
    return `<a class="oa-btn" href="${escapeHtml(a.href)}"${attrs(a)}>${escapeHtml(a.label)}</a>`;
  }
  const items = actions.map((a) => `<a class="oa-menu-item" href="${escapeHtml(a.href)}"${attrs(a)}>${escapeHtml(a.label)}</a>`).join("");
  return `<details class="oa-pop oa-more"><summary class="oa-btn oa-icon-btn" aria-label="More actions" title="More actions">${icon("dots")}</summary><div class="oa-pop-menu oa-more-menu">${items}</div></details>`;
}

export function renderViewerShell(vm: ViewerShellModel, nonce: string): string {
  const kindLabel = KIND_LABELS[vm.kind];
  const escapedTitle = escapeHtml(vm.title);

  // Primary meta rides in the title row and is clipped rather than wrapped; `data-hide` marks what
  // the stylesheet drops first as the viewport narrows. A manager already sees the version on its
  // picker chip, so it isn't repeated here.
  const primaryMeta: string[] = [];
  if (vm.audience !== "manager") primaryMeta.push(`<li>Version ${vm.versionNo}</li>`);
  primaryMeta.push(
    `<li data-hide="sm"><time datetime="${vm.versionDate.toISOString()}" title="${escapeHtml(formatDateTime(vm.versionDate))}">${escapeHtml(formatDateShort(vm.versionDate))}</time></li>`,
  );
  if (vm.audience === "member" || vm.audience === "manager") {
    primaryMeta.push(`<li data-hide="md">By ${escapeHtml(vm.authorName)}</li>`, `<li data-hide="md">${escapeHtml(vm.orgName)}</li>`);
  }

  const secondary: SecondaryAction[] = [{ label: "Download source", href: vm.downloadHref }];
  if ((vm.audience === "member" || vm.audience === "manager") && vm.cabinetHref) {
    secondary.push({ label: "Open in workspace", href: vm.cabinetHref, external: true });
  }

  const actions: string[] = [];
  if (vm.audience === "manager") {
    actions.push(renderShareModeControl(vm), renderVersionPicker(vm));
  }
  actions.push(`<a id="oa-copy" class="oa-btn" href="${escapeHtml(vm.canonicalHref)}">Copy link</a>`);
  actions.push(renderSecondaryActions(secondary));

  // Only a manager has anything to expand (size, views, expiry, version note, description), so only
  // a manager gets the details block and its toggle; anon/member panels are a single fixed row.
  let details = "";
  if (vm.audience === "manager") {
    const detailMeta: string[] = [
      `<li>${formatBytes(vm.sizeBytes)}</li>`,
      `<li>${vm.viewCount} view${vm.viewCount === 1 ? "" : "s"}</li>`,
      `<li>${vm.expiresAt ? `Expires ${escapeHtml(formatDateShort(vm.expiresAt))}` : "Never expires"}</li>`,
    ];
    if (vm.versionMessage) detailMeta.push(`<li>“${escapeHtml(truncate(vm.versionMessage, 120))}”</li>`);
    const description = vm.description ? `<p class="oa-desc">${escapeHtml(truncate(vm.description, 200))}</p>` : "";
    details = `<div class="oa-panel-details" id="oa-panel-body"><ul class="oa-meta">${detailMeta.join("")}</ul>${description}</div>`;
    actions.push(
      `<button type="button" id="oa-toggle" class="oa-btn oa-icon-btn oa-toggle" aria-expanded="false" aria-controls="oa-panel-body" aria-label="Show details" title="Show details">${icon("chevron")}</button>`,
    );
  }

  const notice =
    vm.audience === "manager" && vm.nonDefaultNotice
      ? `<div class="oa-banner">You're viewing an older version — visitors of this link see the current one. <a href="${escapeHtml(vm.nonDefaultNotice.canonicalHref)}">Back to the shared version</a></div>`
      : "";

  const body = `${notice}<header class="oa-panel">
<div class="oa-panel-row">
<div class="oa-panel-title"><a class="oa-logo" href="/" aria-label="Open Artifacts home"><img src="/brand/logo-mark.png" alt="" width="18" height="18"></a><h1 title="${escapedTitle}">${escapedTitle}</h1><span class="oa-kind">${kindLabel}</span><ul class="oa-meta oa-meta-inline">${primaryMeta.join("")}</ul></div>
<div class="oa-actions">${actions.join("")}</div>
</div>
${details}
<span id="oa-live" class="oa-sr-only" role="status" aria-live="polite"></span>
</header>
<iframe class="oa-frame" title="Shared artifact content" src="${escapeHtml(vm.embedSrc)}" sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"></iframe>
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
