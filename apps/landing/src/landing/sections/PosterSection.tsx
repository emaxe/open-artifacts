import { useLandingCopy } from "../LandingI18n";
import { Reveal } from "../Reveal";

/** The ways to connect, set as a poster: giant words on the left, one small fact each on the right. */
export function PosterSection() {
  const { t } = useLandingCopy();
  return (
    <section className="lp-poster" aria-labelledby="poster-heading">
      <h2 id="poster-heading" className="sr-only">
        {t.poster.heading}
      </h2>
      <ul>
        {t.poster.items.map((item, i) => (
          <Reveal key={item.word} delayMs={i * 70}>
            <li>
              <span>{item.word}</span>
              <span className="lp-poster__detail">{item.detail}</span>
            </li>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
