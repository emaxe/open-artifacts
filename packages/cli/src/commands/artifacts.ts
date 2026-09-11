import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, basename } from "node:path";
import type { ArtifactKind } from "../scopes.js";
import { requireCredentials } from "../config.js";
import { makeClient, CliApiError, type OrgChoice } from "../client.js";
import { resolveOrg } from "../org.js";

interface ArtifactSummary {
  id: string;
  title: string;
  kind: ArtifactKind;
  visibility: string;
  updatedAt: string;
  expiresAt: string | null;
}

export function inferKind(filePath: string): ArtifactKind {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".md" || ext === ".markdown") return "markdown";
  if (ext === ".svg") return "svg";
  if (ext === ".mmd" || ext === ".mermaid") return "mermaid";
  return "html";
}

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

export async function listCommand(opts: { json?: boolean; org?: string }) {
  const creds = requireCredentials();
  const client = makeClient(creds);
  const org = resolveOrg({ flag: opts.org, creds });
  try {
    const data = await client.get<{ artifacts: ArtifactSummary[] }>(`/artifacts${org.orgId ? `?orgId=${org.orgId}` : ""}`);
    if (opts.json) {
      console.log(JSON.stringify(data.artifacts, null, 2));
      return;
    }
    for (const a of data.artifacts) {
      const expiry = a.expiresAt ? `expires ${a.expiresAt}` : "never expires";
      console.log(`${a.id}  ${a.kind.padEnd(9)}  ${a.visibility.padEnd(8)}  ${expiry.padEnd(28)}  ${a.title}`);
    }
  } catch (err) {
    handleError(err);
  }
}

export async function pushCommand(
  filePath: string,
  opts: {
    title?: string;
    kind?: ArtifactKind;
    id?: string;
    share?: boolean;
    password?: string;
    message?: string;
    json?: boolean;
    org?: string;
    lifetime?: string;
  },
) {
  if (!existsSync(filePath)) die(`File not found: ${filePath}`);
  const content = readFileSync(filePath, "utf8");
  const kind = opts.kind ?? inferKind(filePath);
  const title = opts.title ?? basename(filePath);

  const creds = requireCredentials();
  const client = makeClient(creds);

  try {
    let artifactId = opts.id;
    let expiresAt: string | null | undefined;
    if (artifactId) {
      const res = await client.patch<{ artifact: { expiresAt: string | null } }>(`/artifacts/${artifactId}`, {
        content,
        message: opts.message,
        lifetime: opts.lifetime,
      });
      expiresAt = res.artifact.expiresAt;
    } else {
      // Updating an existing artifact never needs an org (the id alone identifies it) — only
      // resolve one when we're about to create.
      const org = resolveOrg({ flag: opts.org, creds });
      const res = await client.post<{ artifact: { id: string; expiresAt: string | null } }>(
        `/artifacts${org.orgId ? `?orgId=${org.orgId}` : ""}`,
        { title, kind, content, visibility: "private", lifetime: opts.lifetime },
      );
      artifactId = res.artifact.id;
      expiresAt = res.artifact.expiresAt;
    }

    const result: Record<string, unknown> = { artifactId, expiresAt };

    if (opts.share) {
      const shareRes = await client.post<{ url: string }>(`/artifacts/${artifactId}/shares`, {
        mode: opts.password ? "password" : "public",
        password: opts.password,
      });
      result.shareUrl = shareRes.url;
    }

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Artifact: ${artifactId}`);
      console.log(expiresAt ? `Expires: ${expiresAt}` : "Expires: never");
      if (result.shareUrl) console.log(`Share URL: ${result.shareUrl}`);
    }
  } catch (err) {
    handleError(err);
  }
}

export async function getCommand(id: string, opts: { output?: string }) {
  const creds = requireCredentials();
  const client = makeClient(creds);
  try {
    const data = await client.get<{ content: string }>(`/artifacts/${id}`);
    if (opts.output) {
      writeFileSync(opts.output, data.content, "utf8");
      console.log(`Saved to ${opts.output}`);
    } else {
      process.stdout.write(data.content);
    }
  } catch (err) {
    handleError(err);
  }
}

export async function rmCommand(id: string) {
  const creds = requireCredentials();
  const client = makeClient(creds);
  try {
    await client.delete(`/artifacts/${id}`);
    console.log(`Deleted ${id}`);
  } catch (err) {
    handleError(err);
  }
}

export function formatOrgChoices(orgs: OrgChoice[]): string {
  return orgs.map((o) => `  ${o.slug.padEnd(24)}  ${o.role.padEnd(7)}  ${o.name}`).join("\n");
}

export function handleError(err: unknown): never {
  if (err instanceof CliApiError) {
    if (err.code === "key_expired") {
      die("Your API key has expired. Run `oa login` again.");
    }
    if (err.code === "quota_exceeded") {
      die("Organization storage quota exceeded.");
    }
    if (err.code === "version_conflict") {
      die("Someone else changed this artifact since you last read it (409). Fetch the latest with `oa get` and retry.");
    }
    if (err.code === "lifetime_exceeds_max") {
      const maxMinutes = err.body?.error?.maxLifetimeMinutes;
      die(`Requested lifetime exceeds the maximum this instance/team allows${maxMinutes ? ` (${maxMinutes} minutes)` : ""}. Retry with --lifetime <= that, or omit --lifetime to use the default.`);
    }
    if (err.code === "org_required") {
      const orgs = err.body?.error?.orgs ?? [];
      die(`Not sure which team to publish to — you belong to several:\n${formatOrgChoices(orgs)}\n\nRun \`oa use <slug>\` to set a default for this project, or pass --org <slug>.`);
    }
    die(`Error (${err.code}): ${err.message}`);
  }
  throw err;
}
