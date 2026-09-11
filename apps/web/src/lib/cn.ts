/**
 * Joins class names, skipping falsy values. Deliberately not `clsx`/`tailwind-merge` — this
 * project keeps zero extra runtime deps, and a merge utility only earns its keep once callers
 * pass conflicting overriding classes, which our small, closed set of ui/ primitives avoids by
 * construction (each takes an explicit `variant`/`size` prop instead of raw override classes).
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
