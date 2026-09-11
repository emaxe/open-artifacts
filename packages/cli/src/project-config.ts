import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const PROJECT_CONFIG_FILENAME = ".oa.json";

/** No secrets ever live here — it's meant to be committed alongside the project. */
export interface ProjectConfig {
  server?: string;
  orgId?: string;
  orgSlug?: string;
}

export interface ProjectConfigLocation {
  path: string;
  config: ProjectConfig;
}

/** Walks up from `cwd` to the filesystem root looking for `.oa.json`, the same way git/eslint find their config. */
export function findProjectConfig(cwd: string = process.cwd()): ProjectConfigLocation | null {
  let dir = cwd;
  for (;;) {
    const path = join(dir, PROJECT_CONFIG_FILENAME);
    if (existsSync(path)) {
      try {
        return { path, config: JSON.parse(readFileSync(path, "utf8")) as ProjectConfig };
      } catch {
        console.error(`Warning: ${path} is not valid JSON — ignoring it.`);
        return null;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return null; // reached the filesystem root
    dir = parent;
  }
}

/** Where a fresh `.oa.json` should be written: the nearest existing one, else the repo root, else cwd. */
export function projectConfigTarget(cwd: string = process.cwd()): string {
  const existing = findProjectConfig(cwd);
  if (existing) return existing.path;

  let dir = cwd;
  for (;;) {
    if (existsSync(join(dir, ".git"))) return join(dir, PROJECT_CONFIG_FILENAME);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(cwd, PROJECT_CONFIG_FILENAME);
}

/** Merges `patch` into the config at `path`, creating it if needed. */
export function writeProjectConfig(path: string, patch: Partial<ProjectConfig>): void {
  let current: ProjectConfig = {};
  if (existsSync(path)) {
    try {
      current = JSON.parse(readFileSync(path, "utf8")) as ProjectConfig;
    } catch {
      // Corrupt file holds no secrets worth preserving — just overwrite it.
    }
  }
  writeFileSync(path, `${JSON.stringify({ ...current, ...patch }, null, 2)}\n`, "utf8");
}
