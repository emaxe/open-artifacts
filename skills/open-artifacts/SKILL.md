---
name: open-artifacts
description: Publish HTML/Markdown/Mermaid/SVG content to a self-hosted Open Artifacts instance and get back a shareable link, in the team's configured default mode. Use when you've generated a report, dashboard, diagram, or any standalone document and need to hand a human a URL instead of pasting raw content into chat.
---

# Open Artifacts

Open Artifacts is a self-hosted alternative to Claude Artifacts: any AI agent can publish HTML,
Markdown, Mermaid, or SVG content to it and get back a URL a human can open in a browser. Content
renders in a sandboxed iframe (no access to the host page, no network access out), so it's safe to
publish agent-generated content without a security review.

## Link modes

A share link comes in one of three modes. Which one you get when you don't ask for a specific one
is decided by the team's own settings, not by you — see below.

- **`team`** — only someone logged in and a member of the artifact's team can open it. No password
  needed; the URL alone is safe to paste into a team chat.
- **`password`** — anyone with the URL *and* the password can open it, logged in or not.
- **`public`** — anyone with the URL can open it, no login or password. A team or the instance may
  disable this mode entirely, in which case creating one fails with `public_shares_forbidden`.

**If you don't name a mode, the server picks the team's configured default** — that is correct
behavior in almost every case; don't second-guess it or try to work around it. Only name a specific
mode when the human asked for that kind of link — "send this to someone outside the team", "make it
public", "put a password on it", or similar. If a `public` request comes back
`public_shares_forbidden`, that's team/instance policy working as intended: relay it to the human
and offer a `team` or `password` link instead, rather than treating it as a bug to route around.

## Setup

Do this check at the start of every session before running any other `oa` command — don't assume
it's installed just because it was there last time.

**1. Check whether the CLI is already installed:**
```bash
command -v oa >/dev/null 2>&1 && oa --version
```
If that prints a version, skip to step 3. If it prints nothing / "command not found", install it:
```bash
npm install -g @emaxe/oa
```
(No npm on this machine? See the "no CLI available" note at the bottom of this file instead of
trying to install Node — use the raw HTTP reference.)

**2. Re-check after installing:**
```bash
command -v oa >/dev/null 2>&1 && oa --version
```
If this still fails, npm's global bin directory likely isn't on `PATH` — check `npm config get
prefix` and add `<prefix>/bin` to `PATH`, or fall back to the raw HTTP reference.

**3. Check whether you're already authenticated** (don't make the human re-approve a device flow
they already completed):
```bash
oa whoami
```
If this succeeds ("Token is valid."), you're done — skip straight to the recipes below. If it
fails (`Not logged in...` or `key_expired`), authenticate:
```bash
oa login --server https://artifacts.your-company.com
```
`oa login` starts a device-flow authorization: it prints a code and a URL, a human opens the URL
in their browser, logs in, and approves. By default this issues a **personal key** — it works
across every team the human belongs to, not just one, so there's no team to pick at this step. The
CLI saves credentials to `~/.config/open-artifacts/credentials.json` (mode 600) — no need to repeat
this per session. If a URL isn't reachable interactively, ask the human to run `oa login` for you
once and confirm it succeeded before continuing.

Alternative: if `OA_TOKEN` (and optionally `OA_SERVER`) is already set in the environment, the CLI
uses it directly and skips both the install-check's login step and the device flow entirely —
check for that first if you're running somewhere env vars are the normal way secrets are injected.

**4. Pick a team for this project** (only matters if the key spans more than one — most `oa push`/
`oa list` calls need to know which team to act on):
```bash
oa orgs
```
Lists every team the key can act in, with a `*` next to whichever is currently selected for this
project. If there's exactly one, nothing else to do — it's used automatically. If there's more than
one and none is selected yet, **show the human the list from `oa orgs` and ask which team to use —
never guess.** Once they answer:
```bash
oa use <team-slug>
```
This writes `.oa.json` next to the project (no secrets in it — safe to commit) so the choice
persists across sessions. Override per invocation with `oa push --org <team-slug>` without changing
the saved default.

## Recipes

**Publish something new and share it (link mode: the team's default — see "Link modes" above):**
```bash
oa push report.html --title "Q3 Revenue Report" --share
# -> prints the artifact id and a share URL, e.g.:
# Share URL: https://.../s/abc123  (mode: team — only logged-in team members can open it)
```

**Update something you already published** (creates a new version, doesn't overwrite history):
```bash
oa push report.html --id <artifact-id> --message "Fixed the Q3 numbers"
```

**The human asked for a specific kind of link instead of the default:**
```bash
oa share <artifact-id> --team                        # only logged-in team members
oa share <artifact-id> --password "correct horse" --expires 7d   # anyone with URL + password
oa share <artifact-id> --public                       # anyone with the URL — only if explicitly asked
```
`--team`/`--public`/`--password` also work on `oa push` (e.g. `oa push report.html --public`).
A `public` request can be refused with `public_shares_forbidden` if the team or instance disallows
it — see "Link modes" above for what to do then.

**Publish with a lifetime shorter than the team default** (the content is hard-deleted once it
expires — there's no undo):
```bash
oa push report.html --lifetime 12h
# omit --lifetime to get the team's default, which is also its maximum
```

**See what you've already published:**
```bash
oa list
```

**Fetch an artifact's current content back (e.g. to edit it):**
```bash
oa get <artifact-id> -o report.html
```

Every command supports `--json` for machine-readable output when you need to parse the result
rather than show it to a human.

## Content kinds

- `html` — a self-contained HTML file: inline `<style>`/`<script>`, no relative-path assets of your
  own. An artifact CAN have real image/file attachments — see "Files: images and attachments"
  below — but they're uploaded separately and referenced by an absolute `/af/...` URL the server
  gives you back, never by a bundled sibling file.
  Default if you don't pass `--kind` and the file extension isn't recognized.
- `markdown` — rendered server-side to HTML.
- `mermaid` — a raw Mermaid diagram definition, rendered client-side.
- `svg` — rendered directly.

`oa push` infers the kind from the file extension (`.html`, `.md`, `.mmd`/`.mermaid`, `.svg`);
override with `--kind` if the extension doesn't match.

## Files: images and attachments

An artifact can have real binary files attached to it — a logo, a screenshot, a downloadable
asset — stored in the instance's own object storage rather than embedded as a base64 `data:` URI
in the HTML. **Not every instance has this configured.** Check first:

```bash
oa quota                        # team-wide remaining quota
oa quota --artifact <artifact-id>   # narrows to that artifact's own remaining quota too
```

If the response says storage is disabled, don't attempt an upload — fall back to inlining the
asset (a small image as a `data:` URI, which `img-src` already allows) or tell the human an admin
needs to configure object storage. Otherwise, decide whether to upload based on `maxFileBytes` and
the remaining `availableBytes` in the quota response (`null` means unlimited) — an agent is
expected to make this call itself, not upload blindly and handle the failure after the fact.

**Create the artifact first, then attach files to it, then reference their URLs in an update:**

```bash
oa push draft.html                              # create the artifact, note its id
oa files upload <artifact-id> ./logo.png        # prints: URL: http://<server>/af/<token>
# edit draft.html, replacing a placeholder with <img src="http://<server>/af/<token>">
oa push draft.html --id <artifact-id>           # push the version that references it
```

The URL is absolute and works from anywhere the artifact is rendered (any share link, the authed
preview) — it isn't tied to one specific share. `oa files ls <artifact-id>` lists what's attached
(with sizes); `oa files rm <artifact-id> <file-id>` removes one. Deleting the artifact deletes its
files too — there's no way to keep an orphaned file around, and no separate cleanup step needed.

A file's `Content-Type` decides how it's served: images/audio/video/fonts render inline (usable
directly in `<img src>`/`<video src>`/etc.); everything else — notably `.html` and `.svg` files —
is always forced to download as `application/octet-stream`, never executed from the file's own
URL. Don't try to attach an executable HTML fragment as a "file" and load it inline; if you need
programmatic content, put it in the artifact's own `content` instead.

Uploading is a binary/multipart operation, so it's **CLI/REST only** — see "If you're an MCP
client instead" below for what MCP can and can't do here.

## Design: read a template before you write

Published artifacts are read by humans in a browser, so the design is part of the deliverable, not
a polish pass. **Before you write the first line of markup, open and read the matching files below
— they are plain Markdown files in this skill's own directory, next to this `SKILL.md`.** Read
`references/design/DESIGN-core.md` first (tokens, theming, responsive/print/accessibility rules,
the pre-publish checklist), then the one theme file from the table that matches what you're about
to publish. Don't write the page and restyle it afterwards — the template decides the page's
structure, not just its colors. If you already read them earlier in this session, don't re-read.

If your tool resolves relative paths from somewhere other than this file's directory, locate them
once with: `find . ~/.claude ~/.config ~/.cursor -path '*open-artifacts/references/design/*.md' 2>/dev/null | head`

| What you're about to publish | Read (after `DESIGN-core.md`) |
|---|---|
| KPI tiles, metrics, charts, dense or sortable tables, an analytics summary | `references/design/DESIGN-data.md` |
| Long-form prose: research note, post-mortem, RFC, spec, runbook, API reference | `references/design/DESIGN-document.md` |
| Landing or launch page, feature announcement, pitch, slide deck | `references/design/DESIGN-promo.md` |
| Architecture, flow, sequence or ER diagram — and every `mermaid` or `svg` artifact | `references/design/DESIGN-diagram.md` |
| A mix (e.g. a report with a dashboard section) | the dominant one, then borrow the chart component from `DESIGN-data.md` |
| `kind: markdown` | nothing — the server styles it. Write good structure (headings, tables, fenced code) and stop. |
| A throwaway snippet nobody will read twice | `DESIGN-core.md` alone is enough |

## What can run inside an html artifact (CSP)

`html` artifacts render in an iframe with a strict Content-Security-Policy — not a normal page.
Two rules decide what works:

1. **`script-src`** only allows inline `<script>` blocks plus a fixed CDN allowlist (default:
   `cdnjs.cloudflare.com`, `cdn.jsdelivr.net`, `code.jquery.com`, `cdn.tailwindcss.com` — an admin
   can extend this in Admin Settings, but don't assume a host beyond these four is allowed).
2. **`connect-src 'none'`** — the page can never `fetch`/`XHR`/open a `WebSocket` at runtime, to
   itself or anywhere else. Any data the page needs (chart datasets, table rows, JSON) must be
   embedded inline in the HTML at publish time, not loaded on load.
3. **`style-src`** only allows inline `<style>`/`style="..."` plus `fonts.googleapis.com`. A
   library's separate CSS file from a CDN will be silently blocked — inline the CSS yourself
   (fetch its text and paste it into a `<style>` tag) or pick a library that needs no external CSS.
4. **`img-src`** is open (`data:`, `blob:`, `https:`) — unlike scripts/styles, images and textures
   (e.g. three.js texture maps) can load directly from any `https://` URL at runtime, including
   this instance's own `/af/<token>` file URLs (see "Files: images and attachments" above).

Practical recipe: load each library as a `<script src="https://cdnjs.cloudflare.com/ajax/libs/
<lib>/<exact-version>/<file>">` (cdnjs preferred; jsdelivr as fallback — `https://cdn.jsdelivr.net/
npm/<pkg>@<exact-version>/dist/<file>`), pick the **UMD/browser build** that defines a global (not
an ES module import, and never `unpkg.com`/`esm.sh` — both are blocked), pin an **exact version**,
and place that `<script>` tag before any inline `<script>` that uses the global. Never assume a
library exists on the CDN — if you're not sure of the exact path/version, don't guess.

- **Tailwind CSS**: `<script src="https://cdn.tailwindcss.com"></script>` (the Play CDN — it
  injects its own `<style>`, no separate stylesheet needed). Optional config before you use
  classes: `<script>tailwind.config = { theme: { extend: { /* ... */ } } }</script>`. Prefer the
  plain-CSS token system in `references/design/DESIGN-core.md` instead: the Play CDN is a
  runtime JIT compiler, so it costs a visible flash-of-unstyled-content and turns a share link that
  should work for months into one more dependent on a CDN being reachable. Reach for it only when
  the human explicitly asks for Tailwind, or you're porting markup that already uses it.
- **Charts**: Chart.js (`cdnjs.cloudflare.com/ajax/libs/Chart.js/<version>/chart.umd.min.js`), D3
  (`.../d3/<version>/d3.min.js`), or ECharts (`.../echarts/<version>/echarts.min.js`) — all ship a
  CSS-free UMD build, so no stylesheet problem.
- **Tables**: prefer a plain `<table>` styled with the token-based CSS from
  `references/design/DESIGN-core.md`/`DESIGN-data.md` — it sidesteps the external-CSS restriction
  entirely. If a grid library is genuinely needed (e.g. Grid.js), its companion CSS file must be
  inlined into a `<style>` tag by hand; don't link it from the CDN.
- **Diagrams**: if the whole artifact *is* a diagram, publish it as `kind: "mermaid"` instead (the
  server renders it, no CSP concerns). To mix a diagram into a larger `html` page, load
  `mermaid.js` as a UMD script from cdnjs/jsdelivr and call `mermaid.initialize({ startOnLoad:
  true })` the same way the server-rendered `mermaid` kind does internally.
- **3D / three.js**: load the UMD build (`three.min.js`) plus any addons (`OrbitControls.js`, etc.)
  as separate pinned `<script>` tags in dependency order; textures can be fetched live from
  `https://` URLs (`img-src` allows it) even though `connect-src` blocks everything else.

If a script silently fails to run in the published artifact (blank canvas, "X is not defined"),
suspect CSP first — check the CDN host is in the allowlist above and that you loaded a UMD build,
not an ESM one.

## Errors you'll hit and what to do

| Error | Meaning | What to do |
|---|---|---|
| `key_expired` (401) | Your API key's TTL ran out | Run `oa login` again |
| `key_revoked` (401) | A human revoked your key | Ask them to issue a new one, or `oa login` again |
| `org_required` (400) | Your personal key spans several teams and none is selected | The response includes the candidate list — show it to the human and ask which team, then `oa use <slug>` (see Setup step 4). Don't pick one yourself. |
| `forbidden` (403) | Missing scope, or no access to that org/artifact | Check `oa whoami`; you may need a key with `artifacts:write` |
| `quota_exceeded` (413) | The team or artifact hit its storage quota (source text + uploaded files) | The body carries `scope` (`"org"` or `"artifact"`), `limitBytes`, `usedBytes` — run `oa quota` to see the current state. A team owner/admin can raise the per-artifact quota themselves; the team-wide one needs a superadmin. |
| `artifact_too_large` (413) | A single artifact's own source text exceeds the size cap (default 5 MiB) | Split the content or reduce it — this is separate from the file-storage quota above and has no per-artifact override |
| `storage_disabled` (501) | This instance has no object storage configured | Don't retry the upload — inline the asset instead, or tell the human an admin needs to set `S3_BUCKET` |
| `file_too_large` (413) | One uploaded file exceeds the per-file cap (default 25 MiB, independent of the quota above) | Check `maxFileBytes` from `oa quota` before uploading a large file |
| `version_conflict` (409) | Someone else changed this artifact since you last read it | `oa get <id>` to see the latest, merge your change, retry |
| `lifetime_exceeds_max` (400) | The requested `--lifetime`/`lifetime` is longer than the instance/team maximum | The error body carries `maxLifetimeMinutes` — retry within that bound, or omit `--lifetime` to get the default (which is also the max) |
| `public_shares_forbidden` (403) | A `public` link was requested but the team or instance disallows public links | The error carries `allowedModes` — retry with `--team`/`--password`, or omit the mode flag to use the team default. Tell the human why, don't route around it. |

If you don't have the CLI available (no Node/npm), see `references/api.md` for raw HTTP/curl
examples covering the same operations.

## If you're an MCP client instead of a shell-based agent

The instance also runs an MCP server directly — no CLI needed. Connect to `<server>/mcp` (Streamable
HTTP) with the same API key as a Bearer token, and use its tools instead of shelling out to `oa`:
`whoami`, `list_orgs`, `list_artifacts`, `get_artifact`, `create_artifact`, `update_artifact`,
`delete_artifact`, `get_storage_quota`, `list_artifact_files`, `delete_artifact_file`,
`create_share`, `list_shares`, `revoke_share`. Same scopes, same error semantics as the table above
— just called as MCP tools rather than CLI commands.
`create_artifact`/`update_artifact` take an optional `lifetime` argument (minutes, or a duration
like `"12h"`/`"7d"`) mirroring `oa push --lifetime`; omit it to get the team's default/maximum.

**Uploading a file is not available over MCP** (it's a binary/multipart operation; MCP tool calls
here are JSON-only) — `get_storage_quota` still lets you check remaining quota before deciding
whether an upload would be worth doing, and `list_artifact_files`/`delete_artifact_file` manage
files someone else already uploaded via the CLI or REST. If you need to attach a file and only have
MCP available, tell the human to run `oa files upload <artifact-id> <file>` themselves and give you
the URL it prints back.

`create_share`'s `mode` argument is optional, same rule as the CLI's `--share` with no mode flag:
omit it to get the team's configured default (usually `team`), and only pass `"team"`, `"password"`,
or `"public"` when the human asked for that specific kind of link. The result echoes back the mode
that was actually used — check it rather than assuming. A `"public"` request can come back as the
tool error `public_shares_forbidden` (with `allowedModes` in the body) if that's disallowed; relay
it to the human instead of retrying with a different mode on your own judgment.

A personal key spans every team it belongs to, same as with the CLI. `list_artifacts` and
`create_artifact` take an optional `orgId` argument; omit it and the connection's default (set via
`?orgId=` in the MCP server URL in your `.mcp.json`) is used, or the sole team if there's only one.
With neither, the tool returns `org_required` with the candidate list in its error text — call
`list_orgs`, show the human the options, and ask which team before retrying with an explicit
`orgId`. An agent key (locked to one team) never needs `orgId` at all.
