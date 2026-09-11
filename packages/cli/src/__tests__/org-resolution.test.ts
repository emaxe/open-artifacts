import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveOrg } from "../org.js";
import type { Credentials } from "../config.js";

let dir: string | undefined;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function makeTmpDir(): string {
  dir = mkdtempSync(join(tmpdir(), "oa-org-resolution-"));
  return dir;
}

const userCreds: Credentials = { server: "https://oa.example.com", token: "oa_live_x", expiresAt: null, kind: "user", userId: "u1" };
const legacyAgentCreds: Credentials = { server: "https://oa.example.com", token: "oa_live_x", expiresAt: null, agentId: "a1", orgId: "org-legacy" };

describe("resolveOrg priority", () => {
  it("--org flag wins over everything else", () => {
    const root = makeTmpDir();
    writeFileSync(join(root, ".oa.json"), JSON.stringify({ orgId: "org-project" }));
    const res = resolveOrg({ flag: "org-flag", cwd: root, env: { OA_ORG: "org-env" }, creds: userCreds });
    expect(res).toEqual({ orgId: "org-flag", source: "flag" });
  });

  it("OA_ORG env wins over the project config", () => {
    const root = makeTmpDir();
    writeFileSync(join(root, ".oa.json"), JSON.stringify({ orgId: "org-project" }));
    const res = resolveOrg({ cwd: root, env: { OA_ORG: "org-env" }, creds: userCreds });
    expect(res).toEqual({ orgId: "org-env", source: "env" });
  });

  it("falls back to the project's .oa.json when no flag or env is given", () => {
    const root = makeTmpDir();
    writeFileSync(join(root, ".oa.json"), JSON.stringify({ orgId: "org-project", server: "https://oa.example.com" }));
    const res = resolveOrg({ cwd: root, env: {}, creds: userCreds });
    expect(res).toEqual({ orgId: "org-project", source: "project", configPath: join(root, ".oa.json") });
  });

  it("ignores a project config written for a different server", () => {
    const root = makeTmpDir();
    writeFileSync(join(root, ".oa.json"), JSON.stringify({ orgId: "org-project", server: "https://other.example.com" }));
    const res = resolveOrg({ cwd: root, env: {}, creds: userCreds });
    expect(res).toEqual({ source: "none" });
  });

  it("falls back to a legacy agent credentials file's locked org when nothing else resolves", () => {
    const root = makeTmpDir();
    const res = resolveOrg({ cwd: root, env: {}, creds: legacyAgentCreds });
    expect(res).toEqual({ orgId: "org-legacy", source: "credentials" });
  });

  it("never falls back to credentials.orgId for a personal (kind: user) key", () => {
    const root = makeTmpDir();
    const personalWithOrg: Credentials = { ...userCreds, orgId: "should-not-be-used" };
    const res = resolveOrg({ cwd: root, env: {}, creds: personalWithOrg });
    expect(res).toEqual({ source: "none" });
  });

  it("resolves to 'none' with no flag, env, project config, or usable credentials fallback", () => {
    const root = makeTmpDir();
    const res = resolveOrg({ cwd: root, env: {}, creds: userCreds });
    expect(res).toEqual({ source: "none" });
  });
});
