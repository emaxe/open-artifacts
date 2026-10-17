import { LogoMark } from "../../components/Logo";
import { GithubIcon, ExternalLinkIcon } from "../../components/ui/icons";
import { useLandingCopy } from "../LandingI18n";
import { EXTERNAL_LINKS, APP_VERSION } from "../links";

const LINK = "inline-flex items-center gap-1.5 text-fg underline-offset-4 transition-colors hover:text-accent hover:underline";

// One quiet block: who we are on the left, every link on one wrapping row on the right, the licence below.
export function LandingFooter() {
  const { t } = useLandingCopy();
  return (
    <footer className="bg-panel-muted py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="flex items-center gap-2 font-semibold text-fg">
            <LogoMark size={24} /> Open Artifacts
          </p>
          <p className="mt-2 max-w-sm text-sm text-muted">{t.footer.tagline}</p>
        </div>

        <nav aria-label="Footer" className="max-w-xl">
          <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm lg:justify-end">
            <li>
              <a href="#features" className={LINK}>{t.nav.features}</a>
            </li>
            <li>
              <a href="#security" className={LINK}>{t.nav.security}</a>
            </li>
            <li>
              <a href="#self-host" className={LINK}>{t.nav.selfHost}</a>
            </li>
            <li>
              <a href={EXTERNAL_LINKS.github} target="_blank" rel="noreferrer" className={LINK}>
                <GithubIcon size={14} /> {t.footer.sourceLabel}
              </a>
            </li>
            <li>
              <a href={EXTERNAL_LINKS.npm} target="_blank" rel="noreferrer" className={LINK}>
                npm <ExternalLinkIcon size={12} />
              </a>
            </li>
            <li>
              <a href={EXTERNAL_LINKS.changelog} target="_blank" rel="noreferrer" className={LINK}>
                Changelog <ExternalLinkIcon size={12} />
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 text-xs text-muted sm:px-6">
        <span className="tabular-nums">
          {t.footer.license} · v{APP_VERSION}
        </span>
        <a href={EXTERNAL_LINKS.license} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
          MIT © emaxe
        </a>
      </div>
    </footer>
  );
}
