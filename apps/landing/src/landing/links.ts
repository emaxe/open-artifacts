/** External links shared across the landing's header/footer/CTA sections — kept in one place so the repo URL is only typed once (see README.md's own badges for the canonical spelling). */
export const EXTERNAL_LINKS = {
  github: "https://github.com/emaxe/open-artifacts",
  npm: "https://www.npmjs.com/package/@emaxe/oa",
  skills: "https://skills.sh/emaxe/open-artifacts",
  changelog: "https://github.com/emaxe/open-artifacts/blob/main/CHANGELOG.md",
  license: "https://github.com/emaxe/open-artifacts/blob/main/LICENSE",
};

/** No SSR + no build-time version injection into apps/web — this is the one hand-maintained
 * constant on the page; bump it alongside the version in package.json/CHANGELOG.md on release. */
export const APP_VERSION = "0.11.0";
