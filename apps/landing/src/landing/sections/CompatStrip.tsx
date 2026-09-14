import { useLandingCopy } from "../LandingI18n";

export function CompatStrip() {
  const { t } = useLandingCopy();
  return (
    <section className="border-y border-border bg-panel-muted py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 sm:px-6">
        <p className="text-center text-xs uppercase tracking-wide text-muted">{t.compat.heading}</p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-fg">
          {t.compat.agents.map((agent) => (
            <span key={agent}>{agent}</span>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {t.compat.badges.map((badge) => (
            <span key={badge} className="rounded-full border border-border bg-panel px-2.5 py-0.5 text-xs text-muted">
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
