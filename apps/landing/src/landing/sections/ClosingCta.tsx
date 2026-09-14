import { Button } from "../../components/ui/Button";
import { useLandingCopy } from "../LandingI18n";
import { EXTERNAL_LINKS } from "../links";

// Mirrors apps/web/src/pages/landing/sections/ClosingCta.tsx, minus onFocusAuth (no inline form
// here) — the button scrolls to #self-host instead.
export function ClosingCta() {
  const { t } = useLandingCopy();
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <h2 className="text-2xl font-semibold text-fg sm:text-3xl">{t.cta.heading}</h2>
      <p className="mx-auto mt-2 max-w-xl text-muted">{t.cta.body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={() => document.getElementById("self-host")?.scrollIntoView({ behavior: "smooth" })}>{t.cta.button}</Button>
        <a href={EXTERNAL_LINKS.github} target="_blank" rel="noreferrer" className="inline-flex">
          <Button variant="ghost">GitHub</Button>
        </a>
      </div>
    </section>
  );
}
