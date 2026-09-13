import type { ArtifactKind } from "@open-artifacts/shared";

const EXTENSIONS: Record<ArtifactKind, string> = {
  html: "html",
  markdown: "md",
  svg: "svg",
  mermaid: "mmd",
};

const COMBINING_DIACRITICS = /[\u0300-\u036f]/g;

/**
 * Reduces an arbitrary, user-supplied title to `[a-z0-9-]`, which is the whole of the defense
 * against header injection in the ASCII `filename=` below: a title containing a quote, CRLF, `/`,
 * `..`, emoji, or 300 characters of Cyrillic collapses to dashes or is dropped, so those bytes are
 * structurally incapable of reaching the header — there is nothing to sanitize-and-hope-we-got-it,
 * the character set itself excludes them.
 */
function slugify(title: string): string {
  const collapsed = title
    .normalize("NFKD")
    .replace(COMBINING_DIACRITICS, "") // strip combining marks left behind by NFKD (e.g. "é" -> "e")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const capped = collapsed.replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
  return capped || "artifact";
}

/** RFC 5987 `attr-char` excludes `* ' ( )` even though `encodeURIComponent` leaves them unescaped. */
function percentEncodeExtValue(value: string): string {
  return encodeURIComponent(value).replace(/[*'()]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function downloadFileName(title: string, kind: ArtifactKind, versionNo: number): { asciiName: string; displayName: string } {
  const ext = EXTENSIONS[kind];
  const asciiName = `${slugify(title)}-v${versionNo}.${ext}`;
  const displayBase = title.trim() || "artifact";
  const displayName = `${displayBase}-v${versionNo}.${ext}`;
  return { asciiName, displayName };
}

/**
 * Builds a `Content-Disposition: attachment` header value that is safe against header injection by
 * CONSTRUCTION, not by validating the title afterward: the ASCII `filename=` is built exclusively
 * from `slugify`'s `[a-z0-9-]` output (CR/LF/quotes cannot appear in it), and the Unicode
 * `filename*=` is percent-encoded per RFC 5987 (also CR/LF/quote-free). Never interpolate a raw
 * title into a header directly.
 */
export function contentDispositionValue(title: string, kind: ArtifactKind, versionNo: number): string {
  const { asciiName, displayName } = downloadFileName(title, kind, versionNo);
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${percentEncodeExtValue(displayName)}`;
}
