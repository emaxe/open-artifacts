import type { CSSProperties } from "react";
import { Reveal } from "../Reveal";
import { TerminalAnimation } from "../TerminalAnimation";
import { useInViewOnce } from "../useInViewOnce";
import { useLandingCopy } from "../LandingI18n";

// How long each stage really takes, as relative weights: connecting is the longest, the code is a
// sliver, publishing is mostly the agent working. Each segment takes a different flat palette colour.
const GROW = [4, 3, 5];
const COLORS = ["var(--oa-field)", "var(--oa-accent)", "var(--oa-c6)"];
const INKS = ["var(--oa-field-fg)", "var(--oa-accent-fg)", "var(--oa-accent-fg)"];

export function HowItWorksSection() {
  const { t } = useLandingCopy();
  const [ref, inView] = useInViewOnce<HTMLDivElement>();

  return (
    <section id="how" className="lp-section">
      <Reveal>
        <h2 className="lp-display lp-h2">{t.how.heading}</h2>
      </Reveal>

      <div ref={ref} className={`lp-bar${inView ? " is-in" : ""}`}>
        {t.how.steps.map((step, i) => (
          <div key={step.title} className="lp-stage" style={{ "--grow": GROW[i], "--seg": COLORS[i], "--seg-ink": INKS[i], "--i": i } as CSSProperties}>
            <div className="lp-stage__seg" data-ui>
              {step.duration}
            </div>
            <p className="lp-stage__clause">
              <b>{step.title}.</b> {step.body}
            </p>
          </div>
        ))}
      </div>

      <Reveal delayMs={120}>
        <TerminalAnimation />
      </Reveal>
    </section>
  );
}
