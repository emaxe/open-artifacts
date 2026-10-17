import { Button } from "../../components/ui/Button";
import { useLandingCopy } from "../LandingI18n";
import { EXTERNAL_LINKS } from "../links";

// Mirrors apps/web/src/pages/landing/sections/ClosingCta.tsx, minus onFocusAuth (no inline form
// here) — the button scrolls to #self-host instead.
export function ClosingCta() {
  const { t } = useLandingCopy();
  return (
    <section className="bg-accent-soft"><div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-24">
      <h2 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">{t.cta.heading}</h2>
      <p className="mx-auto mt-2 max-w-xl text-muted">{t.cta.body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={() => document.getElementById("self-host")?.scrollIntoView({ behavior: "smooth" })}>{t.cta.button}</Button>
        <a href={EXTERNAL_LINKS.github} target="_blank" rel="noreferrer" className="inline-flex">
          <Button variant="ghost">GitHub</Button>
        </a>
      </div>
      </div>
    </section>
  );
}
