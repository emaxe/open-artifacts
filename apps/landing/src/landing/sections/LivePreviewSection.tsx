import { Reveal } from "../Reveal";
import { DemoPreview } from "../DemoPreview";
import { useLandingCopy } from "../LandingI18n";
import { SectionHead } from "../SectionHead";

export function LivePreviewSection() {
  const { t } = useLandingCopy();
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 sm:py-24 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <Reveal>
          <SectionHead index={5} label={t.kickers.demo} title={t.demo.heading} lead={t.demo.body} />
        </Reveal>
        <Reveal delayMs={120}>
          <DemoPreview />
        </Reveal>
      </div>
    </section>
  );
}
