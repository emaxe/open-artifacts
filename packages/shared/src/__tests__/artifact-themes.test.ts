import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_THEMES,
  ARTIFACT_THEME_IDS,
  DEFAULT_ARTIFACT_THEME,
  THEME_COLOR_TOKENS,
  buildThemeCss,
  listArtifactThemes,
  resolveArtifactTheme,
  type ThemeColors,
} from "../artifact-themes.js";
import { ARTIFACT_WIDTHS, buildWidthCss } from "../artifact-width.js";
import { ARTIFACT_FONT_IDS, ARTIFACT_FONTS, buildFontCss } from "../artifact-fonts.js";

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const schemes = ["light", "dark"] as const;
const cases = ARTIFACT_THEME_IDS.flatMap((id) => schemes.map((s) => [id, s] as const));

describe("artifact themes", () => {
  it("registers every id", () => {
    expect(Object.keys(ARTIFACT_THEMES).sort()).toEqual([...ARTIFACT_THEME_IDS].sort());
    expect(ARTIFACT_THEME_IDS).toHaveLength(5);
    expect(listArtifactThemes()).toHaveLength(5);
  });

  it.each(cases)("%s/%s defines every colour token as a literal", (id, scheme) => {
    const colors = ARTIFACT_THEMES[id][scheme];
    expect(Object.keys(colors).sort()).toEqual([...THEME_COLOR_TOKENS].sort());
    for (const v of Object.values(colors)) expect(v).toMatch(/^(#[0-9a-f]{6}|rgba\([\d., ]+\))$/i);
  });

  it.each(cases)("%s/%s meets contrast targets", (id, scheme) => {
    const c: ThemeColors = ARTIFACT_THEMES[id][scheme];
    const min = (a: string, b: string, ratio: number, what: string) =>
      expect(contrast(a, b), `${id}/${scheme}: ${what} (${a} on ${b})`).toBeGreaterThanOrEqual(ratio);
    min(c.fg, c.bg, 4.5, "fg on bg");
    min(c.fg, c.surface, 4.5, "fg on surface");
    min(c.fg, c["surface-2"], 4.5, "fg on surface-2");
    min(c["fg-muted"], c.bg, 4.5, "fg-muted on bg");
    min(c["fg-muted"], c.surface, 4.5, "fg-muted on surface");
    min(c.accent, c.bg, 4.5, "accent (links) on bg");
    min(c.accent, c.surface, 4.5, "accent on surface");
    min(c["accent-fg"], c.accent, 4.5, "accent-fg on accent");
    min(c.fg, c["accent-soft"], 4.5, "fg on accent-soft");
    min(c["field-fg"], c.field, 4.5, "field-fg on field");
    for (const k of ["pos", "neg", "warn"] as const) min(c[k], c.surface, 4.5, `${k} on surface`);
    for (const k of ["c1", "c2", "c3", "c4", "c5", "c6"] as const) min(c[k], c.surface, 3, `${k} on surface`);
  });

  it("sand is byte-identical to the constructor default.css tokens", () => {
    const css = readFileSync(
      fileURLToPath(new URL("../../../../skills/open-artifacts/constructor/themes/default.css", import.meta.url)),
      "utf8",
    );
    const [, light = "", dark = ""] = css.match(/:root \{([\s\S]*?)\n\}[\s\S]*?prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\n  \}/) ?? [];
    const read = (block: string, tok: string) =>
      block.match(new RegExp(`--${tok}:\\s*([^;]+);`))?.[1]?.trim();
    for (const tok of THEME_COLOR_TOKENS) {
      expect(read(light, tok), `light --${tok}`).toBe(ARTIFACT_THEMES.sand.light[tok]);
      expect(read(dark, tok), `dark --${tok}`).toBe(ARTIFACT_THEMES.sand.dark[tok]);
    }
  });

  it("buildThemeCss emits both schemes and imports the font once", () => {
    const css = buildThemeCss("terminal");
    expect(css).toContain("@import url(");
    expect(css).toContain("--bg:#e4e6e1");
    expect(css).toMatch(/prefers-color-scheme:dark\)\{:root\{[^}]*--bg:#0a0e0b/);
    expect(buildThemeCss("sand")).not.toContain("@import");
  });
});

describe("resolveArtifactTheme", () => {
  it("prefers artifact over team over service", () => {
    expect(resolveArtifactTheme("ocean", "editorial", "graphite")).toBe("ocean");
    expect(resolveArtifactTheme(null, "editorial", "graphite")).toBe("editorial");
    expect(resolveArtifactTheme(undefined, null, "graphite")).toBe("graphite");
  });
  it("skips unknown ids and bottoms out at the default", () => {
    expect(resolveArtifactTheme("retired", "ocean", "graphite")).toBe("ocean");
    expect(resolveArtifactTheme(null, null, "nope")).toBe(DEFAULT_ARTIFACT_THEME);
  });
});

describe("constructor palettes.json", () => {
  it("is up to date (run `pnpm --filter @open-artifacts/shared gen:palettes`)", () => {
    const file = fileURLToPath(new URL("../../../../skills/open-artifacts/constructor/themes/palettes.json", import.meta.url));
    const palettes = JSON.parse(readFileSync(file, "utf8"));
    expect(palettes).toEqual(Object.fromEntries(ARTIFACT_THEME_IDS.map((id) => [id, buildThemeCss(id)])));
  });
});

describe("buildThemeCss with a forced scheme", () => {
  it("emits one scheme's tokens unconditionally", () => {
    const dark = buildThemeCss("terminal", "dark");
    expect(dark).toContain("color-scheme:dark;");
    expect(dark).toContain("--bg:#0a0e0b");
    expect(dark).not.toContain("@media");
    expect(buildThemeCss("terminal", "light")).toContain("--bg:#e4e6e1");
  });
});

describe("artifact fonts", () => {
  it.each(ARTIFACT_FONT_IDS)("%s has a fallback stack and only loads from Google Fonts", (id) => {
    const f = ARTIFACT_FONTS[id];
    expect(f.stack).toMatch(/sans-serif|serif|monospace/);
    if (f.fontsUrl) expect(f.fontsUrl.startsWith("https://fonts.googleapis.com/")).toBe(true);
  });
  it("buildFontCss splits the import from the rule", () => {
    const css = buildFontCss("inter");
    expect(css.imports).toContain("@import url(");
    expect(css.rules).toBe(`:root{--font-sans:${ARTIFACT_FONTS.inter.stack};}`);
    expect(buildFontCss("system").imports).toBe("");
  });
  it("fonts.json for the constructor is up to date (run gen:palettes)", () => {
    const file = fileURLToPath(new URL("../../../../skills/open-artifacts/constructor/themes/fonts.json", import.meta.url));
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(Object.fromEntries(ARTIFACT_FONT_IDS.map((id) => [id, buildFontCss(id)])));
  });
  it("the standalone CLI lists the same fonts", () => {
    const cli = readFileSync(fileURLToPath(new URL("../../../cli/src/scopes.ts", import.meta.url)), "utf8");
    const list = JSON.parse((cli.match(/ARTIFACT_FONT_IDS = (\[[^\]]*\])/)?.[1] ?? "[]").replace(/,\s*\]/, "]"));
    expect(list).toEqual([...ARTIFACT_FONT_IDS]);
  });
});

describe("web generated theme list", () => {
  it("is up to date (run `pnpm --filter @open-artifacts/shared gen:palettes`)", () => {
    const file = fileURLToPath(new URL("../../../../apps/web/src/lib/artifactThemes.generated.ts", import.meta.url));
    const text = readFileSync(file, "utf8");
    expect(text).toContain(JSON.stringify(listArtifactThemes(), null, 2));
    for (const id of ARTIFACT_THEME_IDS) expect(text).toContain(`"${id}"`);
  });
});

describe("standalone CLI copy", () => {
  it("lists the same themes and widths as the shared registry", () => {
    const cli = readFileSync(fileURLToPath(new URL("../../../cli/src/scopes.ts", import.meta.url)), "utf8");
    const read = (name: string) =>
      JSON.parse((cli.match(new RegExp(`${name} = (\\[[^\\]]*\\])`))?.[1] ?? "[]").replace(/,\s*\]/, "]"));
    expect(read("ARTIFACT_THEME_IDS")).toEqual([...ARTIFACT_THEME_IDS]);
    expect(read("ARTIFACT_WIDTHS")).toEqual([...ARTIFACT_WIDTHS]);
  });
});

describe("buildWidthCss", () => {
  it("caps text measure only in wide and full", () => {
    expect(buildWidthCss("full")).toContain("--oa-main-w:100%");
    expect(buildWidthCss("full")).toContain("--oa-measure:80ch");
    expect(buildWidthCss("narrow")).toContain("--oa-measure:none");
  });
});
