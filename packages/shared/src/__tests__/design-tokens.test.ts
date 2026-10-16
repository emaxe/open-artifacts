import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fontFaceCss, tokensCss } from "../design/tokens.js";

const css = readFileSync(new URL("../design/tokens.css", import.meta.url), "utf8");

function block(selectorStart: string): Record<string, string> {
  const from = css.indexOf(selectorStart);
  const body = css.slice(css.indexOf("{", from) + 1, css.indexOf("}", from));
  return Object.fromEntries([...body.matchAll(/--oa-([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const light = block(":root {");
const dark = block(':root[data-theme="dark"] {');

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("design tokens", () => {
  it("tokens.ts stays in sync with the generated tokens.css (run `pnpm gen:tokens`)", () => {
    expect(css).toContain(tokensCss);
    expect(css).toContain(fontFaceCss("./fonts/"));
  });

  it("light and dark define the same roles", () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).filter((k) => !/^(font-sans|step-|radius|ease-|dur-)/.test(k)).sort());
  });

  for (const [name, theme] of [["light", light], ["dark", dark]] as const) {
    it(`${name}: text pairs meet WCAG AA (4.5:1)`, () => {
      const pairs: [string, string][] = [
        ["fg", "bg"],
        ["fg", "panel"],
        ["muted", "bg"],
        ["muted", "panel"],
        ["accent-fg", "accent"],
        ["field-fg", "field"],
        ["danger-fg", "danger"],
        ["accent", "bg"],
        ["accent", "accent-soft"],
      ];
      for (const [fg, bg] of pairs) {
        expect(contrast(theme[fg], theme[bg]), `${name}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
