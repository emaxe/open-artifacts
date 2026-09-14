// Mirrors apps/web/src/lib/cn.ts — kept as a deliberate copy rather than a shared package (see
// apps/landing's README section in the repo root README for why). Keep the two in sync by hand.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
