import { Reveal } from "../Reveal";
import { TerminalAnimation } from "../TerminalAnimation";
import { useLandingCopy } from "../LandingI18n";

export function HowItWorksSection() {
  const { t } = useLandingCopy();
  return (
    <section id="how" className="scroll-mt-16 bg-panel-muted py-16">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <h2 className="text-2xl font-semibold text-fg sm:text-3xl">{t.how.heading}</h2>
          <p className="mt-2 text-muted">{t.how.subtitle}</p>
          <ol className="mt-6 flex flex-col gap-5">
            {t.how.steps.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-fg">{step.title}</p>
                  <p className="text-sm text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
        <Reveal delayMs={120}>
          <TerminalAnimation />
          <p className="mt-2 text-xs text-muted">{t.how.terminalCaption}</p>
        </Reveal>
      </div>
    </section>
  );
}
