import { useAuth } from "../../lib/auth";
import { LogoMark } from "../../components/Logo";
import { Button } from "../../components/ui/Button";
import { ThemeSwitch } from "../../components/ui/ThemeSwitch";
import { LangToggle } from "./LangToggle";
import { useLandingCopy } from "./LandingI18n";
import type { AuthTab } from "./AuthCard";

const THEME_LABELS = { light: "☀︎", system: "◐", dark: "☾" };

export function LandingHeader({ onFocusAuth }: { onFocusAuth: (tab: AuthTab) => void }) {
  const { t } = useLandingCopy();
  const { me } = useAuth();

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
          {me ? (
            <Button size="sm" onClick={() => (window.location.href = "/")}>
              {t.nav.openApp}
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => onFocusAuth("login")}>
                {t.nav.signIn}
              </Button>
              <Button size="sm" onClick={() => onFocusAuth("register")}>
                {t.nav.signUp}
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
