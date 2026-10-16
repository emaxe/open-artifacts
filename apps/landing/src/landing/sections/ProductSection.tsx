import { DemoPreview } from "../DemoPreview";
import { Reveal } from "../Reveal";
import { useLandingCopy } from "../LandingI18n";

export function ProductSection() {
  const { t } = useLandingCopy();
  return (
    <section className="lp-product">
      <div className="lp-product__text">
        <Reveal>
          <h2 className="lp-display">{t.product.heading}</h2>
        </Reveal>
        <Reveal delayMs={90}>
          <p>{t.product.body}</p>
          <p className="lp-product__note">{t.product.note}</p>
        </Reveal>
      </div>
      <Reveal delayMs={180} className="lp-product__wrap">
        <DemoPreview />
      </Reveal>
    </section>
  );
}
