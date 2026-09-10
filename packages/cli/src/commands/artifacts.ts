import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, basename } from "node:path";
import type { ArtifactKind } from "../scopes.js";
import { requireCredentials } from "../config.js";
import { makeClient, CliApiError } from "../client.js";

interface ArtifactSummary {
  id: string;
  title: string;
  kind: ArtifactKind;
  visibility: string;
  updatedAt: string;
}

function inferKind(filePath: string): ArtifactKind {
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

export async function listCommand(opts: { json?: boolean }) {
  const creds = requireCredentials();
  const client = makeClient(creds);
  try {
    const data = await client.get<{ artifacts: ArtifactSummary[] }>(`/artifacts?orgId=${creds.orgId}`);
    if (opts.json) {
      console.log(JSON.stringify(data.artifacts, null, 2));
      return;
    }
    for (const a of data.artifacts) {
      console.log(`${a.id}  ${a.kind.padEnd(9)}  ${a.visibility.padEnd(8)}  ${a.title}`);
    }
  } catch (err) {
    handleError(err);
  }
}

export async function pushCommand(
  filePath: string,
  opts: { title?: string; kind?: ArtifactKind; id?: string; share?: boolean; password?: string; message?: string; json?: boolean },
) {
  if (!existsSync(filePath)) die(`File not found: ${filePath}`);
  const content = readFileSync(filePath, "utf8");
  const kind = opts.kind ?? inferKind(filePath);
  const title = opts.title ?? basename(filePath);

  const creds = requireCredentials();
  const client = makeClient(creds);

  try {
    let artifactId = opts.id;
    if (artifactId) {
      await client.patch(`/artifacts/${artifactId}`, { content, message: opts.message });
    } else {
      const res = await client.post<{ artifact: { id: string } }>(`/artifacts?orgId=${creds.orgId}`, {
        title,
        kind,
        content,
        visibility: "private",
      });
      artifactId = res.artifact.id;
    }

    const result: Record<string, unknown> = { artifactId };

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
    die(`Error (${err.code}): ${err.message}`);
  }
  throw err;
}
