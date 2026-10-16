import { useLandingCopy } from "../LandingI18n";
import { APP_VERSION, EXTERNAL_LINKS } from "../links";

/** The way to reach the project is the display line: the repository address, set as the footer's headline. */
export function LandingFooter() {
  const { t } = useLandingCopy();
  return (
    <footer className="lp-footer">
      <div className="lp-footer__notes">
        <span>Open Artifacts</span>
        <span>{t.footer.tagline}</span>
        <span>
          {t.footer.version} {APP_VERSION}
        </span>
        <a href="#top">{t.footer.top} ↑</a>
      </div>

      <a className="lp-footer__address" href={EXTERNAL_LINKS.github} target="_blank" rel="noreferrer">
        <span>github.com/</span>
        <span>emaxe/open-artifacts</span>
      </a>

      <div className="lp-footer__meta">
        <nav aria-label="Links">
          <a href={EXTERNAL_LINKS.npm} target="_blank" rel="noreferrer">
            npm
          </a>
          <a href={EXTERNAL_LINKS.skills} target="_blank" rel="noreferrer">
            skills.sh
          </a>
          <a href={EXTERNAL_LINKS.changelog} target="_blank" rel="noreferrer">
            Changelog
          </a>
          <a href={EXTERNAL_LINKS.license} target="_blank" rel="noreferrer">
            MIT
          </a>
        </nav>
        <span>{t.footer.credit}</span>
        <span>{t.footer.location}</span>
      </div>

      <p className="lp-footer__credits">
        {t.media.credits}:{" "}
        <a href="https://commons.wikimedia.org/w/index.php?curid=122816489" target="_blank" rel="noreferrer">
          “Old Threshers Miehle Press Drum”
        </a>{" "}
        by Douglas W. Jones, CC0;{" "}
        <a href="https://commons.wikimedia.org/w/index.php?curid=9524431" target="_blank" rel="noreferrer">
          “Brass letter stamps”
        </a>{" "}
        by Edinburgh City of Print, <a href="https://creativecommons.org/licenses/by/2.0/">CC BY 2.0</a>;{" "}
        <a href="https://commons.wikimedia.org/w/index.php?curid=196777512" target="_blank" rel="noreferrer">
          “Home server equipment”
        </a>{" "}
        by Alan Levine, <a href="https://creativecommons.org/licenses/by/2.0/">CC BY 2.0</a>;{" "}
        <a href="https://commons.wikimedia.org/wiki/File:The_910_ton_printing_presses_at_the_Las_Vegas_Review-Journal_were_the_largest_in_the_world_when_installed_in_2000.webm" target="_blank" rel="noreferrer">
          “The 910 ton printing presses at the Las Vegas Review-Journal…”
        </a>{" "}
        by Harrison Keely, <a href="https://creativecommons.org/licenses/by/4.0">CC BY 4.0</a>. Wikimedia Commons.
      </p>
    </footer>
  );
}
