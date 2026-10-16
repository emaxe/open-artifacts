import type { CSSProperties } from "react";
import { useDomain } from "../DomainContext";
import { useLandingCopy } from "../LandingI18n";

/**
 * The sentence is the page: two authored lines at display size, rising from behind their own
 * baselines (see `.lp-lines` in landing.css), and one live thing — the visitor's own domain turns
 * the sample link into the address their agent would actually receive.
 */
export function HeroSection() {
  const { t } = useLandingCopy();
  const { value, setValue, host } = useDomain();
  const [first, second] = t.hero.lines;

  return (
    <section id="top" className="lp-hero">
      <div className="lp-hero__stage">
        <h1 className="lp-display lp-lines" aria-label={`${first} ${second}`}>
          <span className="line" aria-hidden="true">
            <span data-line style={{ "--i": 0 } as CSSProperties}>
              {first}
            </span>
          </span>
          <span className="line" aria-hidden="true">
            <span data-line style={{ "--i": 1 } as CSSProperties}>
              {second}
            </span>
          </span>
        </h1>

        <div className="lp-hero__rise">
          <div className="lp-link">
            <label className="lp-chip" data-ui>
              <span>{t.hero.domainLabel}</span>
              <input
                type="text"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={value}
                placeholder={t.hero.domainPlaceholder}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
            <p className="lp-url" aria-live="polite">
              https://<b>{host}</b>/s/9kQ2xR
            </p>
          </div>
          <p className="lp-hero__caption">{t.hero.linkCaption}</p>
        </div>
      </div>

      <div className="lp-hero__foot lp-hero__rise lp-hero__rise--late">
        <p>{t.hero.subtitle}</p>
        <a href="#self-host" className="lp-btn">
          {t.hero.cta}
        </a>
      </div>
    </section>
  );
}
