# Changelog

All notable changes to the `@emaxe/oa` package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**[English](CHANGELOG.md)** | **[Русский](CHANGELOG.ru.md)**

---

## [0.3.0] - 2026-09-11

### Added
- **Personal API Keys**: `oa login` now issues a personal key by default — valid across every team you belong to (with your real role in each), instead of one agent key per team. Use `oa login --agent` for the old behavior: a key locked to one team, for CI and narrowly-scoped use cases.
- **`oa orgs`**: Lists the teams your key can act in, marking the one currently selected for this project.
- **`oa use <team>`**: Sets the default team for the current project, saved to a `.oa.json` file next to it (no secrets — safe to commit). Pass `--global` to set it for the whole machine instead.
- **`--org <team>` flag**: Added to `oa list` and `oa push` to override the resolved default team for a single invocation.
- **Project-scoped config resolution**: `.oa.json` is found by walking up from the current directory, the same way `.git`/`.eslintrc` are — so the right team is picked up automatically no matter which subdirectory a command runs from.

### Changed
- Structured handling of the new `org_required` error: when a personal key belongs to more than one team and none is selected, the CLI prints the candidate list and points at `oa use`/`--org` instead of a raw error.
- Credentials file permissions (`600`) are now re-applied on every login, not just when the file is first created.

---

## [0.2.0] - 2026-09-11

### Added
- **OAuth Device Flow**: Added `oa login` command enabling interactive device authentication with code verification and browser activation.
- **Verification Command**: Added `oa whoami` command to check current credentials, active server, organization, and token expiration.
- **Enhanced Share Options**: Added `--password` and `--expires` flags to `oa push` and `oa share` for secure, time-limited artifact sharing.
- **Automatic Format Detection**: Automatic inference of artifact kind (`html`, `markdown`, `mermaid`, `svg`) based on file extension.
- **Artifact Management**: Added `oa rm` and `oa unshare` commands.
- **Bilingual Documentation**: Added English and Russian READMEs and Changelogs.

### Changed
- **Package Name**: Renamed npm package to [`@emaxe/oa`](https://www.npmjs.com/package/@emaxe/oa).
- **Global Flag**: Ensured all commands support `--json` for scripting and agent pipeline compatibility.

---

## [0.1.0] - 2026-09-10

### Added
- Initial CLI release supporting artifact push, list, and get operations.
