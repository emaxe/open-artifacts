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

`skills/open-artifacts/` is installable directly from this repo via [skills.sh](https://skills.sh):

```bash
npx skills add emaxe/open-artifacts
```

This drops the skill into whichever supported agent it detects (Claude Code, Cursor, Codex,
OpenCode, and more) so the agent knows how to install the `oa` CLI, log in, and publish/share
artifacts. See `skills/open-artifacts/SKILL.md` for what it teaches the agent.

## MCP server

Every instance exposes an MCP server at `<APP_ORIGIN>/mcp` (Streamable HTTP) — no separate process
or package to install. Point any MCP client's remote-server config at it with an agent API key
(the same kind `oa login` or the web UI's Agents page issues) as a Bearer token:

```json
{
  "mcpServers": {
    "open-artifacts": {
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer oa_live_..." }
    }
  }
}
```

Tools: `whoami`, `list_artifacts`, `get_artifact`, `create_artifact`, `update_artifact`,
`delete_artifact`, `create_share`, `list_shares`, `revoke_share` — each enforces the calling key's
scopes exactly like the REST API (see `apps/api/src/routes/mcp.ts`).

## Configuration

See `.env.example` for every setting (registration mode, default key TTL, session secret, etc.).
Most of it can also be changed at runtime by a superadmin from the in-app Admin page.
