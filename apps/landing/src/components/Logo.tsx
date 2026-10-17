/**
 * Ring monogram only — mirrors apps/web/src/components/Logo.tsx's LogoMark export (LogoLockup is
 * dropped: the landing never needs the full wordmark lockup). The image comes from the shared
 * --oa-logo-mark token (packages/shared/src/design/tokens.css), which swaps the light and dark tone
 * sets with the theme; Vite resolves the url() against the landing's public/brand and its base path.
 */
export function LogoMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-[image:var(--oa-logo-mark)] bg-contain bg-center bg-no-repeat ${className ?? ""}`}
      style={{ width: size, height: size }}
    />
  );
}
