---
name: open-artifacts
description: Publish HTML/Markdown/Mermaid/SVG content to a self-hosted Open Artifacts instance and get back a shareable link. Use when you've generated a report, dashboard, diagram, or any standalone document and need to hand a human a URL instead of pasting raw content into chat.
---

# Open Artifacts

Open Artifacts is a self-hosted alternative to Claude Artifacts: any AI agent can publish HTML,
Markdown, Mermaid, or SVG content to it and get back a URL a human can open in a browser. Content
renders in a sandboxed iframe (no access to the host page, no network access out), so it's safe to
publish agent-generated content without a security review.

## Setup (once per machine)

```bash
npm install -g open-artifacts   # installs the `oa` CLI
oa login --server https://artifacts.your-company.com
```

`oa login` starts a device-flow authorization: it prints a code and a URL, a human opens the URL
in their browser, logs in, picks an organization, and approves. The CLI then saves credentials to
`~/.config/open-artifacts/credentials.json` (mode 600) and you're done — no need to repeat this
per session. If a URL isn't reachable interactively, ask the human to run `oa login` for you once
and confirm it succeeded before continuing.

Alternative: if a `OA_TOKEN` (and optionally `OA_SERVER`) environment variable is already set, the
CLI uses it directly and skips the device flow entirely — check for that first if you're running
in an environment where env vars are the normal way secrets are injected.

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
| `forbidden` (403) | Missing scope, or no access to that org/artifact | Check `oa whoami`; you may need a key with `artifacts:write` |
| `quota_exceeded` (413) | The org hit its storage quota | Tell the human — an admin needs to raise the quota or free up space |
| `artifact_too_large` (413) | A single artifact exceeds the size cap (default 5 MiB) | Split the content or reduce it — there's no per-artifact override |
| `version_conflict` (409) | Someone else changed this artifact since you last read it | `oa get <id>` to see the latest, merge your change, retry |

If you don't have the CLI available (no Node/npm), see `references/api.md` for raw HTTP/curl
examples covering the same operations.
