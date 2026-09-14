import { CheckIcon } from "../../components/ui/icons";
import { TerminalAnimation } from "../../components/demo/TerminalAnimation";
import { DemoPreview } from "../../components/demo/DemoPreview";
import { useAuthCopy } from "./AuthI18n";

/**
 * The sign-in screen's right-hand panel — purely decorative (the form on the left is the whole
 * interactive surface), so it's `aria-hidden` and never mounted for a screen reader or a narrow
 * viewport (see AuthPage.tsx's `useMediaQuery` gate, which unmounts this — and the iframe inside
 * DemoPreview — outright below 1024px rather than just hiding it with CSS).
 *
 * Animation is CSS + IntersectionObserver only (`.oa-auth-aurora`/`.oa-auth-grid` in styles.css,
 * TerminalAnimation's own typewriter effect) — this app keeps zero extra runtime deps, so no
 * framer-motion. `prefers-reduced-motion` is honoured by the same styles.css media block that
 * already covers `.oa-caret`.
 */
export function BrandPanel() {
  const { t } = useAuthCopy();

  return (
    <div aria-hidden="true" className="oa-auth-grid relative hidden overflow-hidden bg-panel-muted lg:flex lg:flex-col lg:justify-center lg:px-12 lg:py-10">
      <div className="oa-auth-aurora pointer-events-none absolute -inset-1/4 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative flex max-w-md flex-col gap-6">
        <span className="w-fit rounded-full border border-border bg-panel px-3 py-1 text-xs font-medium text-muted">
          {t.brand.badge}
        </span>
        <h2 className="text-2xl font-semibold leading-tight text-fg">{t.brand.heading}</h2>
        <ul className="flex flex-col gap-2">
          {t.brand.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2 text-sm text-fg">
              <CheckIcon size={16} className="mt-0.5 shrink-0 text-accent" />
              {bullet}
            </li>
          ))}
        </ul>
        <TerminalAnimation />
        <div className="hidden [@media(min-height:900px)]:block">
          <DemoPreview />
        </div>
      </div>
    </div>
  );
}
