import { Reveal } from "../Reveal";
import { useLandingCopy } from "../LandingI18n";

export function ComparisonSection() {
  const { t } = useLandingCopy();
  return (
    <section className="bg-panel-muted py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Reveal className="text-center">
          <h2 className="text-2xl font-semibold text-fg sm:text-3xl">{t.comparison.heading}</h2>
        </Reveal>
        <Reveal delayMs={100} className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse overflow-hidden rounded-card border border-border bg-panel text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted">
                <th className="px-4 py-3 font-medium"> </th>
                <th className="px-4 py-3 font-medium text-accent">{t.comparison.colUs}</th>
                <th className="px-4 py-3 font-medium">{t.comparison.colThem}</th>
              </tr>
            </thead>
            <tbody>
              {t.comparison.rows.map((row, i) => (
                <tr key={row.label} className={i > 0 ? "border-t border-border" : undefined}>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-fg">
                    {row.label}
                  </th>
                  <td className="px-4 py-3 text-fg">{row.us}</td>
                  <td className="px-4 py-3 text-muted">{row.them}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </div>
    </section>
  );
}
