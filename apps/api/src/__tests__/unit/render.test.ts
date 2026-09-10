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
});
