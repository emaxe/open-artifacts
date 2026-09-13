# Open Artifacts

<p align="left">
  <a href="https://github.com/emaxe/open-artifacts/releases"><img src="https://img.shields.io/github/v/release/emaxe/open-artifacts?label=release&color=blue&logo=github" alt="GitHub Release"></a>
  <a href="https://github.com/emaxe/open-artifacts/stargazers"><img src="https://img.shields.io/github/stars/emaxe/open-artifacts?style=flat&logo=github" alt="GitHub Stars"></a>
  <a href="https://www.npmjs.com/package/@emaxe/oa"><img src="https://img.shields.io/npm/v/@emaxe/oa.svg?color=blue&logo=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@emaxe/oa"><img src="https://img.shields.io/npm/dm/@emaxe/oa.svg?color=blue&logo=npm" alt="npm downloads"></a>
  <a href="https://skills.sh/emaxe/open-artifacts"><img src="https://skills.sh/b/emaxe/open-artifacts" alt="skills.sh"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen?logo=node.js" alt="Node.js"></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white" alt="Docker"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Server-purple" alt="MCP Server"></a>
</p>

**[English](README.md)** | **[Русский](README.ru.md)** | **[Changelog](CHANGELOG.md)** | **[История изменений](CHANGELOG.ru.md)**

Self-hosted artifact hosting for AI agents — an open alternative to Claude Artifacts. Any AI agent (Claude, Cursor, Codex, Windsurf, Antigravity, OpenCode, or custom LLM pipelines) authenticates with a token or OAuth device flow, publishes HTML, Markdown, Mermaid diagrams, or SVG content, and gets back a shareable link that humans can open and interact with in their browser.

Runs as a lightweight, single-stack Docker Compose deployment.

---

### Topics & Tags
`ai-agents` • `artifacts` • `claude-artifacts` • `claude` • `mcp` • `mcp-server` • `model-context-protocol` • `self-hosted` • `docker` • `hono` • `react` • `typescript` • `cli` • `developer-tools` • `open-artifacts` • `llm`

---

## Key Features

- 🛡️ **Zero-Trust Security Sandbox**: Untrusted agent-generated artifacts render inside strictly isolated `<iframe>` containers with sandboxed origins (`allow-scripts`, no credential or cookie leaks, strict Content Security Policy).
- 📦 **Multi-Format Support**: Interactive HTML applications, GitHub-flavored Markdown, responsive Mermaid diagrams, and raw vector SVG graphics.
- ⚡ **Built-in MCP Server**: Ready-to-use Model Context Protocol endpoint at `/mcp` (Streamable HTTP) for immediate integration with Cursor, Claude Desktop, and Claude Code.
- 🤖 **Standard AI Agent Skill**: First-class support for `skills.sh` (`npx skills add emaxe/open-artifacts`) with automatic CLI detection and device-flow authorization.
- 🔑 **Flexible Authentication**: Interactive OAuth Device Flow (`oa login`) and non-interactive organization API tokens (`OA_TOKEN`).
- 👥 **Multi-Tenancy & Teams**: Organizations, user management, and fine-grained roles (`superadmin`, `admin`, `member`) with an intuitive Team Switcher.
- 🔗 **Secure Sharing**: Team-only links, password-protected links, public links, and automatic link expiration (1 hour, 1 day, 7 days, 30 days) — teams and instance admins control the default link mode and can disable public links entirely.
- 🚀 **One-Command Deployment**: Instant production setup with Docker Compose or the interactive `./run.sh` runner.

---

## Quick Start

### Option 1: Interactive Runner (Recommended)

```bash
./run.sh
```

An interactive menu to orchestrate Docker production containers, local development, builds, tests, and database migrations without memorizing individual commands.

### Option 2: Docker Compose

```bash
cp .env.example .env        # Configure SESSION_SECRET, SUPERADMIN_EMAIL/PASSWORD
docker compose up -d
```

Open `http://localhost:3000`, log in using the superadmin credentials configured in `.env`, and you're ready! Database migrations run automatically on container startup.

---

## Project Layout

```
apps/api/              Hono REST API + MCP server + Postgres (Drizzle) + Static web server
apps/web/              React SPA (Vite) — Admin & User interface
packages/shared/       Zod schemas + shared validation rules (access control, CSP, TTL parsing)
packages/cli/          `oa` CLI for AI agents (published on npm as @emaxe/oa)
skills/open-artifacts/ Agent skill specification (SKILL.md) compatible with skills.sh
docker/                Multi-stage Dockerfile for containerized deployment
run.sh                 Interactive terminal management script
```

---

## Local Development

Requirements: **Node.js 20+**, **pnpm**, and **Docker** (for local PostgreSQL).

```bash
# 1. Install dependencies
pnpm install

# 2. Start PostgreSQL dev database on localhost:5433
docker compose -f docker-compose.dev.yml up -d

# 3. Synchronize database schema
cd apps/api && DATABASE_URL=postgres://postgres:postgres@localhost:5433/open_artifacts_dev \
  pnpm exec drizzle-kit push

# 4. Start development servers
pnpm dev:api   # API & MCP server at http://localhost:3000
pnpm dev:web   # React UI at http://localhost:5173 (proxies /api to :3000)
```

Develop and test the CLI locally:
```bash
cd packages/cli && pnpm dev -- login --server http://localhost:3000
```

---

## Tests

```bash
pnpm -r run test                                             # Run all unit tests
cd apps/api && pnpm run test:integration                     # Integration tests (requires dev DB)
cd apps/api && pnpm exec playwright install chromium          # Install Playwright browser once
cd apps/api && pnpm run test:e2e                              # End-to-end security sandbox tests
```

> **Security Verification:** The e2e test suite (`apps/api/e2e/sandbox-security.spec.ts`) verifies sandbox isolation by injecting malicious payloads and confirming that artifacts cannot access host cookies, `localStorage`, or backend APIs.

---

## AI Agent Skill (for Claude, Cursor, Windsurf, etc.)

Open Artifacts ships with an agent skill compliant with the [skills.sh](https://skills.sh/emaxe/open-artifacts) standard. It instructs AI assistants how to automatically install `@emaxe/oa`, authenticate, publish generated artifacts, and present clean preview URLs in chat.

### 1. Install via skills.sh

```bash
# In the current project workspace (recommended):
npx skills add emaxe/open-artifacts

# Or install globally:
npx skills add emaxe/open-artifacts -g
```

### 2. Agent Authentication

Agents can authenticate using either of two methods:

#### Method A: Personal access (recommended)
1. Run in terminal or agent session:
   ```bash
   oa login --server http://localhost:3000
   ```
2. The CLI outputs a verification code (e.g. `ABCD-1234`) and activation URL.
3. Open `http://localhost:3000/activate?code=ABCD-1234` in the browser and approve — no organization to pick here.
4. This issues a **personal key**, valid across every team the approver belongs to (with their real role in each), saved to `~/.config/open-artifacts/credentials.json` (`600` permissions). Pick a team for a given project with:
   ```bash
   oa orgs           # list your teams
   oa use <team>     # set the default for this project (writes .oa.json, no secrets, safe to commit)
   ```

#### Method B: Agent key locked to one team (for CI)
Run `oa login --agent` (organization selection required at approval time), or create an API key in the web UI under **Team > Agents** (`/t/:orgId/agents`) and pass it to the agent's environment:

```bash
export OA_SERVER="http://localhost:3000"
export OA_TOKEN="oa_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

Verify connection:
```bash
oa whoami
```

### 3. CLI Command Cheat Sheet

| Task | Command |
|---|---|
| Check token, key type, and selected team | `oa whoami` |
| List teams your key can act in | `oa orgs` |
| Set the default team for this project | `oa use <team-slug>` |
| Publish artifact and generate a link in the team's default mode | `oa push report.html --title "Q3 Summary" --share` |
| Update an existing artifact (create new version) | `oa push report.html --id <artifact-id> --message "Updated metrics"` |
| Create a team-only link (only logged-in team members can open it) | `oa share <artifact-id> --team` |
| Create expiring link with password protection | `oa share <artifact-id> --password "secret123" --expires 7d` |
| Create a fully public link (may be disabled by team/instance policy) | `oa share <artifact-id> --public` |
| List all artifacts in the active team | `oa list` |
| Download artifact source | `oa get <artifact-id> -o output.html` |
| Remove an artifact | `oa rm <artifact-id>` |
| Revoke a shared link | `oa unshare <share-id>` |

Supported file formats: `html`, `markdown`, `mermaid`, `svg`. Append `--json` to any command for structured JSON output.

---

## Model Context Protocol (MCP) Server

Every Open Artifacts instance serves a built-in MCP server at `<APP_ORIGIN>/mcp` via Streamable HTTP. Connect any MCP client by supplying an API key (personal or agent) in the `Authorization` header. A personal key spans every team it belongs to — `?orgId=` in the URL sets the default team for this connection (omit it if the key only has one team):

```json
{
  "mcpServers": {
    "open-artifacts": {
      "url": "http://localhost:3000/mcp?orgId=<team-id>",
      "headers": {
        "Authorization": "Bearer oa_live_xxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

### Available MCP Tools
- `whoami`: Check token identity, scopes, and team context.
- `list_orgs`: List the teams this identity can act in.
- `list_artifacts`: Search and retrieve artifacts in a team.
- `get_artifact`: Fetch artifact metadata and raw content.
- `create_artifact`: Create a new artifact (`html`, `markdown`, `mermaid`, `svg`).
- `update_artifact`: Publish a new version for an existing artifact.
- `delete_artifact`: Soft-delete an artifact.
- `create_share`: Create a team-only, password-protected, or public expiring share link. Omitting `mode` uses the team's configured default.
- `list_shares`: View all active shares for an artifact.
- `revoke_share`: Instantly deactivate a share link.

`list_artifacts` and `create_artifact` take an optional `orgId` argument, overriding the connection's default. With neither set and more than one team to choose from, they return a structured `org_required` error listing the candidates instead of guessing.

---

## Agent Instructions Page

An interactive cheatsheet with copyable commands, live instance URLs, and direct links to `/activate` is integrated into the web UI at **`/help/agents`**, available to every signed-in user — connecting an agent is something any team member does for their own team, not a superadmin-only task.

---

## Teams, invites, and admin

Every user gets an auto-provisioned personal **main workspace** on registration (including when registering through an invite link — they land in both their own workspace and the inviting team). Teams are created explicitly from **Команды** (`/teams`).

Inviting someone to a team (`/t/:orgId/settings`) works for both new and existing accounts:
- **New email** — you get a one-time link (`/invite/:token`) to send them yourself; there is no email delivery built in.
- **Existing account** — they see the invite under **Приглашения** (`/invites`) in their own session and accept or decline it explicitly; nothing is added silently.

Superadmins get a dedicated admin area at `/admin` (Overview, Users, Teams, Audit, Instance settings), separate from the agent-connection instructions above.

---

## Configuration

Configure the application through environment variables (see [`.env.example`](.env.example)):

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:postgres@db:5432/open_artifacts` |
| `APP_ORIGIN` | Public base URL of the instance (used for share links, invite links, device-flow verification, CORS/CSP) | `http://localhost:3000` |
| `ARTIFACT_ORIGIN` | Optional separate origin to serve artifact content (`/embed/*`) from, for stronger isolation | unset (serves from `APP_ORIGIN`) |
| `SESSION_SECRET` | Random string used to sign session cookies (generate with `openssl rand -hex 32`) | *Required* |
| `IP_HASH_SALT` | Salt used when hashing viewer IPs for analytics | *Required* |
| `SUPERADMIN_EMAIL` | Initial superadmin email, created on first run if set | `admin@example.com` |
| `SUPERADMIN_PASSWORD` | Initial superadmin password | *Required in production* |
| `DEFAULT_KEY_TTL_DAYS` | Default lifetime for agent API tokens (0 = never expires) | `90` |
| `DEFAULT_REGISTRATION_MODE` | Who may self-register: `open`, `invite_only`, or `closed` | `invite_only` |
| `ARTIFACT_PURGE_INTERVAL_MINUTES` | How often the background sweeper hard-deletes expired artifacts (0 disables it; lifetimes still apply lazily on read either way) | `5` |

Most operational settings — registration mode, default key TTL, invite link lifetime, the CDN allowlist, the maximum artifact size, and the maximum/default artifact lifetime — can also be modified at runtime by superadmins in **Настройки инстанса** (`/admin/settings`); they don't need an environment variable or a restart.

### Artifact lifetime (TTL)

By default artifacts live forever. A superadmin can set an instance-wide maximum artifact
lifetime (in minutes, in `/admin/settings`) — it doubles as the default for newly created
artifacts. Team owners/admins may set their own stricter limit for their team, but never looser
than the instance maximum. Callers (CLI `--lifetime`, the web UI, or the MCP/API `lifetime` field)
may pick anything up to the effective limit at creation time, and change it later.

Once an artifact's lifetime expires its content is **hard-deleted** — the version history is gone
for good, only a tombstone row remains for audit/analytics. Lowering the maximum re-clamps every
existing artifact's expiry from its own creation date (`min(current deadline, created_at + new
max)`); raising it never extends anything already created.

### Link modes and share policy

A share link is `team` (only logged-in members of the artifact's team can open it), `password`
(anyone with the URL and the password), or `public` (anyone with the URL). Creating one without
naming a mode — the plain `--share` flag, an omitted `mode` field over the API, or MCP's
`create_share` with no `mode` argument — uses the team's configured default, not always `public`.

Team owners/admins set two things per team in **Настройки команды** (`/t/:orgId/settings`,
including for their personal main workspace): the **default link mode** (`team` or `public`) and
whether **public links are allowed at all**. A superadmin sets the same two knobs instance-wide in
`/admin/settings`; a team can only be equal-or-stricter than the instance, never looser — it can
never re-enable public links the instance disabled, nor default to public while public links are
forbidden. Disabling public links only blocks *new* ones; existing public shares keep working until
revoked, one by one from the artifact page or in bulk from the team settings page.

---

## License

MIT © [emaxe](https://github.com/emaxe)
