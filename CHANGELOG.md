# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**[English](CHANGELOG.md)** | **[Русский](CHANGELOG.ru.md)**

---

## [Unreleased]

## [0.6.0] - 2026-09-13

### Added
- **Viewer panel on the public share page (`/s/:token`)**: a header above the embedded artifact shows its title, type, displayed version number, and last-updated date to every visitor. A logged-in member of the artifact's team additionally sees the author and team name; the artifact's owner, a team owner/admin, or a superadmin gets the full panel — description, size, expiry, the share's view count, the version's commit message, and a version picker to browse older versions (view-only, via `?v=N`; never writes to the database, and never affects what any other visitor of the same link sees). The panel is collapsible (state remembered per-browser) and hidden when printing. "Copy link" (always copies the canonical URL, without `?v=`) and "Download source" are available to everyone, including anonymous visitors; "Open in workspace" is shown once the viewer has read access to the artifact.
- New `GET /s/:token/download` endpoint — the artifact's raw source, served as `text/plain` (never as `text/html` or `image/svg+xml`, regardless of the artifact's own `kind`) with `Content-Disposition: attachment`, so an `html`/`svg` artifact's own script can never execute in this app's origin.
- **Design templates for `html` artifacts**: four theme-specific design systems (`references/design/DESIGN-data.md`, `DESIGN-document.md`, `DESIGN-promo.md`, `DESIGN-diagram.md`) plus a shared `DESIGN-core.md` foundation (tokens, light/dark theming, responsive/print/accessibility rules, self-review checklist), shipped inside `skills/open-artifacts/`. `SKILL.md` now routes an agent to the matching template before it writes any markup.

### Changed
- **Breaking**: a view of `/embed/:token` by someone who can manage the artifact (its owner, a team owner/admin, or a superadmin) no longer increments the share's view count — browsing your own version history no longer inflates the metric that's supposed to measure your audience. Anonymous and other logged-in visitors are counted exactly as before.
- `/s/:token` now sends `Cache-Control: private, no-store` and `Vary: Cookie` — its response now depends on who's asking (the viewer panel differs by audience), so it must never be served from a shared cache to the wrong visitor.
- The public share page now discloses the artifact's title, type, currently-shown version number, and that version's date to anyone with the link — previously the page carried no metadata of any kind, just the embedded content itself.
- Server-rendered `markdown`/`mermaid`/`svg` artifacts now use a real stylesheet (`apps/api/src/views/artifact-styles.ts`) instead of a five-line placeholder: full typography scale, tables, code blocks, blockquotes, light/dark theming via `prefers-color-scheme`, and print styles. `mermaid` diagrams now pick their theme (`dark`/`default`) from the same signal instead of always rendering light.

## [0.5.0] - 2026-09-13

### Added
- **Team-Only Share Links (`team` mode)**: A third share mode alongside `public` and `password` — a `/s/:token` link that requires the viewer to be logged in and a member of the artifact's team (any role). No password needed; safe to paste into a team chat. An anonymous visitor is redirected to `/login?next=...`; a logged-in non-member gets a 403 page with a link to log in as someone else.
- **Team Link Policy**: Team owners/admins (including for their personal main workspace) can now set, in `/t/:orgId/settings`, the **default link mode** (`team` or `public`) used whenever a share is created without naming one, and whether the team **allows `public` links at all**. Disabling public links only blocks new ones — existing public shares keep working until revoked, either one at a time from the artifact page or in bulk (with a confirmation dialog showing the affected count) from team settings.
- **Instance-Wide Link Policy**: A superadmin sets the same two knobs instance-wide in `/admin/settings`. A team can only be equal-or-stricter than the instance, never looser: it cannot re-enable public links the instance disabled, nor default to `public` while public links are forbidden.
- New endpoints `GET /orgs/:id/share-policy` (effective policy plus a count of active public shares) and `POST /orgs/:id/shares/revoke-public` (bulk-revoke, idempotent).
- New CLI flags `--team` and `--public` on `oa push` and `oa share`, alongside the existing `--password`; both `oa push`/`oa share` now print the resolved share mode alongside the URL.

### Changed
- **Breaking**: `oa push --share` and `oa share <id>` with no mode flag now create a link in the **team's configured default mode** instead of always `public`. Use `--public` to get the old behavior explicitly.
- **Breaking**: MCP `create_share`'s `mode` argument no longer defaults to `"public"` — omitting it uses the team's configured default, same as the CLI. The tool result always echoes back the mode actually used.
- **Breaking**: `POST /artifacts/:id/shares`'s `mode` field is now optional (omitting it uses the team default) instead of required; requesting `"public"` when it's disallowed now returns `403 public_shares_forbidden` with `allowedModes` in the body.
- **Breaking**: `POST /s/:token/unlock` on a non-`password` share now returns `400 not_password_mode` instead of silently `{ok:true}`.
- The agent skill (`skills/open-artifacts/SKILL.md`) no longer instructs the agent to reason about link privacy (defaulting to no share, generating passwords, asking before going public) — that decision now belongs entirely to the server-side team/instance policy above; the skill only documents the three modes and the new error.

### Fixed
- A `password`-mode share whose `passwordHash` was `NULL` (a state that should never occur, but wasn't guarded against) was treated as fully public by the shared access-resolution matrix; it now correctly still requires a password.
- The login page's `?next=` redirect target was unvalidated, an open-redirect risk; it's now restricted to same-origin root-relative paths.

## [0.4.0] - 2026-09-11

### Added
- **Artifact Lifetime (TTL)**: Artifacts can now be set to expire. A superadmin sets an instance-wide maximum artifact lifetime in `/admin/settings` (minutes; unlimited by default) — it also serves as the default lifetime for new artifacts. Team owners/admins may set their own stricter maximum for their team, but never looser than the instance one. Callers may choose any lifetime up to the effective limit at creation time (CLI `oa push --lifetime`, the web UI, or the `lifetime` field in the REST/MCP API), and change it later via `PATCH`. On expiry the artifact's content is hard-deleted (all versions removed irreversibly) — only a tombstone row remains for audit/analytics. A background sweeper (`ARTIFACT_PURGE_INTERVAL_MINUTES`, default 5) performs the actual deletion; reads treat an expired artifact as gone immediately either way.

### Changed
- Lowering the instance or team maximum lifetime re-clamps every affected artifact's expiry from its own creation date (`min(current deadline, created_at + new max)`) and can make already-existing artifacts expire immediately; raising a maximum never extends anything already created.
- `GET /artifacts` and `GET /artifacts/:id` now omit/404 an artifact once its lifetime has passed, even before the background sweeper has run. Artifact payloads gained an `expiresAt` field.

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
