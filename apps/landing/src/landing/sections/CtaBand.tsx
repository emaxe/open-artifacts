import type { CSSProperties } from "react";
import { useLandingCopy } from "../LandingI18n";
import { EXTERNAL_LINKS } from "../links";

/** The whole band is one link; the one word on it is the action itself. */
export function CtaBand() {
  const { t } = useLandingCopy();
  return (
    <a className="lp-cta" href={`${EXTERNAL_LINKS.github}#readme`} target="_blank" rel="noreferrer" style={{ "--cta-size": t.cta.size } as CSSProperties}>
      <span className="lp-cta__text">{t.cta.body}</span>
      <svg className="lp-cta__arrow" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
        <path d="M12 36 36 12M16 12h20v20" />
      </svg>
      <span className="lp-cta__word">{t.cta.word}</span>
    </a>
  );
}
