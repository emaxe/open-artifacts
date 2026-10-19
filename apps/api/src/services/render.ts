import sanitizeHtml from "sanitize-html";
import MarkdownIt from "markdown-it";
import { buildFontCss, buildThemeCss, buildWidthCss, type ArtifactKind, type ArtifactFontId, type ArtifactScheme, type ArtifactThemeId, type ArtifactWidth } from "@open-artifacts/shared";
import { escapeHtml } from "./html.js";
import { ARTIFACT_BASE_CSS, ARTIFACT_SVG_CSS } from "../views/artifact-styles.js";

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

const MARKDOWN_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2"]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ["src", "alt", "title"],
    "*": ["id", "class"],
  },
  // markdown-it never emits inline event handlers itself, but strip any that slip through
  // (e.g. via a raw HTML passthrough some future markdown-it plugin might allow).
  disallowedTagsMode: "discard",
};

const SVG_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "svg", "g", "path", "circle", "rect", "ellipse", "line", "polyline", "polygon",
    "text", "tspan", "defs", "linearGradient", "radialGradient", "stop", "clipPath",
    "mask", "pattern", "use", "symbol", "title", "desc", "marker", "filter",
    "feGaussianBlur", "feOffset", "feMerge", "feMergeNode", "feColorMatrix", "feBlend",
  ],
  allowedAttributes: false, // allow all attributes on the allowed tags...
  allowedSchemes: ["data", "http", "https"],
  transformTags: {
    "*": (tagName, attribs) => {
      // ...except any `on*` event-handler attribute, which we strip explicitly on every tag.
      const safe: Record<string, string> = {};
      for (const [key, value] of Object.entries(attribs)) {
        if (!/^on/i.test(key) && !/^javascript:/i.test(value)) safe[key] = value;
      }
      return { tagName, attribs: safe };
    },
  },
};

/**
 * Renders artifact content of any supported `kind` into a standalone HTML document ready to be
 * served from `/embed/:token` inside the sandboxed iframe. `html` content passes through as-is
 * (its safety comes from the sandbox + CSP, not from sanitization); everything else is rendered
 * server-side and sanitized as a second line of defense.
 */
export interface RenderAppearance {
  theme: ArtifactThemeId;
  /** `null` = the kind's own default width. */
  width: ArtifactWidth | null;
  /** Forces light or dark regardless of the OS setting; absent/`null` = follow `prefers-color-scheme`. */
  scheme?: ArtifactScheme | null;
  /** Body typeface; absent/`null` = the theme's own. */
  font?: ArtifactFontId | null;
}

/** Marker `constructor/build.mjs` writes into every page it generates. */
const CONSTRUCTOR_MARKER = /<meta\s+name=["']oa-generator["']\s+content=["']constructor["']/i;

/** True for pages `constructor/build.mjs` generated — the only `html` we know how to theme in depth. */
export function isConstructorHtml(html: string): boolean {
  return CONSTRUCTOR_MARKER.test(html);
}

/**
 * Whether an artifact responds to a theme / width / colour scheme at all: the server-rendered kinds
 * and constructor pages do; hand-written HTML only where it happens to use our token names, so a
 * viewer-facing picker would mostly appear to do nothing.
 */
export function isRestylable(kind: ArtifactKind, content: string): { theme: boolean; width: boolean } | null {
  if (kind === "html") return isConstructorHtml(content) ? { theme: true, width: true } : null;
  return { theme: true, width: kind !== "svg" };
}

function themeStyleTag(a: RenderAppearance, withWidth: boolean): string {
  // Font `@import`s have to come before any rule, so they lead; the theme's own import follows.
  const font = a.font ? buildFontCss(a.font) : null;
  const css = (font?.imports ?? "") + buildThemeCss(a.theme, a.scheme) + (font?.rules ?? "") + (withWidth && a.width ? buildWidthCss(a.width) : "");
  return `<style id="oa-theme">${css}</style>`;
}

/**
 * Themes author-supplied HTML by injecting the theme tokens. A constructor page gets them at the
 * END of <head> (after its own embedded stylesheet, so they win) plus the width override; any other
 * HTML gets them at the START of <head>, so the page's own `:root` declarations still win and a
 * hand-written design is only touched where it actually uses our token names.
 */
function themeHtml(html: string, a: RenderAppearance): string {
  if (CONSTRUCTOR_MARKER.test(html)) {
    const tag = themeStyleTag(a, true);
    // The page's own scripts (mermaid, charts) ask `matchMedia` which scheme to draw in; a forced
    // scheme has to answer that too, or a dark page would get a light diagram.
    if (a.scheme) {
      html = html.replace(
        /(?:window\.)?matchMedia\(\s*['"]\(prefers-color-scheme:\s*dark\)['"]\s*\)/g,
        `({matches:${a.scheme === "dark"}})`,
      );
    }
    return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, () => `${tag}</head>`) : tag + html;
  }
  const tag = themeStyleTag(a, false);
  const head = /<head[^>]*>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + tag + html.slice(head.index + head[0].length);
  const root = /<html[^>]*>/i.exec(html);
  if (root) return html.slice(0, root.index + root[0].length) + tag + html.slice(root.index + root[0].length);
  // Fragment: after a doctype if there is one (anything before it would force quirks mode).
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  return doctype ? doctype[0] + tag + html.slice(doctype[0].length) : tag + html;
}

export function renderArtifactHtml(kind: ArtifactKind, content: string, appearance?: RenderAppearance): string {
  switch (kind) {
    case "html":
      return appearance ? themeHtml(content, appearance) : content;
    case "markdown": {
      const rawHtml = md.render(content);
      const safeHtml = sanitizeHtml(rawHtml, MARKDOWN_SANITIZE_OPTIONS);
      return wrapDocument(safeHtml, ARTIFACT_BASE_CSS, appearance, "oa-doc");
    }
    case "svg": {
      const safeSvg = sanitizeHtml(content, SVG_SANITIZE_OPTIONS);
      // Wrapped in a fixed light "paper" card — see the doc comment on ARTIFACT_SVG_CSS for why
      // the SVG itself doesn't follow the page's dark-mode background.
      return wrapDocument(`<div class="oa-svg-card">${safeSvg}</div>`, ARTIFACT_SVG_CSS, appearance);
    }
    case "mermaid": {
      // One `escapeHtml` is the whole defence for text inside a <pre>: the browser decodes it back to
      // the original diagram source for mermaid. Running `sanitizeHtml` first as well would escape `>`
      // once more and turn every arrow (`-->`) into `--&gt;` after decoding, which mermaid rejects.
      const safeSource = content;
      // Theme comes from `matchMedia` at load time, same signal the iframe gets for everything
      // else (see DESIGN-core.md's "Theming inside the iframe"). The diagram source is never
      // interpolated into this script — it only ever appears HTML-escaped inside the <pre> above,
      // which is what makes that escaping sufficient; moving it into a JS string literal here
      // would need a different (and easy to get wrong) escaping scheme for no benefit.
      return wrapDocument(
        `<pre class="mermaid">${escapeHtml(safeSource)}</pre>
         <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
         <script>
           var oaDark = ${appearance?.scheme ? String(appearance.scheme === "dark") : 'window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches'};
           var oaCss = getComputedStyle(document.documentElement);
           var oaVar = function (n) { return oaCss.getPropertyValue("--" + n).trim(); };
           mermaid.initialize({
             startOnLoad: true,
             theme: "base",
             themeVariables: {
               darkMode: oaDark,
               fontFamily: getComputedStyle(document.body).fontFamily,
               background: oaVar("bg"),
               primaryColor: oaVar("accent-soft"),
               primaryTextColor: oaVar("fg"),
               primaryBorderColor: oaVar("accent"),
               secondaryColor: oaVar("surface-2"),
               tertiaryColor: oaVar("surface"),
               lineColor: oaVar("fg-muted"),
               textColor: oaVar("fg")
             }
           });
         </script>`,
        ARTIFACT_BASE_CSS,
        appearance,
        "oa-doc",
      );
    }
  }
}

function wrapDocument(body: string, style: string, appearance?: RenderAppearance, bodyClass?: string): string {
  // The width override only makes sense for kinds laid out as a text column (`oa-doc`); the svg card centres itself.
  const theme = appearance ? themeStyleTag(appearance, bodyClass === "oa-doc") : "";
  const cls = bodyClass ? ` class="${bodyClass}"` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><style>${style}</style>${theme}</head><body${cls}>${body}</body></html>`;
}
