# Open Artifacts

[![GitHub](https://img.shields.io/badge/GitHub-emaxe%2Fopen--artifacts-blue?logo=github)](https://github.com/emaxe/open-artifacts)
[![Stars](https://img.shields.io/github/stars/emaxe/open-artifacts?style=social)](https://github.com/emaxe/open-artifacts/stargazers)
[![skills.sh](https://skills.sh/b/emaxe/open-artifacts)](https://skills.sh/emaxe/open-artifacts)

Self-hosted artifact hosting for AI agents — an open alternative to Claude Artifacts. Any agent
(not just Claude) authenticates with a token, publishes HTML/Markdown/Mermaid/SVG content, and
gets back a link a human can open in a browser. Runs as one Docker Compose stack.

See [`docs/superpowers/specs/2026-09-10-open-artifacts-design.md`](docs/superpowers/specs/2026-09-10-open-artifacts-design.md)
for the full design.

## Quick start

```bash
./run.sh
```

An interactive menu for everything below — production (Docker), local dev, builds, and tests —
without memorizing the individual commands. Or do it by hand:

```bash
cp .env.example .env        # edit SESSION_SECRET, SUPERADMIN_EMAIL/PASSWORD, etc.
docker compose up -d
```

Open `http://localhost:3000`, log in with the superadmin account from `.env`, and you're in. The
image runs migrations automatically on startup.

## Project layout

```
apps/api/       Hono API + Postgres (Drizzle) + serves the built web app
apps/web/       React SPA (Vite) — the admin/user web UI
packages/shared/  Zod schemas + pure logic shared by api/web/cli (access rules, CSP, TTL parsing...)
packages/cli/   `oa` CLI for agents (published as npm package `@emaxe/oa`)
skills/open-artifacts/  SKILL.md for AI agents to use the CLI/API
apps/api/src/routes/mcp.ts  MCP server, mounted at /mcp on the same API
docker/         Dockerfile (multi-stage) used by docker-compose.yml
```

## Local development

Requires Node 20+, pnpm, and Docker (for Postgres).

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d   # Postgres on localhost:5433
cd apps/api && DATABASE_URL=postgres://postgres:postgres@localhost:5433/open_artifacts_dev \
  pnpm exec drizzle-kit push                      # first-time schema sync

pnpm dev:api   # http://localhost:3000
pnpm dev:web   # http://localhost:5173 (proxies /api to :3000)
```

CLI, during development:
```bash
cd packages/cli && pnpm dev -- login --server http://localhost:3000
```

## Tests

```bash
pnpm -r run test                                             # unit tests (no DB needed)
cd apps/api && pnpm run test:integration                     # needs docker-compose.dev.yml's db
cd apps/api && pnpm exec playwright install chromium          # once
cd apps/api && pnpm run test:e2e                              # sandbox-isolation security test
```

The e2e test (`apps/api/e2e/sandbox-security.spec.ts`) is the project's most important test: it
publishes a malicious artifact and verifies it cannot read the viewer's cookies or localStorage,
or call the API — the whole security model in one assertion.

## Skill (for AI agents)

Open Artifacts provides a standardized skill that teaches AI agents (Claude Code, Cursor, Codex, Windsurf, Antigravity, OpenCode, etc.) how to interact with your instance: install the `oa` CLI, authenticate, publish artifacts, and return shareable links in chat.

### 1. Installation via [skills.sh](https://skills.sh/emaxe/open-artifacts)

Install the skill directly from this repository:

```bash
# Install in the current project workspace (recommended):
npx skills add emaxe/open-artifacts

# Or install globally for all projects on your machine:
npx skills add emaxe/open-artifacts -g
```

`skills.sh` automatically detects your agent environment (e.g. `.agents/skills/open-artifacts/` or `.claude/skills/`) and places `SKILL.md` there.

### 2. Agent Authentication

Agents can authenticate with your Open Artifacts instance in two ways:

#### Option A: Interactive OAuth Device Flow (Recommended for CLI)
1. The agent (or you) runs in the terminal:
   ```bash
   oa login --server http://localhost:3000
   ```
   *(replace `http://localhost:3000` with your instance URL)*
2. The CLI prints a one-time code (e.g., `ABCD-1234`) and a verification URL.
3. Open `http://localhost:3000/activate?code=ABCD-1234` in your browser, select an organization, and click **Approve** («Разрешить»). Superadmins can grant access to any organization in the system.
4. Credentials are automatically saved to `~/.config/open-artifacts/credentials.json`.

#### Option B: Non-interactive Environment Variables
Issue an API key directly in the web UI under **Team > Agents** (`/t/:orgId/agents`) by clicking **Issue Key** («Выпустить ключ»). Then inject the variables into the agent's environment:

```bash
export OA_SERVER="http://localhost:3000"
export OA_TOKEN="oa_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

Verify connection:
```bash
oa whoami
```

### 3. Quick CLI Recipes for Agents

| Task | Command |
|---|---|
| Publish new artifact & get share link | `oa push report.html --title "Q3 Report" --share` |
| Update an existing artifact (new version) | `oa push report.html --id <artifact-id> --message "Fixed typos"` |
| Share with password & 7-day expiration | `oa share <artifact-id> --password "secret123" --expires 7d` |
| List artifacts in current team | `oa list` |
| Download artifact content | `oa get <artifact-id> -o local.html` |

Supported artifact types: `html`, `markdown`, `mermaid`, `svg`.

## MCP server (Model Context Protocol)

Every instance exposes an MCP server at `<APP_ORIGIN>/mcp` (Streamable HTTP) — no separate process or package required. Point any MCP client (Cursor, Claude Desktop, Claude Code) at it using an agent API key as a Bearer token:

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

Available tools: `whoami`, `list_artifacts`, `get_artifact`, `create_artifact`, `update_artifact`, `delete_artifact`, `create_share`, `list_shares`, `revoke_share`.

## Admin Instructions Page

A complete interactive cheat-sheet with copyable commands, real-time instance URLs, and links to `/activate` is also built directly into the web UI at **Admin > Instructions** (`/admin/instructions` or `/admin?tab=instructions`).

## Configuration

See `.env.example` for every setting (registration mode, default key TTL, session secret, etc.).
Most of it can also be changed at runtime by a superadmin from the in-app Admin page.
