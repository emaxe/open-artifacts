import { CheckIcon } from "../../components/ui/icons";
import { Button } from "../../components/ui/Button";
import { useLandingCopy } from "../LandingI18n";
import { EXTERNAL_LINKS } from "../links";

// Bars of the mock artifact, as a share of the tallest one. Static on purpose: this is a picture of
// the result, not a live demo (the live one is the sandboxed preview further down the page).
const BARS = [38, 52, 44, 68, 58, 82, 100];

// Left: the pitch. Right: what it produces — the command an agent runs, the link it gets back and
// the page the recipient opens.
export function HeroSection() {
  const { t } = useLandingCopy();
  const { mock } = t.hero;

  return (
    <section id="top" className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
      <div className="flex flex-col items-start gap-5">
        <span className="w-fit rounded-control bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
          {t.hero.badge}
        </span>
        <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-fg sm:text-5xl lg:text-[3.4rem]">{t.hero.title}</h1>
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
          <a href={EXTERNAL_LINKS.github} target="_blank" rel="noreferrer" className="inline-flex">
            <Button>{t.hero.ctaSecondary}</Button>
          </a>
          <Button variant="secondary" onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}>
            {t.hero.ctaPrimary}
          </Button>
        </div>
      </div>

      <figure className="m-0 flex flex-col gap-3" aria-label={mock.caption}>
        <div className="rounded-card bg-[#0d1117] px-4 py-3 font-mono text-sm text-white/80">
          <span className="text-white/40">$ </span>
          {mock.command}
        </div>
        <div className="flex items-center justify-between gap-3 rounded-card bg-panel-muted px-4 py-3">
          <span className="truncate font-mono text-sm text-fg">https://your-server/s/k3Jx9Qa</span>
          <span className="shrink-0 rounded-control bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">{mock.access}</span>
        </div>
        <div className="rounded-card bg-panel p-5" aria-hidden="true">
          <p className="text-base font-semibold text-fg">{mock.title}</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {mock.kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-control bg-panel-muted px-3 py-2">
                <p className="text-xs text-muted">{kpi.label}</p>
                <p className="text-lg font-semibold tabular-nums text-fg">{kpi.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex h-24 items-end gap-2">
            {BARS.map((h, i) => (
              <div key={i} className={i === BARS.length - 1 ? "flex-1 bg-accent" : "flex-1 bg-accent-soft"} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <figcaption className="text-xs text-muted">{mock.caption}</figcaption>
      </figure>
    </section>
  );
}
