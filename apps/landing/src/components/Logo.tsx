import logoMarkUrl from "../assets/brand/logo-mark.png";

/**
 * Ring monogram only — mirrors apps/web/src/components/Logo.tsx's LogoMark export (LogoLockup is
 * dropped: the landing never needs the full wordmark lockup, and its PNGs are 300KB+ each).
 * Imported through Vite rather than a bare `/brand/...` src so the URL picks up the base path
 * (`/open-artifacts/`) automatically instead of needing a hand-written prefix.
 */
export function LogoMark({ size = 20, className }: { size?: number; className?: string }) {
  return <img src={logoMarkUrl} width={size} height={size} alt="" className={className} />;
}
