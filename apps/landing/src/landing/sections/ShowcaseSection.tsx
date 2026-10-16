import { Reveal } from "../Reveal";
import { useInViewOnce } from "../useInViewOnce";
import { useLandingCopy } from "../LandingI18n";

/** Two giant words compared: what the agent writes by hand against what it describes. The section's bottom edge cuts both. */
export function ShowcaseSection() {
  const { t } = useLandingCopy();
  const [ref, inView] = useInViewOnce<HTMLElement>();
  const s = t.showcase;

  return (
    <section ref={ref} className={`lp-show${inView ? " is-in" : ""}`}>
      <div className="lp-show__top">
        <Reveal className="lp-show__heading">
          <h2>{s.heading}</h2>
        </Reveal>
        <Reveal delayMs={100} className="lp-show__body">
          <p>{s.body}</p>
        </Reveal>
      </div>

      <div className="lp-show__pair">
        <div className="lp-spec lp-spec--raw">
          <div className="lp-spec__cut">
            <span className="lp-spec__word" aria-hidden="true">
              {s.rawWord}
            </span>
          </div>
          <span className="lp-spec__label">{s.rawLabel}</span>
        </div>
        <div className="lp-spec lp-spec--built">
          <div className="lp-spec__cut">
            <span className="lp-spec__word" aria-hidden="true">
              {s.builtWord}
            </span>
          </div>
          <span className="lp-spec__label">{s.builtLabel}</span>
        </div>
      </div>
    </section>
  );
}
