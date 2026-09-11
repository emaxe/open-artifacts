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
- 🔗 **Secure Sharing**: Public links, password-protected links, and automatic link expiration (1 hour, 1 day, 7 days, 30 days).
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

#### Method A: Interactive OAuth Device Flow (Recommended for CLI)
1. Run in terminal or agent session:
   ```bash
   oa login --server http://localhost:3000
   ```
2. The CLI outputs a verification code (e.g. `ABCD-1234`) and activation URL.
3. Open `http://localhost:3000/activate?code=ABCD-1234` in the browser, select the target organization, and approve.
4. Credentials are automatically saved to `~/.config/open-artifacts/credentials.json` (`600` permissions).

#### Method B: Environment Variables
Create an API key in the web UI under **Team > Agents** (`/t/:orgId/agents`) and pass it to the agent's environment:

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
| Publish artifact and generate public share link | `oa push report.html --title "Q3 Summary" --share` |
| Update an existing artifact (create new version) | `oa push report.html --id <artifact-id> --message "Updated metrics"` |
| Create expiring link with password protection | `oa share <artifact-id> --password "secret123" --expires 7d` |
| List all artifacts in active organization | `oa list` |
| Download artifact source | `oa get <artifact-id> -o output.html` |
| Remove an artifact | `oa rm <artifact-id>` |
| Revoke a shared link | `oa unshare <share-id>` |

Supported file formats: `html`, `markdown`, `mermaid`, `svg`. Append `--json` to any command for structured JSON output.

---

## Model Context Protocol (MCP) Server

Every Open Artifacts instance serves a built-in MCP server at `<APP_ORIGIN>/mcp` via Streamable HTTP. Connect any MCP client by supplying an agent API key in the `Authorization` header:

```json
{
  "mcpServers": {
    "open-artifacts": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer oa_live_xxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

### Available MCP Tools
- `whoami`: Check token identity and organization context.
- `list_artifacts`: Search and retrieve artifacts in your organization.
- `get_artifact`: Fetch artifact metadata and raw content.
- `create_artifact`: Create a new artifact (`html`, `markdown`, `mermaid`, `svg`).
- `update_artifact`: Publish a new version for an existing artifact.
- `delete_artifact`: Soft-delete an artifact.
- `create_share`: Create public or password-protected expiring share links.
- `list_shares`: View all active shares for an artifact.
- `revoke_share`: Instantly deactivate a share link.

---

## Admin & Instructions Page

An interactive cheatsheet with copyable commands, live instance URLs, and direct links to `/activate` is integrated into the web UI at **Admin > Instructions** (`/admin/instructions`).

---

## Configuration

Configure the application through environment variables (see [`.env.example`](.env.example)):

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:postgres@db:5432/open_artifacts` |
| `SESSION_SECRET` | Secret key for signed session cookies (min 32 chars) | *Required* |
| `SUPERADMIN_EMAIL` | Initial superadmin email | `admin@example.com` |
| `SUPERADMIN_PASSWORD` | Initial superadmin password | *Required in production* |
| `APP_ORIGIN` | Public base URL of the instance | `http://localhost:3000` |
| `REGISTRATION_MODE` | User registration: `open`, `invite_only`, or `disabled` | `invite_only` |
| `DEFAULT_KEY_TTL_DAYS` | Default lifetime for agent API tokens | `90` |
| `MAX_ARTIFACT_SIZE_BYTES` | Maximum artifact upload size | `2097152` (2 MB) |

Most operational settings can also be modified at runtime by superadmins in the web UI.

---

## License

MIT © [emaxe](https://github.com/emaxe)
