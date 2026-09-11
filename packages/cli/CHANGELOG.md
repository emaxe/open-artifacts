# Changelog

All notable changes to the `@emaxe/oa` package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**[English](CHANGELOG.md)** | **[Русский](CHANGELOG.ru.md)**

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
