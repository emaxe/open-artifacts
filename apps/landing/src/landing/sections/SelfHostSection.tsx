import { ServerIcon } from "../../components/ui/icons";
import { CodeBlock } from "../../components/ui/CodeBlock";
import { Reveal } from "../Reveal";
import { useLandingCopy } from "../LandingI18n";
import { EXTERNAL_LINKS } from "../links";

// The landing's main call to action — see HeroSection.tsx/LandingHeader.tsx/ClosingCta.tsx, which
// all point here instead of an inline auth form (the published site has none, see the app's own
// two-panel sign-in screen for that).
export function SelfHostSection() {
  const { t, lang } = useLandingCopy();
  return (
    <section id="self-host" className="scroll-mt-16 mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Reveal className="rounded-card border border-border bg-panel p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-control bg-panel-muted text-accent">
            <ServerIcon size={18} />
          </div>
          <h2 className="text-xl font-semibold text-fg sm:text-2xl">{t.selfHost.heading}</h2>
        </div>
        <p className="mt-3 text-muted">{t.selfHost.body}</p>
        <CodeBlock text={t.selfHost.command} copyLabel={lang === "ru" ? "Копировать" : "Copy"} copiedLabel={lang === "ru" ? "Скопировано" : "Copied"} />
        <p className="mt-2 text-xs text-muted">{t.selfHost.note}</p>
        <a href={EXTERNAL_LINKS.github} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-accent hover:underline">
          {t.selfHost.docsLink}
        </a>
      </Reveal>
    </section>
  );
}
