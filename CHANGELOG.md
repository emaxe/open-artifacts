# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**[English](CHANGELOG.md)** | **[Русский](CHANGELOG.ru.md)**

---

## [0.3.0] - 2026-09-11

### Added
- **Personal (User-Scoped) API Keys**: `oa login` now issues a personal key by default — one login, valid across every team you belong to, with your real role in each, instead of one agent key per team. `oa orgs` lists your teams and the currently selected one; `oa use <team>` sets a default for the current project (written to a secret-free `.oa.json` you can commit) or `--global` for the whole machine. The MCP server gained a matching `orgId` parameter and a `list_orgs` tool, and a request with no team selected and more than one candidate gets a structured `org_required` error listing them instead of guessing. Agent keys (`oa login --agent`) are unchanged and remain the right choice for CI and narrowly-scoped access. New `Settings > Личные API-ключи` page to issue and revoke personal keys from the web UI.
- **Auto-Provisioned Main Workspace**: Every user now gets a personal "main" workspace on registration — including when registering through an invite link, alongside the inviting team — instead of landing with zero teams.
- **Full Invite Lifecycle**: Invites are now a real state machine (`pending` / `accepted` / `declined` / `revoked`) with list, revoke, and reissue endpoints; a public link preview at `/invite/:token`; and an in-app "Приглашения" (`/invites`) inbox so an already-registered invitee can discover and accept or decline an invite without any email delivery.
- **Team Identification for Same-Named Teams**: A single `OrgIdentity` component (id-derived color monogram, "Основное" badge, owner/slug secondary line) used everywhere a team is rendered, plus owner email and member/artifact counts in every team listing — so two teams (or two personal workspaces) sharing a display name stay distinguishable.
- **Searchable Team Switcher**: The sidebar's team switcher is now a searchable popover grouped by "Основное" / "Мои команды" / (superadmin) "Все команды инстанса", backed by server-side search.
- **Restructured Admin Area**: `/admin` is now real routed tabs (Overview, Users, Teams, Audit, Instance Settings) instead of one 387-line component; user search by name as well as email with real `total`-based pagination and team-membership chips; keyset-paginated audit log with resolved actor names/emails and Russian action labels; all five instance settings are editable (previously only registration mode had a UI).
- **Agent Instructions for Everyone**: The agent-connection cheatsheet moved from `/admin/instructions` to `/help/agents`, available to any signed-in user — connecting an agent is a team task, not a superadmin one. Old links still redirect.
- **Tailwind v4 Design System**: The whole web app moved off hand-rolled CSS classes onto Tailwind v4 and a small set of accessible primitives (`Button`, `Dialog`, `ConfirmDialog`, `DropdownMenu`, `Toast`, `Table`, `EmptyState`, and others), with a light/dark/system theme toggle and a responsive mobile nav drawer — with zero added runtime dependencies.
- **Team Management**: Renaming a team, adding an existing user directly to a team (bypassing the invite round-trip), and a superadmin-only storage quota editor.

### Changed
- **`GET /auth/me` No Longer Lists Every Org for Superadmins**: It now returns only the caller's own memberships, plus `mainOrgId` and a pending-invite count — a superadmin reaches teams they don't belong to via search instead. (Breaking API change for any external client relying on the old shape.)
- Native `confirm()` / `alert()` / `prompt()` dialogs — the last ones left in the app — replaced with proper modal components.

### Fixed
- **Invite Email Spoofing**: Registering through an invite link no longer trusts a caller-supplied email that doesn't match the invite — closing a hole where anyone holding a link could join under an arbitrary address.
- A user could previously be removed as the last remaining owner of the org they created via `DELETE /orgs/:id/members/:userId` (only `PATCH` had the guard); both now refuse it, and a team's creator can never leave or be removed from their own main workspace.
- Login and registration no longer redirect to a nonexistent `/artifacts` route.

---

## [0.2.0] - 2026-09-11

### Added
- **Model Context Protocol (MCP) Server**: Built-in HTTP Streamable endpoint at `/mcp` providing tools (`whoami`, `list_artifacts`, `get_artifact`, `create_artifact`, `update_artifact`, `delete_artifact`, `create_share`, `list_shares`, `revoke_share`) for seamless integration with Cursor, Claude Desktop, Claude Code, and other LLM clients.
- **AI Agent Skill**: Ready-to-use agent skill specification conforming to [skills.sh](https://skills.sh/emaxe/open-artifacts) (`skills/open-artifacts/SKILL.md`) enabling autonomous CLI installation, verification, and artifact workflow in AI developer tools.
- **Interactive OAuth Device Flow**: Complete device-flow authorization support via `oa login` with short user verification codes (`ABCD-1234`) approved in browser at `/activate`.
- **Multi-Tenant Organization & Team Management**: Full support for multi-tenancy, team workspaces, member invitation, user management, and role-based permissions (`superadmin`, `admin`, `member`).
- **Interactive Runner (`run.sh`)**: Terminal management script for running Docker production containers, local dev environment, testing, and migrations via an interactive menu.
- **Admin Instructions Page**: Interactive documentation and copyable agent setup commands directly inside the web UI at `/admin/instructions`.
- **Expiring & Password-Protected Shares**: Support for temporary shares (`--expires 1h/1d/7d/30d`) and optional password protection (`--password`).
- **Bilingual Documentation**: Comprehensive documentation in both English and Russian, including READMEs, Changelogs, badges, and GitHub metadata.

### Changed
- **CLI Package Renamed**: Published CLI package renamed to [`@emaxe/oa`](https://www.npmjs.com/package/@emaxe/oa) on npm.
- **Team Switcher Enhancement**: Polished Team Switcher component to display friendly organization and team names and grant superadmins access across all workspaces.

### Fixed
- Fixed TypeScript `noUncheckedIndexedAccess` handling in count query results for API endpoints.
- Fixed team display consistency across user profiles and navigation bars.

---

## [0.1.0] - 2026-09-10

### Added
- Initial release of Open Artifacts:
  - Self-hosted artifact hosting service for AI agents and developer workflows.
  - Zero-trust sandboxed `<iframe>` rendering for HTML, Markdown, Mermaid diagrams, and SVG assets.
  - REST API built on Hono and PostgreSQL with Drizzle ORM.
  - React + Vite single-page application for user and administrator dashboard.
  - Initial `oa` CLI for agent interaction and content publishing.
  - Single-command deployment using Docker Compose.
