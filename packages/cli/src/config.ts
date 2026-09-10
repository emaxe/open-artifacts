import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Credentials {
  server: string;
  token: string;
  agentId: string;
  orgId: string;
  expiresAt: string | null;
}

const CONFIG_DIR = join(homedir(), ".config", "open-artifacts");
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json");

export function loadCredentials(): Credentials | null {
  const envToken = process.env.OA_TOKEN;
  const envServer = process.env.OA_SERVER;
  if (envToken) {
    return { server: envServer ?? "http://localhost:3000", token: envToken, agentId: "", orgId: "", expiresAt: null };
  }
  if (!existsSync(CREDENTIALS_PATH)) return null;
  return JSON.parse(readFileSync(CREDENTIALS_PATH, "utf8"));
}

export function saveCredentials(creds: Credentials): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

export function requireCredentials(): Credentials {
  const creds = loadCredentials();
  if (!creds) {
    console.error("Not logged in. Run `oa login` first (or set OA_TOKEN / OA_SERVER env vars).");
    process.exit(1);
  }
  if (creds.expiresAt && new Date(creds.expiresAt).getTime() <= Date.now()) {
    console.error("Your API key has expired. Run `oa login` again.");
    process.exit(1);
  }
  return creds;
}
