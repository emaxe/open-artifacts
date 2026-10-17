import { CheckIcon } from "../../components/ui/icons";
import { Reveal } from "../Reveal";
import { useLandingCopy } from "../LandingI18n";
import { SectionHead } from "../SectionHead";

export function SecuritySection() {
  const { t } = useLandingCopy();
  return (
    <section id="security" className="scroll-mt-16 bg-panel-muted py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal>
          <SectionHead index={4} label={t.kickers.security} title={t.security.heading} lead={t.security.body} />
        </Reveal>

        <Reveal delayMs={100}>
          <ol className="oa-flow oa-stagger-list mt-8" aria-label={t.kickers.security}>
            {t.security.diagramSteps.map((step, i) => (
              <li key={step}>
                <span className="oa-flow__node" aria-hidden="true">{i + 1}</span>
                <span className="oa-flow__label">{step}</span>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal delayMs={160}>
          <ul className="oa-stagger-list mt-8 grid gap-3 sm:grid-cols-2">
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
