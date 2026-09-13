import type { RefObject } from "react";
import { CheckIcon } from "../../../components/ui/icons";
import { Button } from "../../../components/ui/Button";
import { AuthCard, type AuthCardHandle } from "../AuthCard";
import { useLandingCopy } from "../LandingI18n";
import { EXTERNAL_LINKS } from "../links";

export function HeroSection({ authCardRef }: { authCardRef: RefObject<AuthCardHandle | null> }) {
  const { t } = useLandingCopy();

  return (
    <section id="top" className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-12">
      <div className="flex flex-col gap-5">
        <span className="w-fit rounded-full border border-border bg-panel-muted px-3 py-1 text-xs font-medium text-muted">
          {t.hero.badge}
        </span>
        <h1 className="text-3xl font-semibold leading-tight text-fg sm:text-4xl lg:text-[2.6rem]">{t.hero.title}</h1>
        <p className="max-w-prose text-base text-muted sm:text-lg">{t.hero.subtitle}</p>
        <ul className="flex flex-col gap-2">
          {t.hero.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2 text-sm text-fg">
              <CheckIcon size={16} className="mt-0.5 shrink-0 text-accent" />
              {bullet}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3 pt-1">
          <Button variant="secondary" onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}>
            {t.hero.ctaPrimary}
          </Button>
          <a href={EXTERNAL_LINKS.github} target="_blank" rel="noreferrer" className="inline-flex">
            <Button variant="ghost">{t.hero.ctaSecondary}</Button>
          </a>
        </div>
      </div>

      <div id="auth-card" className="scroll-mt-24">
        <AuthCard ref={authCardRef} />
      </div>
    </section>
  );
}
