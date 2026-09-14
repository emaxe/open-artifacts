import { ShieldIcon, CheckIcon } from "../../components/ui/icons";
import { Reveal } from "../Reveal";
import { useLandingCopy } from "../LandingI18n";

export function SecuritySection() {
  const { t } = useLandingCopy();
  return (
    <section id="security" className="scroll-mt-16 bg-panel-muted py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal className="text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-fg">
            <ShieldIcon size={22} />
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-fg sm:text-3xl">{t.security.heading}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-muted">{t.security.body}</p>
        </Reveal>

        <Reveal delayMs={100}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 overflow-x-auto py-2">
            {t.security.diagramSteps.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <span className="whitespace-nowrap rounded-control border border-border bg-panel px-3 py-2 text-xs font-medium text-fg sm:text-sm">
                  {step}
                </span>
                {i < t.security.diagramSteps.length - 1 && <span className="text-muted">→</span>}
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delayMs={160}>
          <ul className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
            {t.security.points.map((point) => (
              <li key={point} className="flex items-start gap-2 rounded-control bg-panel p-3 text-sm text-fg">
                <CheckIcon size={16} className="mt-0.5 shrink-0 text-accent" />
                {point}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
