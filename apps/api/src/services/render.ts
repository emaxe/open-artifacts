import sanitizeHtml from "sanitize-html";
import MarkdownIt from "markdown-it";
import type { ArtifactKind } from "@open-artifacts/shared";
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
export function renderArtifactHtml(kind: ArtifactKind, content: string): string {
  switch (kind) {
    case "html":
      return content;
    case "markdown": {
      const rawHtml = md.render(content);
      const safeHtml = sanitizeHtml(rawHtml, MARKDOWN_SANITIZE_OPTIONS);
      return wrapDocument(safeHtml, ARTIFACT_BASE_CSS);
    }
    case "svg": {
      const safeSvg = sanitizeHtml(content, SVG_SANITIZE_OPTIONS);
      // Wrapped in a fixed light "paper" card — see the doc comment on ARTIFACT_SVG_CSS for why
      // the SVG itself doesn't follow the page's dark-mode background.
      return wrapDocument(`<div class="oa-svg-card">${safeSvg}</div>`, ARTIFACT_SVG_CSS);
    }
    case "mermaid": {
      const safeSource = sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} });
      // Theme comes from `matchMedia` at load time, same signal the iframe gets for everything
      // else (see DESIGN-core.md's "Theming inside the iframe"). The diagram source is never
      // interpolated into this script — it only ever appears HTML-escaped inside the <pre> above,
      // which is what makes that escaping sufficient; moving it into a JS string literal here
      // would need a different (and easy to get wrong) escaping scheme for no benefit.
      return wrapDocument(
        `<pre class="mermaid">${escapeHtml(safeSource)}</pre>
         <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
         <script>
           var oaDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
           mermaid.initialize({ startOnLoad: true, theme: oaDark ? "dark" : "default" });
         </script>`,
        ARTIFACT_BASE_CSS,
      );
    }
  }
}

function wrapDocument(body: string, style: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><style>${style}</style></head><body>${body}</body></html>`;
}
