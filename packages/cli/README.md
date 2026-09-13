# @emaxe/oa

<p align="left">
  <a href="https://www.npmjs.com/package/@emaxe/oa"><img src="https://img.shields.io/npm/v/@emaxe/oa.svg?color=blue&logo=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@emaxe/oa"><img src="https://img.shields.io/npm/dm/@emaxe/oa.svg?color=blue&logo=npm" alt="npm downloads"></a>
  <a href="https://github.com/emaxe/open-artifacts"><img src="https://img.shields.io/badge/GitHub-emaxe%2Fopen--artifacts-blue?logo=github" alt="GitHub Repository"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg?logo=node.js" alt="Node.js"></a>
  <a href="https://skills.sh/emaxe/open-artifacts"><img src="https://skills.sh/b/emaxe/open-artifacts" alt="skills.sh"></a>
</p>

**[English](README.md)** | **[Русский](README.ru.md)** | **[Changelog](CHANGELOG.md)** | **[История изменений](CHANGELOG.ru.md)**

Official CLI for [Open Artifacts](https://github.com/emaxe/open-artifacts) — a self-hosted, open-source alternative to Claude Artifacts. Publish HTML applications, Markdown documents, Mermaid diagrams, or vector SVG files from your terminal, scripts, or AI agent sessions and get back an interactive, shareable preview URL.

---

### Topics & Tags
`ai-agents` • `artifacts` • `claude-artifacts` • `claude` • `mcp` • `model-context-protocol` • `self-hosted` • `cli` • `open-artifacts` • `developer-tools`

---

## Installation

```bash
# Global installation (recommended):
npm install -g @emaxe/oa

# Or run directly without installing:
npx @emaxe/oa --help
```

---

## Quick Start

### 1. Authenticate

Connect to your Open Artifacts server using the interactive OAuth Device Flow:

```bash
oa login --server https://artifacts.your-company.com
```

The CLI outputs a short code (e.g. `ABCD-1234`) and an activation link. Open the link in your browser and approve access. This issues a **personal key** by default — it's valid across every team you belong to, not locked to one. Credentials are saved locally to `~/.config/open-artifacts/credentials.json` (`600` permissions).

Verify your session at any time:

```bash
oa whoami
```

### 2. Pick a team

If you belong to more than one team, tell the CLI which one to use for this project:

```bash
oa orgs           # list your teams, with a * next to the current default
oa use <team>     # set the default for this project (writes a secret-free .oa.json you can commit)
```

With exactly one team, this step is optional — it's used automatically. Override it for a single command with `--org <team>` on `oa list` / `oa push`, without changing the saved default.

### 3. Publish Content

```bash
# Publish an HTML file and get a public shareable URL:
oa push report.html --title "Quarterly Financials" --share

# Publish a Markdown summary:
oa push summary.md --title "Meeting Minutes" --share

# Render a Mermaid flowchart:
oa push architecture.mmd --title "Service Architecture" --share

# Upload an SVG vector graphic:
oa push diagram.svg --title "Database Schema" --share
```

---

## Command Reference

### `oa login`
Authorizes the CLI with an Open Artifacts server using the OAuth device flow.

```bash
oa login [options]
  --server <url>      Open Artifacts server URL (default: "http://localhost:3000")
  --name <name>        Name to register this device/agent as
  --scopes <scopes>    Comma-separated list of scopes (default: "artifacts:read,artifacts:write,shares:write")
  --agent               Issue an agent key locked to one team, instead of a personal key spanning all your teams
```

### `oa whoami`
Displays current credentials, server endpoint, key type, effective team, and token expiration.

### `oa orgs`
Lists the teams your key can act in, marking the one currently selected for this project.

```bash
oa orgs [--json]
```

### `oa use <team>`
Sets the default team (by id or slug) for the current project, or for the whole machine.

```bash
oa use <team> [--global]
```

### `oa push <file>`
Creates a new artifact or updates an existing one from a local file.

```bash
oa push <file> [options]
  --title <title>       Artifact title (defaults to filename)
  --kind <kind>         Content type: html | markdown | mermaid | svg (auto-detected if omitted)
  --id <id>             Update an existing artifact instead of creating a new one
  --share               Also create a share link, in the team's configured default mode
  --team                Create the link in 'team' mode: only logged-in members of the artifact's team can open it (implies --share)
  --public              Create a fully public link, no login or password needed (implies --share; the team or instance may forbid this)
  --password <pass>     Protect the share link with a password (implies --share)
  --message <msg>       Version commit message
  --lifetime <duration> Delete the artifact after this long: 30m, 12h, 7d, or 0 for never (omit to use the team's default)
  --org <team>          Team id or slug to publish into (overrides the project/machine default)
  --json                Output result as JSON
```

### `oa list`
Lists all artifacts in your active team.

```bash
oa list [--org <team>] [--json]
```

### `oa get <artifact-id>`
Retrieves artifact metadata or downloads raw content to a file.

```bash
oa get <artifact-id> [-o output-file] [--json]
```

### `oa rm <artifact-id>`
Soft-deletes an artifact.

```bash
oa rm <artifact-id> [--json]
```

### `oa share <artifact-id>`
Generates a new shareable link for an existing artifact.

```bash
oa share <artifact-id> [options]
  --team                 Only logged-in members of the artifact's team can open it
  --public               Fully public link, no login or password needed (the team or instance may forbid this)
  --password <pass>      Require this password to view
  --expires <ttl>        Link expiration duration (e.g. 1h, 1d, 7d, 30d; default: never)
  --version <n>          Pin the share to a specific version number
  --json                 Output share metadata as JSON
```

### `oa unshare <share-id>`
Revokes an active share link immediately.

```bash
oa unshare <share-id> [--json]
```

---

## Non-Interactive & CI Environments

For CI/CD pipelines, headless scripts, or background agent environments, you can bypass the device flow by setting environment variables:

```bash
export OA_SERVER="https://artifacts.your-company.com"
export OA_TOKEN="oa_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

For CI, an agent key (`oa login --agent`, or generated in the web dashboard under **Team > Agents**) is usually the right choice — it's locked to one team, which keeps the blast radius of a leaked CI secret small. A personal key issued from **Settings > Личные API-ключи** also works via `OA_TOKEN`, but it spans every team you belong to.

---

## AI Agent Integration

This CLI is designed to be invoked by LLM coding agents (Claude Code, Cursor, Windsurf, Codex, Antigravity, OpenCode). You can install the pre-configured skill via [skills.sh](https://skills.sh/emaxe/open-artifacts):

```bash
npx skills add emaxe/open-artifacts
```

---

## License

MIT © [emaxe](https://github.com/emaxe)
