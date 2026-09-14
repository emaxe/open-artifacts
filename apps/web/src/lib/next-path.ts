/**
 * Shared by every page that accepts a post-auth `?next=` redirect (pages/auth/AuthPage.tsx,
 * components/Layout.tsx). Kept in one place so the open-redirect guard is never re-typed, and
 * re-typed wrong, at a second call site.
 */

/** Only a same-origin, root-relative path is a valid redirect target — `next=//evil.com` (or any absolute URL) is an open-redirect attempt and is dropped. */
export function sanitizeNextPath(raw: string | null): string | null {
  return raw && /^\/(?!\/)/.test(raw) ? raw : null;
}

/** `/s/:token` and `/embed/:token` are rendered server-side by the API, not SPA routes — react-router's `navigate()` would just render nothing for them, so those two prefixes need a real navigation instead. */
export function isServerRenderedPath(next: string): boolean {
  return /^\/(s|embed)\//.test(next);
}
