/**
 * Minimal HTML-escaping primitive, shared by every server-rendered page in this app (artifact
 * content rendering in `render.ts`, and the public viewer shell in `views/viewer-shell.ts`). Kept
 * dependency-free and framework-agnostic on purpose — `views/*` must not need to pull in
 * `sanitize-html`/`markdown-it` just to escape a title.
 */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/**
 * Truncates `input` to at most `max` characters, appending an ellipsis when it was cut. Always
 * call this BEFORE `escapeHtml`, never after — truncating already-escaped text can slice a named
 * entity (e.g. `&amp;`) in half and leave a stray `&` in the output.
 */
export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max)}…`;
}
