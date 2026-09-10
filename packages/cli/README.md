# open-artifacts

CLI for [Open Artifacts](https://github.com/emaxe/open-artifacts) — a self-hosted, open
alternative to Claude Artifacts. Publish HTML, Markdown, Mermaid, or SVG content to your own
instance and get back a shareable link, from any AI agent or script.

```bash
npm install -g @emaxe/oa
```

## Usage

```bash
oa login --server https://artifacts.your-company.com   # one-time device-flow authorization
oa push report.html --title "Q3 Report" --share        # publish + print a share URL
oa list                                                 # see what you've published
oa get <artifact-id> -o report.html                     # fetch content back
oa share <artifact-id> --password "..." --expires 7d    # a password-protected, expiring link
```

Every command supports `--json` for machine-readable output. Run `oa --help` or `oa <command>
--help` for the full option list.

Credentials are saved to `~/.config/open-artifacts/credentials.json` (mode `600`) after `oa
login`. Alternatively, set `OA_TOKEN` (and `OA_SERVER`) as environment variables to skip the
device flow entirely — useful for CI or non-interactive agents that already have a key.

This CLI requires an Open Artifacts server to talk to — see the
[main repository](https://github.com/emaxe/open-artifacts) for how to self-host one via Docker
Compose.

## License

MIT
