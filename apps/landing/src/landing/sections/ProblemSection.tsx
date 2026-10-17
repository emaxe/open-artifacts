import { XIcon, CheckIcon } from "../../components/ui/icons";
import { Reveal } from "../Reveal";
import { useLandingCopy } from "../LandingI18n";
import { SectionHead } from "../SectionHead";

export function ProblemSection() {
  const { t } = useLandingCopy();
  return (
    <section className="mx-auto max-w-4xl px-4 py-20 sm:py-24 sm:px-6">
      <Reveal>
        <SectionHead index={1} label={t.kickers.problem} title={t.problem.heading} />
        <div className="grid gap-6 sm:grid-cols-2">
          <ul className="oa-stagger-list flex flex-col gap-3 rounded-card bg-panel-muted p-6">
            {t.problem.before.map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-muted">
                <XIcon size={16} className="mt-0.5 shrink-0 text-danger" />
                {line}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 rounded-card bg-accent-soft p-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-fg">
              <CheckIcon size={16} className="text-accent" />
              {t.problem.afterHeading}
            </p>
            <p className="text-sm text-muted">{t.problem.after}</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
