import { TerminalIcon, UsersIcon, CheckIcon } from "../../components/ui/icons";
import { Reveal } from "../Reveal";
import { useLandingCopy } from "../LandingI18n";

export function AudienceSection() {
  const { t } = useLandingCopy();
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <Reveal className="text-center">
        <h2 className="text-2xl font-semibold text-fg sm:text-3xl">{t.audience.heading}</h2>
      </Reveal>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Reveal>
          <div className="h-full rounded-card border border-border bg-panel p-5">
            <p className="mb-3 flex items-center gap-2 font-semibold text-fg">
              <TerminalIcon size={18} className="text-accent" /> {t.audience.agent.title}
            </p>
            <ul className="flex flex-col gap-2">
              {t.audience.agent.points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm text-muted">
                  <CheckIcon size={14} className="mt-0.5 shrink-0 text-accent" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delayMs={100}>
          <div className="h-full rounded-card border border-border bg-panel p-5">
            <p className="mb-3 flex items-center gap-2 font-semibold text-fg">
              <UsersIcon size={18} className="text-accent" /> {t.audience.team.title}
            </p>
            <ul className="flex flex-col gap-2">
              {t.audience.team.points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm text-muted">
                  <CheckIcon size={14} className="mt-0.5 shrink-0 text-accent" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
