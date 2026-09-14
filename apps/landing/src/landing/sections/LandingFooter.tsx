import { LogoMark } from "../../components/Logo";
import { GithubIcon, ExternalLinkIcon } from "../../components/ui/icons";
import { useLandingCopy } from "../LandingI18n";
import { EXTERNAL_LINKS, APP_VERSION } from "../links";

export function LandingFooter() {
  const { t } = useLandingCopy();
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2 font-semibold text-fg">
            <LogoMark size={20} /> Open Artifacts
          </p>
          <p className="mt-2 max-w-sm text-sm text-muted">{t.footer.tagline}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-muted">{t.footer.product}</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            <li>
              <a href="#features" className="text-fg hover:underline">
                {t.nav.features}
              </a>
            </li>
            <li>
              <a href="#security" className="text-fg hover:underline">
                {t.nav.security}
              </a>
            </li>
            <li>
              <a href="#self-host" className="text-fg hover:underline">
                {t.nav.selfHost}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-muted">{t.footer.resources}</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            <li>
              <a href={EXTERNAL_LINKS.github} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-fg hover:underline">
                <GithubIcon size={14} /> {t.footer.sourceLabel}
              </a>
            </li>
            <li>
              <a href={EXTERNAL_LINKS.npm} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-fg hover:underline">
                npm @emaxe/oa <ExternalLinkIcon size={12} />
              </a>
            </li>
            <li>
              <a href={EXTERNAL_LINKS.changelog} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-fg hover:underline">
                Changelog <ExternalLinkIcon size={12} />
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-8 flex max-w-6xl flex-wrap items-center justify-between gap-2 border-t border-border px-4 pt-4 text-xs text-muted sm:px-6">
        <span>
          {t.footer.license} · v{APP_VERSION}
        </span>
        <a href={EXTERNAL_LINKS.license} target="_blank" rel="noreferrer" className="hover:underline">
          MIT © emaxe
        </a>
      </div>
    </footer>
  );
}
