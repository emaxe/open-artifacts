---
name: open-artifacts
description: Publish HTML/Markdown/Mermaid/SVG content to a self-hosted Open Artifacts instance and get back a shareable link. Use when you've generated a report, dashboard, diagram, or any standalone document and need to hand a human a URL instead of pasting raw content into chat.
---

# Open Artifacts

Open Artifacts is a self-hosted alternative to Claude Artifacts: any AI agent can publish HTML,
Markdown, Mermaid, or SVG content to it and get back a URL a human can open in a browser. Content
renders in a sandboxed iframe (no access to the host page, no network access out), so it's safe to
publish agent-generated content without a security review.

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

**Publish something new and share it:**
```bash
oa push report.html --title "Q3 Revenue Report" --share
# -> prints the artifact id and a share URL; hand the URL to the user
```

**Update something you already published** (creates a new version, doesn't overwrite history):
```bash
oa push report.html --id <artifact-id> --message "Fixed the Q3 numbers"
```

**Share with a password or an expiry, instead of a bare public link:**
```bash
oa share <artifact-id> --password "correct horse" --expires 7d
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

- `html` — a self-contained HTML file (inline `<style>`/`<script>` — no separate asset files).
  Default if you don't pass `--kind` and the file extension isn't recognized.
- `markdown` — rendered server-side to HTML.
- `mermaid` — a raw Mermaid diagram definition, rendered client-side.
- `svg` — rendered directly.

`oa push` infers the kind from the file extension (`.html`, `.md`, `.mmd`/`.mermaid`, `.svg`);
override with `--kind` if the extension doesn't match.

## Errors you'll hit and what to do

| Error | Meaning | What to do |
|---|---|---|
| `key_expired` (401) | Your API key's TTL ran out | Run `oa login` again |
| `key_revoked` (401) | A human revoked your key | Ask them to issue a new one, or `oa login` again |
| `org_required` (400) | Your personal key spans several teams and none is selected | The response includes the candidate list — show it to the human and ask which team, then `oa use <slug>` (see Setup step 4). Don't pick one yourself. |
| `forbidden` (403) | Missing scope, or no access to that org/artifact | Check `oa whoami`; you may need a key with `artifacts:write` |
| `quota_exceeded` (413) | The org hit its storage quota | Tell the human — an admin needs to raise the quota or free up space |
| `artifact_too_large` (413) | A single artifact exceeds the size cap (default 5 MiB) | Split the content or reduce it — there's no per-artifact override |
| `version_conflict` (409) | Someone else changed this artifact since you last read it | `oa get <id>` to see the latest, merge your change, retry |

If you don't have the CLI available (no Node/npm), see `references/api.md` for raw HTTP/curl
examples covering the same operations.

## If you're an MCP client instead of a shell-based agent

The instance also runs an MCP server directly — no CLI needed. Connect to `<server>/mcp` (Streamable
HTTP) with the same API key as a Bearer token, and use its tools instead of shelling out to `oa`:
`whoami`, `list_orgs`, `list_artifacts`, `get_artifact`, `create_artifact`, `update_artifact`,
`delete_artifact`, `create_share`, `list_shares`, `revoke_share`. Same scopes, same error
semantics as the table above — just called as MCP tools rather than CLI commands.

A personal key spans every team it belongs to, same as with the CLI. `list_artifacts` and
`create_artifact` take an optional `orgId` argument; omit it and the connection's default (set via
`?orgId=` in the MCP server URL in your `.mcp.json`) is used, or the sole team if there's only one.
With neither, the tool returns `org_required` with the candidate list in its error text — call
`list_orgs`, show the human the options, and ask which team before retrying with an explicit
`orgId`. An agent key (locked to one team) never needs `orgId` at all.
