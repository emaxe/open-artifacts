import sanitizeHtml from "sanitize-html";
import MarkdownIt from "markdown-it";
import type { ArtifactKind } from "@open-artifacts/shared";

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

const BASE_STYLES = `
  body { font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 24px; color: #1a1a1a; background: #fff; }
  img { max-width: 100%; }
  pre { background: #f5f5f5; padding: 12px; overflow-x: auto; border-radius: 6px; }
  code { font-family: ui-monospace, monospace; }
`;

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
      return wrapDocument(safeHtml, BASE_STYLES);
    }
    case "svg": {
      const safeSvg = sanitizeHtml(content, SVG_SANITIZE_OPTIONS);
      return wrapDocument(safeSvg, "body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }");
    }
    case "mermaid": {
      const safeSource = sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} });
      return wrapDocument(
        `<pre class="mermaid">${escapeHtml(safeSource)}</pre>
         <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
         <script>mermaid.initialize({ startOnLoad: true });</script>`,
        BASE_STYLES,
      );
    }
  }
}

function wrapDocument(body: string, style: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${style}</style></head><body>${body}</body></html>`;
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}
