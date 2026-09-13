/**
 * Content types safe to serve with `Content-Disposition: inline` from `GET /af/:token` — i.e.
 * types a browser will only ever decode as media, never execute as a document in this app's own
 * origin. Everything else (crucially `text/html` and `image/svg+xml`, both of which a browser CAN
 * execute) is forced to `Content-Disposition: attachment` with `Content-Type:
 * application/octet-stream` — the same reasoning `/s/:token/download` already documents for
 * artifact source: serving arbitrary uploaded content back as a type the browser executes, from
 * this origin, would hand it a path to `oa_session` that the sandboxed `/embed` iframe exists to
 * prevent. See routes/files.ts.
 */
export const INLINE_CONTENT_TYPES: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "font/woff2",
];

export function isInlineContentType(contentType: string): boolean {
  return INLINE_CONTENT_TYPES.includes(contentType.toLowerCase());
}
