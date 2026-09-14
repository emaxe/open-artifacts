import { LogoMark } from "../components/Logo";
import { Button } from "../components/ui/Button";
import { ThemeSwitch } from "../components/ui/ThemeSwitch";
import { GithubIcon } from "../components/ui/icons";
import { LangToggle } from "./LangToggle";
import { useLandingCopy } from "./LandingI18n";
import { EXTERNAL_LINKS } from "./links";

const THEME_LABELS = { light: "☀︎", system: "◐", dark: "☾" };

// Mirrors apps/web/src/pages/landing/LandingHeader.tsx, minus the signed-in/out auth buttons
// (useAuth doesn't exist here — this site has no session at all). The sign-in CTA is replaced by
// GitHub + a self-host anchor button.
export function LandingHeader() {
  const { t } = useLandingCopy();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <a href="#top" className="flex items-center gap-2 font-semibold text-fg">
          <LogoMark size={22} />
          <span className="hidden sm:inline">Open Artifacts</span>
        </a>

        <nav className="ml-2 hidden flex-1 items-center gap-5 text-sm text-muted lg:flex">
          <a href="#features" className="hover:text-fg">
            {t.nav.features}
          </a>
          <a href="#how" className="hover:text-fg">
            {t.nav.how}
          </a>
          <a href="#security" className="hover:text-fg">
            {t.nav.security}
          </a>
          <a href="#self-host" className="hover:text-fg">
            {t.nav.selfHost}
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LangToggle />
          <ThemeSwitch labels={THEME_LABELS} className="hidden sm:flex" />
          <a href={EXTERNAL_LINKS.github} target="_blank" rel="noreferrer" className="hidden sm:inline-flex">
            <Button variant="ghost" size="sm">
              <GithubIcon size={14} /> GitHub
            </Button>
          </a>
          <a href="#self-host" className="inline-flex">
            <Button size="sm">{t.nav.selfHost}</Button>
          </a>
        </div>
      </div>
    </header>
  );
}
