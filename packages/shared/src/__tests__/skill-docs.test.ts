import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_CDN_ALLOWLIST } from "../csp.js";

// This suite guards against the design docs and the actual CSP/CDN policy drifting apart —
// `SKILL.md` and `references/design/*.md` are read by AI agents, not compiled, so nothing else
// catches it when one is edited without the other.
const skillDir = fileURLToPath(new URL("../../../../skills/open-artifacts", import.meta.url));
const skillMd = readFileSync(`${skillDir}/SKILL.md`, "utf8");
const designDir = `${skillDir}/references/design`;
const designFiles = readdirSync(designDir).filter((f) => f.endsWith(".md"));
const designDocs = Object.fromEntries(
  designFiles.map((f) => [f, readFileSync(`${designDir}/${f}`, "utf8")]),
);

const cdnHosts = DEFAULT_CDN_ALLOWLIST.map((url) => url.replace(/^https:\/\//, ""));

describe("SKILL.md CDN allowlist stays in sync with DEFAULT_CDN_ALLOWLIST", () => {
  it.each(cdnHosts)("mentions %s", (host) => {
    expect(skillMd).toContain(host);
  });
});

describe("design docs don't restate CSP policy that only SKILL.md should own", () => {
  it("names no CSP directive by name — refer to the CSP section instead", () => {
    for (const [file, text] of Object.entries(designDocs)) {
      for (const directive of ["script-src", "style-src", "connect-src"]) {
        expect(text, `${file} should not restate "${directive}" — link to SKILL.md's CSP section instead`)
          .not.toContain(directive);
      }
    }
  });

  it("every CDN host a design doc actually loads a script from is one of the allowed four", () => {
    // Recipes legitimately reference a real CDN URL (e.g. the Chart.js or mermaid <script src>) —
    // that's using the policy, not restating it. What must never drift is *which* hosts appear.
    const hostPattern = /https:\/\/([a-z0-9.-]+)\//g;
    for (const [file, text] of Object.entries(designDocs)) {
      for (const match of text.matchAll(hostPattern)) {
        const host = match[1];
        if (host === "fonts.googleapis.com" || host === "fonts.gstatic.com") continue; // allowed by CSP for fonts, not in the CDN script allowlist
        expect(cdnHosts, `${file} references https://${host}/, which is not in DEFAULT_CDN_ALLOWLIST`).toContain(host);
      }
    }
  });
});

describe("the design router in SKILL.md and the files on disk agree", () => {
  it("links every references/design/*.md file from SKILL.md", () => {
    for (const file of designFiles) {
      expect(skillMd, `SKILL.md should link references/design/${file}`).toContain(`design/${file}`);
    }
  });

  it("never links a references/ path that doesn't exist on disk", () => {
    const linked = [...skillMd.matchAll(/`(references\/[a-zA-Z0-9/_.-]+)`/g)].map((m) => m[1]);
    expect(linked.length).toBeGreaterThan(0);
    for (const relPath of linked) {
      expect(() => readFileSync(`${skillDir}/${relPath}`, "utf8"), `${relPath} linked from SKILL.md does not exist`).not.toThrow();
    }
  });
});

describe("token parity between DESIGN-core.md and the server's artifact-styles.ts", () => {
  // These are the neutral surface/text tokens both files must share so a hand-written `html`
  // artifact and a server-rendered `markdown` artifact read as one product. Update both together.
  const CANONICAL_HEX = [
    "#fafafa", "#ffffff", "#f4f4f5", "#e4e4e7", "#18181b", "#71717a", // light
    "#0a0a0b", "#232326", "#2c2c31", "#a1a1aa", // dark (shares #18181b / #f4f4f5 with light)
  ];

  it("DESIGN-core.md contains the canonical neutrals", () => {
    const core = designDocs["DESIGN-core.md"];
    expect(core).toBeDefined();
    for (const hex of CANONICAL_HEX) expect(core).toContain(hex);
  });

  it("artifact-styles.ts contains the same canonical neutrals", () => {
    const stylesPath = fileURLToPath(
      new URL("../../../../apps/api/src/views/artifact-styles.ts", import.meta.url),
    );
    const styles = readFileSync(stylesPath, "utf8");
    for (const hex of CANONICAL_HEX) expect(styles).toContain(hex);
  });
});
