import { describe, expect, it } from "vitest";
import { renderArtifactHtml } from "../../services/render.js";

describe("renderArtifactHtml", () => {
  it("passes html content through unchanged (its safety comes from the sandbox, not sanitization)", () => {
    const source = "<script>alert(1)</script><h1>hi</h1>";
    expect(renderArtifactHtml("html", source)).toBe(source);
  });

  it("renders markdown to HTML and strips embedded script tags", () => {
    const out = renderArtifactHtml("markdown", "# Title\n\n<script>alert(1)</script>\n\nSome *text*.");
    expect(out).toContain("<h1>Title</h1>");
    expect(out).not.toContain("<script>");
  });

  it("strips event-handler attributes from SVG content", () => {
    const out = renderArtifactHtml("svg", '<svg onload="alert(1)"><circle r="5"/></svg>');
    expect(out).not.toContain("onload");
    expect(out).toContain("<circle");
  });

  it("escapes mermaid source so it can't break out of the <pre> into markup", () => {
    const out = renderArtifactHtml("mermaid", "graph TD;\nA--></script><script>alert(1)</script>-->B;");
    expect(out).not.toContain("<script>alert(1)</script>");
    expect(out).toContain("mermaid.initialize");
  });

  it("wraps non-html content in a standalone document with a charset meta tag", () => {
    const out = renderArtifactHtml("markdown", "hello");
    expect(out).toContain("<!doctype html>");
    expect(out).toContain('meta charset="utf-8"');
  });

  it("declares color-scheme so the browser paints its own chrome in the right theme", () => {
    const out = renderArtifactHtml("markdown", "hello");
    expect(out).toContain('meta name="color-scheme" content="light dark"');
  });

  it("styles markdown for both themes and for print", () => {
    const out = renderArtifactHtml("markdown", "hello");
    expect(out).toContain("prefers-color-scheme: dark");
    expect(out).toContain("@media print");
  });

  it("styles markdown tables, not just the raw <table> tag", () => {
    const out = renderArtifactHtml("markdown", "| a | b |\n| - | - |\n| 1 | 2 |\n");
    expect(out).toContain("<table>");
    expect(out).toMatch(/th\s*{[^}]*background/);
  });

  it("initializes mermaid with the OS color-scheme rather than a hardcoded theme", () => {
    const out = renderArtifactHtml("mermaid", "graph TD; A-->B;");
    expect(out).toContain("matchMedia");
    expect(out).toContain('"dark"');
    expect(out).toContain('"default"');
  });

  it("never interpolates the mermaid source into a <script> block", () => {
    const source = "graph TD;\nA-->|</script><script>alert(1)</script>|B;";
    const out = renderArtifactHtml("mermaid", source);
    const scripts = [...out.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    for (const script of scripts) {
      expect(script).not.toContain("alert(1)");
      expect(script).not.toContain("graph TD");
    }
  });

  it("renders svg content onto a fixed light card regardless of page theme", () => {
    const out = renderArtifactHtml("svg", '<svg><circle r="5" fill="black"/></svg>');
    expect(out).toContain("oa-svg-card");
    expect(out).toContain("#ffffff");
  });

  it("never loads an external stylesheet or emits more than one <style> tag", () => {
    for (const [kind, content] of [
      ["markdown", "# hi"],
      ["svg", "<svg><circle r=\"5\"/></svg>"],
      ["mermaid", "graph TD; A-->B;"],
    ] as const) {
      const out = renderArtifactHtml(kind, content);
      expect(out).not.toContain('rel="stylesheet"');
      expect(out).not.toContain("@import");
      expect(out.match(/<style>/g)?.length ?? 0).toBe(1);
    }
  });
});
