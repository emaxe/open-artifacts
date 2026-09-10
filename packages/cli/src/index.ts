#!/usr/bin/env node
import { Command } from "commander";
import { isValidScope, API_KEY_SCOPES } from "./scopes.js";
import { login } from "./commands/login.js";
import { listCommand, pushCommand, getCommand, rmCommand } from "./commands/artifacts.js";
import { shareCommand, unshareCommand, whoamiCommand } from "./commands/share.js";

const program = new Command();
program.name("oa").description("CLI for Open Artifacts — self-hosted artifact hosting for AI agents").version("0.1.0");

program
  .command("login")
  .description("Authorize this device via OAuth device flow and save credentials")
  .option("--server <url>", "Open Artifacts server URL", "http://localhost:3000")
  .option("--name <name>", "Name to register this agent as")
  .option("--scopes <scopes>", "Comma-separated scopes to request", "artifacts:read,artifacts:write,shares:write")
  .action(async (opts) => {
    const scopes = String(opts.scopes).split(",").map((s: string) => s.trim());
    for (const scope of scopes) {
      if (!isValidScope(scope)) {
        console.error(`Invalid scope: ${scope}. Valid scopes: ${API_KEY_SCOPES.join(", ")}`);
        process.exit(1);
      }
    }
    await login({ server: opts.server, name: opts.name, scopes });
  });

program.command("whoami").description("Show the current credentials and verify they work").action(whoamiCommand);

program
  .command("list")
  .description("List artifacts in your org")
  .option("--json", "Output raw JSON")
  .action(listCommand);

program
  .command("push <file>")
  .description("Create or update an artifact from a local file")
  .option("--title <title>", "Artifact title (defaults to the filename)")
  .option("--kind <kind>", "html | markdown | mermaid | svg (inferred from extension if omitted)")
  .option("--id <id>", "Update an existing artifact instead of creating a new one")
  .option("--share", "Also create a public share link and print its URL")
  .option("--password <password>", "Create a password-protected share instead of a public one (implies --share)")
  .option("--message <message>", "Version message")
  .option("--json", "Output raw JSON")
  .action((file, opts) => pushCommand(file, { ...opts, share: opts.share || !!opts.password }));

program
  .command("get <id>")
  .description("Fetch an artifact's current content")
  .option("-o, --output <file>", "Write to a file instead of stdout")
  .action(getCommand);

program.command("rm <id>").description("Delete an artifact").action(rmCommand);

program
  .command("share <id>")
  .description("Create a share link for an artifact")
  .option("--password <password>", "Require this password to view")
  .option("--expires <duration>", "e.g. 7d, 12h, 0 for never (default: never)")
  .option("--version <n>", "Pin the share to a specific version number")
  .action(shareCommand);

program.command("unshare <shareId>").description("Revoke a share link").action(unshareCommand);

program.parseAsync(process.argv);
