import { existsSync, readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { requireCredentials } from "../config.js";
import { makeClient } from "../client.js";
import { resolveOrg } from "../org.js";
import { handleError } from "./artifacts.js";

interface ArtifactFile {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}

interface QuotaBucket {
  id: string;
  limitBytes: number | null;
  usedBytes: number;
  availableBytes: number | null;
}

interface QuotaSnapshot {
  storageEnabled: boolean;
  maxFileBytes: number;
  org: QuotaBucket;
  artifact?: QuotaBucket;
}

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

// A small built-in table rather than a dependency — only needs to cover what an artifact
// realistically attaches (images, a few document/media types); anything else falls back to
// application/octet-stream, which the server always forces to a download anyway (see
// INLINE_CONTENT_TYPES on the server — only a stricter allowlist of these is ever shown inline).
const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".txt": "text/plain",
  ".csv": "text/csv",
};

function inferContentType(filePath: string): string {
  return MIME_BY_EXTENSION[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit++;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(1)} ${units[unit]}`;
}

function formatQuotaBucket(label: string, bucket: QuotaBucket): string {
  const limit = bucket.limitBytes === null ? "unlimited" : formatBytes(bucket.limitBytes);
  return `${label}: ${formatBytes(bucket.usedBytes)} used of ${limit}`;
}

export async function quotaCommand(opts: { org?: string; artifact?: string; json?: boolean }) {
  const creds = requireCredentials();
  const client = makeClient(creds);
  const org = resolveOrg({ flag: opts.org, creds });
  const params = new URLSearchParams();
  if (opts.artifact) params.set("artifactId", opts.artifact);
  else if (org.orgId) params.set("orgId", org.orgId);

  try {
    const snapshot = await client.get<QuotaSnapshot>(`/quota${params.toString() ? `?${params}` : ""}`);
    if (opts.json) {
      console.log(JSON.stringify(snapshot, null, 2));
      return;
    }
    if (!snapshot.storageEnabled) {
      console.log("Object storage is not configured on this instance — file uploads are disabled.");
      return;
    }
    console.log(formatQuotaBucket("Team", snapshot.org));
    if (snapshot.artifact) console.log(formatQuotaBucket("Artifact", snapshot.artifact));
    console.log(`Max file size: ${formatBytes(snapshot.maxFileBytes)}`);
  } catch (err) {
    handleError(err);
  }
}

export async function filesUploadCommand(artifactId: string, filePath: string, opts: { name?: string; json?: boolean }) {
  if (!existsSync(filePath)) die(`File not found: ${filePath}`);
  const creds = requireCredentials();
  const client = makeClient(creds);

  const bytes = readFileSync(filePath);
  const name = opts.name ?? basename(filePath);
  const contentType = inferContentType(filePath);
  const form = new FormData();
  form.append("file", new File([bytes], name, { type: contentType }));

  try {
    const { file } = await client.postForm<{ file: ArtifactFile }>(`/artifacts/${artifactId}/files`, form);
    const url = `${creds.server.replace(/\/$/, "")}${file.url}`;
    if (opts.json) {
      console.log(JSON.stringify({ ...file, url }, null, 2));
    } else {
      console.log(`Uploaded: ${file.name} (${formatBytes(file.sizeBytes)})`);
      console.log(`URL: ${url}`);
    }
  } catch (err) {
    handleError(err);
  }
}

export async function filesListCommand(artifactId: string, opts: { json?: boolean }) {
  const creds = requireCredentials();
  const client = makeClient(creds);
  try {
    const { files } = await client.get<{ files: ArtifactFile[] }>(`/artifacts/${artifactId}/files`);
    if (opts.json) {
      console.log(JSON.stringify(files, null, 2));
      return;
    }
    for (const f of files) {
      console.log(`${f.id}  ${formatBytes(f.sizeBytes).padStart(9)}  ${f.contentType.padEnd(24)}  ${f.name}`);
    }
  } catch (err) {
    handleError(err);
  }
}

export async function filesRmCommand(artifactId: string, fileId: string) {
  const creds = requireCredentials();
  const client = makeClient(creds);
  try {
    await client.delete(`/artifacts/${artifactId}/files/${fileId}`);
    console.log(`Deleted ${fileId}`);
  } catch (err) {
    handleError(err);
  }
}
