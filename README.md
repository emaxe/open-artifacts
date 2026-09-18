# Open Artifacts

<p align="left">
  <a href="https://github.com/emaxe/open-artifacts/releases"><img src="https://img.shields.io/github/v/release/emaxe/open-artifacts?label=release&color=blue&logo=github" alt="GitHub Release"></a>
  <a href="https://github.com/emaxe/open-artifacts/stargazers"><img src="https://img.shields.io/github/stars/emaxe/open-artifacts?style=flat&logo=github" alt="GitHub Stars"></a>
  <a href="https://www.npmjs.com/package/@emaxe/oa"><img src="https://img.shields.io/npm/v/@emaxe/oa.svg?color=blue&logo=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@emaxe/oa"><img src="https://img.shields.io/npm/dm/@emaxe/oa.svg?color=blue&logo=npm" alt="npm downloads"></a>
  <a href="https://skills.sh/emaxe/open-artifacts"><img src="https://skills.sh/b/emaxe/open-artifacts" alt="skills.sh"></a>
  <a href="https://emaxe.github.io/open-artifacts/"><img src="https://img.shields.io/badge/Website-emaxe.github.io-blue?logo=github" alt="Website"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen?logo=node.js" alt="Node.js"></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white" alt="Docker"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Server-purple" alt="MCP Server"></a>
  <a href="#-constructor-mode-declarative-artifact-builder"><img src="https://img.shields.io/badge/Constructor_Mode-23_Blocks-blueviolet?logo=yaml" alt="Constructor Mode: 23 Blocks"></a>
  <a href="#file-storage-and-quotas"><img src="https://img.shields.io/badge/Storage-S3--compatible-orange?logo=amazons3&logoColor=white" alt="S3-compatible storage"></a>
</p>

**[English](README.md)** | **[Русский](README.ru.md)** | **[Landing Page](https://emaxe.github.io/open-artifacts)** | **[Changelog](CHANGELOG.md)** | **[История изменений](CHANGELOG.ru.md)**

Self-hosted artifact hosting for AI agents — an open alternative to Claude Artifacts. Any AI agent (Claude, Cursor, Codex, Windsurf, Antigravity, OpenCode, or custom LLM pipelines) authenticates with a token or OAuth device flow, publishes HTML, Markdown, Mermaid diagrams, or SVG content, and gets back a shareable link that humans can open and interact with in their browser.

Runs as a lightweight, single-stack Docker Compose deployment.

🌐 **Landing Page:** [https://emaxe.github.io/open-artifacts](https://emaxe.github.io/open-artifacts)

---

### Topics & Tags
`ai-agents` • `artifacts` • `claude-artifacts` • `claude` • `mcp` • `mcp-server` • `model-context-protocol` • `self-hosted` • `docker` • `hono` • `react` • `typescript` • `cli` • `developer-tools` • `open-artifacts` • `llm` • `s3` • `constructor` • `yaml` • `block-builder` • `report-generator`

---

## Key Features

- 🛡️ **Zero-Trust Security Sandbox**: Untrusted agent-generated artifacts render inside strictly isolated `<iframe>` containers with sandboxed origins (`allow-scripts`, no credential or cookie leaks, strict Content Security Policy).
- 🧩 **Constructor Mode (Declarative Artifact Builder)**: Fast, token-efficient assembly of HTML deliverables. Agents describe pages as clean YAML/JSON specifications or reference existing Markdown reports using 23 modular blocks. Compiles in milliseconds, cuts token generation costs by ~80%, and eliminates CSS/HTML hallucinations.
- 📦 **Multi-Format Support**: Interactive HTML applications, GitHub-flavored Markdown, responsive Mermaid diagrams, and raw vector SVG graphics.
- ⚡ **Built-in MCP Server**: Ready-to-use Model Context Protocol endpoint at `/mcp` (Streamable HTTP) for immediate integration with Cursor, Claude Desktop, and Claude Code.
- 🤖 **Standard AI Agent Skill**: First-class support for `skills.sh` (`npx skills add emaxe/open-artifacts`) with automatic CLI detection and device-flow authorization.
- 🎨 **Built-in Design Systems**: Four ready-made design templates (dashboards, documents, promo/decks, diagrams) ship with the skill so an agent picks the right one before publishing, keeping artifacts visually consistent.
- 🔑 **Flexible Authentication**: Interactive OAuth Device Flow (`oa login`) and non-interactive organization API tokens (`OA_TOKEN`).
- 🖥️ **Bilingual Sign-In Screen**: `/` greets a signed-out visitor with a two-panel sign-in/sign-up screen (English/Russian, toggle in the header) — no marketing copy to scroll past on your own instance. Signed-in visitors are redirected straight to their own workspace. The product's marketing site lives separately at **[emaxe.github.io/open-artifacts](https://emaxe.github.io/open-artifacts/)** (source: `apps/landing/`), published to GitHub Pages and carrying no auth of its own.
- 👥 **Multi-Tenancy & Teams**: Organizations, user management, and fine-grained roles (`superadmin`, `admin`, `member`) with an intuitive Team Switcher.
- 🔗 **Secure Sharing**: Team-only links, password-protected links, public links (optionally labeled for your own reference), and automatic link expiration (1 hour, 1 day, 7 days, 30 days) — teams and instance admins control the default link mode and can disable public links entirely. Every share page shows a branded viewer panel (title, type, version) that expands with author, team, and a version picker for anyone who can manage the artifact — who can also change that very link's access mode right there, in place, without revoking it and handing out a new URL.
- 🖼️ **File Attachments**: Images and other files can be uploaded to an S3-compatible bucket (MinIO ships in `docker-compose.yml` by default) and attached to an artifact — proxied through the app, never a public bucket. An agent can check its remaining quota (`oa quota` / the `get_storage_quota` MCP tool) before deciding whether to upload. Instance-wide and per-team storage quotas (team-wide and per-artifact, unlimited by default) keep usage in check; files are deleted automatically with their artifact.
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
apps/api/               Hono REST API + MCP server + Postgres (Drizzle) + Static web server
apps/web/               React SPA (Vite) — sign-in screen + Admin & User interface
apps/landing/           Static marketing site (Vite, no backend) — published to GitHub Pages
packages/shared/       Zod schemas + shared validation rules (access control, CSP, TTL parsing)
packages/cli/          `oa` CLI for AI agents (published on npm as @emaxe/oa)
skills/open-artifacts/ Agent skill (SKILL.md) + design templates (references/design/) compatible with skills.sh
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
pnpm dev:api      # API & MCP server at http://localhost:3000
pnpm dev:web      # React UI at http://localhost:5173 (proxies /api to :3000)
pnpm dev:landing  # Marketing site at http://localhost:5174 (apps/landing, no backend needed)
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

Open Artifacts ships with an agent skill compliant with the [skills.sh](https://skills.sh/emaxe/open-artifacts) standard. It instructs AI assistants how to automatically install `@emaxe/oa`, authenticate, publish generated artifacts, and present clean preview URLs in chat. It also ships four ready-made design systems — dashboards, reports, promo/decks, and diagrams — plus a shared foundation, which the agent picks between before writing an `html` artifact, so published artifacts look consistent regardless of which agent or session produced them.

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

## 🧩 Constructor Mode: Declarative Artifact Builder

Writing raw HTML/CSS from an AI agent has significant drawbacks:
- **Massive token consumption**: 2,000–5,000+ output tokens per artifact, consuming context windows and driving up costs.
- **High latency**: Streaming thousands of repetitive HTML tags takes 30–60+ seconds.
- **Fragile styling & layout hallucinations**: LLMs frequently introduce syntax errors, broken CSS, missing responsive styles, broken dark mode, or blocked CDN imports that fail the strict sandbox CSP.

**Constructor Mode** solves this completely. Rather than generating raw HTML, the agent emits a concise, structured **YAML or JSON specification**. A lightweight builder (`skills/open-artifacts/constructor/build.mjs`) then compiles it in milliseconds into a standalone, accessible, dark-mode-ready HTML artifact.

### Key Benefits

| Benefit | Raw HTML | Constructor Mode |
|---|---|---|
| **Token Usage** | 2,000 – 5,000+ tokens | **~150 – 400 tokens (~80% reduction)** |
| **Generation Speed** | 30 – 60+ seconds | **1 – 3 seconds (instant)** |
| **Styling & Theming** | Hand-crafted, often inconsistent | **Engineered design tokens with 5 instant themes** |
| **Dark / Light Mode** | Often missing or broken | **Automatic via CSS custom properties & Chart.js theme binding** |
| **Sandbox CSP** | Often blocked (external fonts, unapproved CDNs) | **100% compliant with Open Artifacts iframe CSP** |
| **Interactive Components** | Requires custom JS boilerplate | **Pre-tested: sortable tables, tabs, zoomable images, Chart.js, Mermaid** |

---

### How It Works

```
┌───────────────────────────┐      ┌───────────────────────────────┐      ┌─────────────────────────┐
│  AI Agent                 │      │  Constructor (build.mjs)      │      │  Open Artifacts Server  │
│                           │      │                               │      │                         │
│  Emits YAML/JSON spec     │ ───► │  • Validates blocks           │ ───► │  Self-contained HTML    │
│  or points to .md report  │      │  • Inlines CSS themes         │      │  Sandboxed iframe       │
│  (~80% fewer tokens)      │      │  • Dedupes Chart/Mermaid CDNs │      │  Shareable URL link     │
└───────────────────────────┘      └───────────────────────────────┘      └─────────────────────────┘
```

#### 1. Compile & Publish in One Command
```bash
# Build and publish with an auto-generated share link:
node skills/open-artifacts/constructor/build.mjs report.yaml --share
```

#### 2. Declarative Specification Example (`report.yaml`)
```yaml
title: "Quarterly Analytics"
theme: data # default | data | document | promo | diagram
lang: en

blocks:
  - type: hero
    title: "Q3 Performance Dashboard"
    subtitle: "Enterprise telemetry & ARR"
    badge: "Verified"

  - type: kpi-row
    items:
      - label: "Total Revenue"
        value: "$4.25M"
        delta: "+18.4%"
        trend: up
        icon: "💰"
      - label: "Active Clients"
        value: "1,240"
        delta: "+5.1%"
        trend: up
        icon: "👥"
      - label: "Monthly Churn"
        value: "1.18%"
        delta: "-0.2%"
        trend: down
        icon: "📉"

  - type: two-columns
    ratio: "1:1"
    left:
      - type: chart-bar
        title: "Monthly ARR ($k)"
        labels: ["Jul", "Aug", "Sep"]
        datasets:
          - label: "Actual"
            data: [740, 780, 840]
            color: c1
    right:
      - type: chart-pie
        title: "Revenue by Tier"
        donut: true
        labels: ["Enterprise", "Mid-Market", "SMB"]
        data: [55, 30, 15]

  - type: tabs
    items:
      - label: "Accounts"
        blocks:
          - type: table
            caption: "Top Accounts by ARR"
            sortable: true
            columns: ["Client", "Tier", "ARR", "Status"]
            rows:
              - ["Acme Global", "Enterprise", "$420k", "Active"]
              - ["Globex Tech", "Enterprise", "$380k", "Active"]
      - label: "Architecture"
        blocks:
          - type: mermaid-diagram
            caption: "Processing Pipeline"
            definition: |
              graph LR
                A[Agent] --> B[Constructor]
                B --> C[Open Artifacts]

  - type: image
    src: "./assets/diagram.png" # local images auto-inline to base64
    alt: "System Architecture"
    caption: "Click to zoom"
    width: "400px"
    zoomable: true # Fullscreen lightbox on click

  - type: raw # Escape hatch: arbitrary HTML/CSS/JS with access to theme tokens
    html: |
      <div style="background: var(--surface-2); padding: 12px; border-radius: var(--radius);">
        Custom component styled with active theme tokens
      </div>
```

---

### 3 Ways to Publish Markdown Reports

Already have a finished Markdown document (research note, RFC, post-mortem, or audit)? You don't need to rebuild it as blocks:

1. **Option A — Passthrough Mode (Lowest token cost)**:
   Point directly to the markdown file. The builder parses it, applies the document theme, and outputs a clean standalone artifact. Frontmatter (`---...---`) is stripped automatically:
   ```yaml
   title: "Q3 Research Note"
   theme: document
   source: /path/to/report.md
   ```

2. **Option B — `markdown-file` block (Framed report)**:
   Combine an existing `.md` file with top-level KPI metrics or a hero banner:
   ```yaml
   title: "Executive Summary"
   theme: document
   blocks:
     - type: hero
       title: "Q3 Executive Summary"
     - type: kpi-row
       items: [...]
     - type: divider
       label: "Full Report"
     - type: markdown-file
       path: /path/to/report.md
   ```

3. **Option C — `markdown` block (Inline)**:
   Embed Markdown prose directly inside the YAML specification:
   ```yaml
   blocks:
     - type: markdown
       content: |
         ## Executive Summary
         Revenue grew **18% QoQ** driven by expansion in the enterprise segment.
   ```

---

### 23 Built-in Modular Blocks

| Block | Description |
|---|---|
| `hero` | Header banner with title, subtitle, pill badge, and metadata |
| `kpi-row` | Responsive grid of KPI metric tiles with deltas, trends (`up`/`down`/`neutral`), and icons |
| `stats-grid` | Large-number highlight cards with custom theme accent colors |
| `table` | Responsive, striped data table with instant client-side column sorting |
| `chart-bar` | Bar chart (Chart.js) supporting vertical, horizontal, stacked configurations |
| `chart-line` | Smooth line chart (Chart.js) with optional area fill and tension control |
| `chart-pie` | Pie or donut chart (Chart.js) with legend and auto-palette binding |
| `mermaid-diagram` | Flowcharts, sequence diagrams, and ERDs rendered with Mermaid.js |
| `tabs` | Accessible tabbed panels with auto-redrawing of hidden charts and diagrams |
| `two-columns` | Multi-column layout with configurable ratio (`1:1`, `2:1`, `3:2`) and nested blocks |
| `timeline` | Vertical chronological milestones with visual status indicators (`done`, `active`, `pending`) |
| `progress-bars` | Multi-item progress bars with automatic percentage calculation |
| `list-cards` | Responsive grid of cards for features, links, and content blocks |
| `image` | Responsive image with auto-base64 inlining, captions, and fullscreen lightbox (`zoomable: true`) |
| `code-block` | Syntax-highlighted code snippets with dark-mode compatibility |
| `alert` | Semantic callout boxes (`info`, `warning`, `error`, `success`) with default icons |
| `text-section` | Structured prose section with heading and Markdown body |
| `markdown` | Inline GitHub-flavored Markdown text |
| `markdown-file` | Load and embed external `.md` files |
| `badge-row` | Color-coded tag row with customizable alignment |
| `divider` | Horizontal separator with optional text label |
| `spacer` | Configurable vertical whitespace |
| `raw` | **Universal escape hatch**: write arbitrary HTML, CSS, and JS with access to active theme variables |

---

### Independent CSS Themes

Themes decouple aesthetics from content. Switching a theme takes one line in YAML:

- **`default`**: Clean neutral theme suitable for general documents and mixed deliverables.
- **`data`**: Optimized for dashboards, dense metrics, sortable tables, and hover-highlighting.
- **`document`**: Optimized for long-form reading (720px readable width, 1.8 line-height, elegant typography).
- **`promo`**: High-impact landing pages and announcements (gradient hero, elevated cards).
- **`diagram`**: Centered, responsive layout for architecture and flow diagrams.

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
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_FORCE_PATH_STYLE` | S3-compatible object storage for uploaded artifact files. Leave `S3_BUCKET` unset to disable the feature entirely (upload endpoints answer `501`); `docker-compose.yml` sets these to its own bundled MinIO by default | unset (disabled) |
| `STORAGE_MAX_FILE_BYTES` | Hard per-file upload cap, independent of the team/artifact byte quotas set in `/admin/settings` | `26214400` (25 MiB) |
| `STORAGE_GC_INTERVAL_MINUTES` | How often the background sweeper deletes objects queued for removal (0 disables it) | `5` |

Most operational settings — registration mode, default key TTL, invite link lifetime, the CDN allowlist, the maximum artifact size, the maximum/default artifact lifetime, and storage quotas — can also be modified at runtime by superadmins in **Настройки инстанса** (`/admin/settings`); they don't need an environment variable or a restart.

### File storage and quotas

Uploaded files (images, attachments) live in an S3-compatible bucket, proxied through the app at
`/af/<token>` — the bucket itself stays private, no presigned URLs are ever handed out. A file
always belongs to exactly one artifact and is deleted with it (soft-delete, expiry, or an org being
deleted all queue its files for removal); there is no way for an orphaned file to exist.

Storage quotas are unlimited by default, at both the team and per-artifact level. A superadmin sets
instance-wide ceilings in `/admin/settings`; a team can set its own stricter override (never
looser) — the per-artifact one in its own team settings, the team-wide one only by a superadmin.
Before uploading, an agent can check `GET /api/v1/quota` (or `oa quota` / the `get_storage_quota`
MCP tool) to see remaining room and decide whether the upload is worth attempting.

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

An existing link's own access mode can also be changed in place — without revoking it and handing
out a new URL — right from its own viewer page (`/s/:token`), by anyone who can manage the artifact
(`PATCH /api/v1/shares/:id`).

---

## License

MIT © [emaxe](https://github.com/emaxe)
