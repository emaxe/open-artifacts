/** Moved from the former landing (pages/landing/links.ts) — trimmed to what the sign-in screen's
 * footer actually uses. The full link set (npm, changelog, license) now lives on the published
 * site at apps/landing/src/landing/links.ts. */
export const EXTERNAL_LINKS = {
  github: "https://github.com/emaxe/open-artifacts",
};

/** No build-time version injection — this is the one hand-maintained constant on the page; bump
 * it alongside the version in package.json/CHANGELOG.md on release (see apps/landing's own copy
 * of this constant for the other half of that chore). */
export const APP_VERSION = "0.10.0";
