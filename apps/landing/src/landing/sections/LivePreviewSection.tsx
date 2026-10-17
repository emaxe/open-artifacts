import { Reveal } from "../Reveal";
import { DemoPreview } from "../DemoPreview";
import { useLandingCopy } from "../LandingI18n";

export function LivePreviewSection() {
  const { t } = useLandingCopy();
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 sm:py-24 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">{t.demo.heading}</h2>
          <p className="mt-2 text-muted">{t.demo.body}</p>
        </Reveal>
        <Reveal delayMs={120}>
          <DemoPreview />
        </Reveal>
      </div>
    </section>
  );
}
