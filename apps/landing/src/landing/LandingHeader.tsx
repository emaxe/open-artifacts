import { LogoMark } from "../components/Logo";
import { ThemeSwitch } from "../components/ui/ThemeSwitch";
import { LangToggle } from "./LangToggle";
import { useLandingCopy } from "./LandingI18n";
import { EXTERNAL_LINKS } from "./links";

/** A plain row on the page, not a bar: wordmark left, a few links and the two toggles right. */
export function LandingHeader() {
  const { t } = useLandingCopy();

  return (
    <header className="lp-header">
      <a href="#top" className="lp-brand">
        <LogoMark size={22} />
        <span>Open Artifacts</span>
      </a>
      <nav className="lp-nav" aria-label="Sections">
        <a href="#how">{t.nav.how}</a>
        <a href="#compare">{t.nav.compare}</a>
        <a href="#self-host">{t.nav.selfHost}</a>
      </nav>
      <div className="lp-header__tools">
        <LangToggle />
        <ThemeSwitch labels={{ light: t.nav.themeLight, system: t.nav.themeSystem, dark: t.nav.themeDark }} className="hidden sm:flex" />
        <a href={EXTERNAL_LINKS.github} target="_blank" rel="noreferrer" className="lp-header__link">
          GitHub
        </a>
      </div>
    </header>
  );
}
