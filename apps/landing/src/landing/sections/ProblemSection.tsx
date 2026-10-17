import { XIcon, CheckIcon } from "../../components/ui/icons";
import { Reveal } from "../Reveal";
import { useLandingCopy } from "../LandingI18n";

export function ProblemSection() {
  const { t } = useLandingCopy();
  return (
    <section className="mx-auto max-w-4xl px-4 py-20 sm:py-24 sm:px-6">
      <Reveal>
        <h2 className="text-center text-3xl font-bold tracking-tight text-fg sm:text-4xl">{t.problem.heading}</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <ul className="flex flex-col gap-3 rounded-card bg-panel-muted p-6">
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
