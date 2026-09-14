import { CheckIcon } from "../../components/ui/icons";
import { Button } from "../../components/ui/Button";
import { useLandingCopy } from "../LandingI18n";
import { EXTERNAL_LINKS } from "../links";

// Single centered column — the two-column layout (form in the second column) only existed to fit
// the inline auth card that lived here before the landing moved out of the app; see the app's own
// two-panel sign-in screen for that form now.
export function HeroSection() {
  const { t } = useLandingCopy();

  return (
    <section id="top" className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 pb-16 pt-10 text-center sm:px-6 sm:pt-16">
      <span className="w-fit rounded-full border border-border bg-panel-muted px-3 py-1 text-xs font-medium text-muted">
        {t.hero.badge}
      </span>
      <h1 className="text-3xl font-semibold leading-tight text-fg sm:text-4xl lg:text-[2.6rem]">{t.hero.title}</h1>
      <p className="max-w-prose text-base text-muted sm:text-lg">{t.hero.subtitle}</p>
      <ul className="flex flex-col items-start gap-2 self-center text-left">
        {t.hero.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2 text-sm text-fg">
            <CheckIcon size={16} className="mt-0.5 shrink-0 text-accent" />
            {bullet}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-center gap-3 pt-1">
        <a href={EXTERNAL_LINKS.github} target="_blank" rel="noreferrer" className="inline-flex">
          <Button>{t.hero.ctaSecondary}</Button>
        </a>
        <Button variant="secondary" onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}>
          {t.hero.ctaPrimary}
        </Button>
      </div>
    </section>
  );
}
