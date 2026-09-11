import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findProjectConfig, projectConfigTarget, writeProjectConfig } from "../project-config.js";

let dir: string | undefined;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function makeTmpDir(): string {
  dir = mkdtempSync(join(tmpdir(), "oa-project-config-"));
  return dir;
}

describe("findProjectConfig", () => {
  it("returns null when no .oa.json exists anywhere up to the filesystem root", () => {
    const root = makeTmpDir();
    const nested = join(root, "a", "b");
    mkdirSync(nested, { recursive: true });
    expect(findProjectConfig(nested)).toBeNull();
  });

  it("finds .oa.json in the exact cwd", () => {
    const root = makeTmpDir();
    writeFileSync(join(root, ".oa.json"), JSON.stringify({ orgId: "org-1" }));
    const found = findProjectConfig(root);
    expect(found?.config.orgId).toBe("org-1");
  });

  it("walks up from a nested subdirectory to find .oa.json in an ancestor", () => {
    const root = makeTmpDir();
    const nested = join(root, "a", "b", "c");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(root, ".oa.json"), JSON.stringify({ orgId: "org-root" }));

    const found = findProjectConfig(nested);
    expect(found?.config.orgId).toBe("org-root");
    expect(found?.path).toBe(join(root, ".oa.json"));
  });

  it("prefers the nearest .oa.json over one further up the tree", () => {
    const root = makeTmpDir();
    const nested = join(root, "a", "b");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(root, ".oa.json"), JSON.stringify({ orgId: "org-root" }));
    writeFileSync(join(nested, ".oa.json"), JSON.stringify({ orgId: "org-nested" }));

    expect(findProjectConfig(nested)?.config.orgId).toBe("org-nested");
  });

  it("warns and returns null instead of throwing on invalid JSON", () => {
    const root = makeTmpDir();
    writeFileSync(join(root, ".oa.json"), "{ not valid json");
    expect(findProjectConfig(root)).toBeNull();
  });
});

describe("projectConfigTarget", () => {
  it("returns the path of an existing .oa.json when one is found", () => {
    const root = makeTmpDir();
    writeFileSync(join(root, ".oa.json"), JSON.stringify({ orgId: "org-1" }));
    expect(projectConfigTarget(root)).toBe(join(root, ".oa.json"));
  });

  it("targets the git root when no .oa.json exists yet", () => {
    const root = makeTmpDir();
    mkdirSync(join(root, ".git"));
    const nested = join(root, "src", "lib");
    mkdirSync(nested, { recursive: true });

    expect(projectConfigTarget(nested)).toBe(join(root, ".oa.json"));
  });

  it("falls back to cwd when neither .oa.json nor a .git root is found", () => {
    const root = makeTmpDir();
    const nested = join(root, "a");
    mkdirSync(nested, { recursive: true });
    expect(projectConfigTarget(nested)).toBe(join(nested, ".oa.json"));
  });
});

describe("writeProjectConfig", () => {
  it("creates a new file with the given patch", () => {
    const root = makeTmpDir();
    const path = join(root, ".oa.json");
    writeProjectConfig(path, { orgId: "org-1", orgSlug: "acme" });
    expect(findProjectConfig(root)?.config).toEqual({ orgId: "org-1", orgSlug: "acme" });
  });

  it("merges into an existing file rather than replacing it", () => {
    const root = makeTmpDir();
    const path = join(root, ".oa.json");
    writeFileSync(path, JSON.stringify({ server: "https://oa.example.com" }));
    writeProjectConfig(path, { orgId: "org-1" });
    expect(findProjectConfig(root)?.config).toEqual({ server: "https://oa.example.com", orgId: "org-1" });
  });
});
