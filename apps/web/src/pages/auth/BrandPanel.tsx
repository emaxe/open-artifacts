import { TerminalAnimation } from "../../components/demo/TerminalAnimation";
import { useAuthCopy } from "./AuthI18n";

/**
 * The sign-in screen's right-hand panel: a flat colour field with the product's sentence at display
 * size and the real CLI transcript. Purely decorative (the form on the left is the whole
 * interactive surface), so it's `aria-hidden` and never mounted for a screen reader or a narrow
 * viewport (see AuthPage.tsx's `useMediaQuery` gate). Motion is the terminal's own typewriter
 * effect only; `prefers-reduced-motion` is honoured by TerminalAnimation and styles.css.
 */
export function BrandPanel() {
  const { t } = useAuthCopy();

  return (
    <div aria-hidden="true" className="hidden bg-field text-field-fg lg:flex lg:flex-col lg:justify-between lg:gap-10 lg:px-14 lg:py-12">
      <h2 className="max-w-[14ch] text-5xl font-bold leading-[0.98] tracking-tight xl:text-6xl">{t.brand.heading}</h2>
      <div className="flex max-w-lg flex-col gap-8">
        <ul className="flex flex-col gap-3 text-lg leading-snug">
          {t.brand.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
        <TerminalAnimation />
      </div>
    </div>
  );
}
