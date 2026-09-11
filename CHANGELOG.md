# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**[English](CHANGELOG.md)** | **[Русский](CHANGELOG.ru.md)**

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
