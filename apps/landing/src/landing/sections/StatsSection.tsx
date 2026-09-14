import { Reveal } from "../Reveal";
import { AnimatedCounter } from "../AnimatedCounter";
import { useLandingCopy } from "../LandingI18n";

export function StatsSection() {
  const { t } = useLandingCopy();
  return (
    <section className="border-y border-border bg-panel-muted py-10">
      <Reveal className="mx-auto flex max-w-5xl flex-wrap justify-center gap-x-10 gap-y-6 px-4 sm:px-6">
        {t.stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-3xl font-bold text-fg">
              <AnimatedCounter value={stat.value} suffix={stat.suffix} />
            </p>
            <p className="mt-1 text-xs text-muted">{stat.label}</p>
          </div>
        ))}
      </Reveal>
    </section>
  );
}
