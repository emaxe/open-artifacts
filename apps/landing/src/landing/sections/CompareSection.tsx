import { Reveal } from "../Reveal";
import { useLandingCopy } from "../LandingI18n";

/** A comparison set as text: no lines, no ticks. The product's own column is one filled block behind its cells. */
export function CompareSection() {
  const { t } = useLandingCopy();
  const { cols, rows } = t.compare;

  return (
    <section id="compare" className="lp-section lp-compare">
      <Reveal>
        <h2 className="lp-display">{t.compare.heading}</h2>
      </Reveal>
      <Reveal delayMs={90}>
        <table className="lp-table">
          <thead>
            <tr>
              <td />
              {cols.map((col) => (
                <th key={col} scope="col">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {row.cells.map((cell, i) => (
                  <td key={i} data-col={cols[i]}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
    </section>
  );
}
