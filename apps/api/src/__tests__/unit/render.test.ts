import { describe, expect, it } from "vitest";
import { isRestylable, renderArtifactHtml } from "../../services/render.js";

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
    expect(out).toContain("darkMode: oaDark");
    expect(out).toContain("themeVariables");
  });

  it("keeps mermaid arrows intact (escaped exactly once)", () => {
    const out = renderArtifactHtml("mermaid", "graph LR\n  A --> B");
    expect(out).toContain("A --&gt; B");
    expect(out).not.toContain("&amp;gt;");
  });

  it("escapes markup in mermaid source", () => {
    const out = renderArtifactHtml("mermaid", "graph LR\n  A[<img src=x onerror=alert(1)>] --> B");
    expect(out).not.toContain("<img");
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

describe("renderArtifactHtml appearance", () => {
  const terminal = { theme: "terminal" as const, width: null };
  const constructorPage =
    '<!doctype html><html><head><meta charset="utf-8"><meta name="oa-generator" content="constructor"><style>:root{--bg:#fff}</style></head><body><main>x</main></body></html>';

  it("leaves html untouched when no appearance is given", () => {
    expect(renderArtifactHtml("html", "<p>hi</p>")).toBe("<p>hi</p>");
  });

  it("themes server-rendered kinds and sets the body class for markdown", () => {
    const md = renderArtifactHtml("markdown", "# Hi", { theme: "ocean", width: "wide" });
    expect(md).toContain('<style id="oa-theme">');
    expect(md).toContain("--accent:#0b6e8a");
    expect(md).toContain('<body class="oa-doc">');
    expect(md).toContain("--oa-measure:80ch");
    const svg = renderArtifactHtml("svg", "<svg><circle r='1'/></svg>", { theme: "ocean", width: "wide" });
    expect(svg).toContain("--accent:#0b6e8a");
    expect(svg).not.toContain("--oa-main-w"); // the svg card centres itself, no width override
    expect(renderArtifactHtml("mermaid", "graph TD;A-->B", terminal)).toContain("--bg:#e4e6e1");
  });

  it("puts the theme AFTER a constructor page's own styles so it wins, and adds the width override", () => {
    const out = renderArtifactHtml("html", constructorPage, { theme: "graphite", width: "full" });
    expect(out.indexOf(":root{--bg:#fff}")).toBeLessThan(out.indexOf('<style id="oa-theme">'));
    expect(out.indexOf('<style id="oa-theme">')).toBeLessThan(out.indexOf("</head>"));
    expect(out).toContain("--oa-main-w:100% !important");
  });

  it("puts the theme BEFORE a hand-written page's styles so its own :root still wins, and never forces a width", () => {
    const page = "<!doctype html><html><head><title>t</title><style>:root{--bg:#fff}</style></head><body>x</body></html>";
    const out = renderArtifactHtml("html", page, { theme: "graphite", width: "full" });
    expect(out.indexOf('<style id="oa-theme">')).toBeLessThan(out.indexOf(":root{--bg:#fff}"));
    expect(out).not.toContain("--oa-main-w");
  });

  it("themes fragments without producing quirks mode", () => {
    expect(renderArtifactHtml("html", "<!doctype html><p>x</p>", terminal).startsWith("<!doctype html><style")).toBe(true);
    expect(renderArtifactHtml("html", "<p>x</p>", terminal).startsWith('<style id="oa-theme">')).toBe(true);
  });
});

describe("forced colour scheme", () => {
  const constructorPage =
    '<!doctype html><html><head><meta name="oa-generator" content="constructor"><script>var isDark = window.matchMedia && window.matchMedia(\'(prefers-color-scheme: dark)\').matches;</script></head><body><main>x</main></body></html>';

  it("writes the forced scheme's tokens straight into :root, with no media query", () => {
    const dark = renderArtifactHtml("markdown", "# x", { theme: "ocean", width: null, scheme: "dark" });
    expect(dark).toContain("color-scheme:dark;");
    expect(dark).toContain("--bg:#0c1a21");
    const light = renderArtifactHtml("markdown", "# x", { theme: "ocean", width: null, scheme: "light" });
    expect(light).toContain("--bg:#dfeaee");
    expect(light.split('<style id="oa-theme">')[1]).not.toContain("prefers-color-scheme");
  });

  it("without a forced scheme the page still follows the OS", () => {
    const out = renderArtifactHtml("markdown", "# x", { theme: "ocean", width: null });
    expect(out.split('<style id="oa-theme">')[1]).toContain("prefers-color-scheme:dark");
  });

  it("answers the constructor page's own matchMedia dark check, so diagrams and charts match", () => {
    expect(renderArtifactHtml("html", constructorPage, { theme: "sand", width: null, scheme: "dark" })).toContain("({matches:true}).matches");
    expect(renderArtifactHtml("html", constructorPage, { theme: "sand", width: null, scheme: "light" })).toContain("({matches:false}).matches");
    expect(renderArtifactHtml("html", constructorPage, { theme: "sand", width: null })).toContain("window.matchMedia('(prefers-color-scheme: dark)')");
  });

  it("pins the mermaid darkMode flag too", () => {
    expect(renderArtifactHtml("mermaid", "graph TD;A-->B", { theme: "sand", width: null, scheme: "dark" })).toContain("var oaDark = true;");
  });

  it("never rewrites a hand-written page's scripts", () => {
    const page = "<html><head></head><body><script>window.matchMedia('(prefers-color-scheme: dark)')</script></body></html>";
    expect(renderArtifactHtml("html", page, { theme: "sand", width: null, scheme: "dark" })).toContain("window.matchMedia('(prefers-color-scheme: dark)')");
  });
});

describe("isRestylable", () => {
  it("covers server-rendered kinds and constructor pages, but not hand-written html", () => {
    expect(isRestylable("markdown", "x")).toEqual({ theme: true, width: true });
    expect(isRestylable("mermaid", "x")).toEqual({ theme: true, width: true });
    expect(isRestylable("svg", "<svg/>")).toEqual({ theme: true, width: false });
    expect(isRestylable("html", '<meta name="oa-generator" content="constructor">')).toEqual({ theme: true, width: true });
    expect(isRestylable("html", "<h1>hi</h1>")).toBeNull();
  });
});

describe("artifact font", () => {
  it("replaces --font-sans after the theme and puts every @import first", () => {
    const out = renderArtifactHtml("markdown", "# x", { theme: "editorial", width: null, font: "jetbrains-mono" });
    const css = out.split('<style id="oa-theme">')[1]!.split("</style>")[0]!;
    expect(css.startsWith('@import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono')).toBe(true);
    const lastImport = css.lastIndexOf("@import");
    expect(css.indexOf(":root{")).toBeGreaterThan(lastImport); // no rule precedes an @import
    expect(css.lastIndexOf("--font-sans:")).toBeGreaterThan(css.indexOf("--font-sans:")); // font rule wins over the theme's
    expect(css).toContain('--font-sans:"JetBrains Mono"');
  });
  it("without a font the theme's own is untouched", () => {
    const css = renderArtifactHtml("markdown", "# x", { theme: "editorial", width: null }).split('<style id="oa-theme">')[1]!;
    expect(css).toContain('--font-sans:"Source Serif 4"');
    expect(css).not.toContain("JetBrains");
  });
});
