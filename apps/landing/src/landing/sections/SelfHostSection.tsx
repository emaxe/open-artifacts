import { useState } from "react";
import { copyToClipboard } from "../../lib/clipboard";
import { Reveal } from "../Reveal";
import { useLandingCopy } from "../LandingI18n";
import { ServerPicture } from "../MediaBands";
import { EXTERNAL_LINKS } from "../links";

export function SelfHostSection() {
  const { t } = useLandingCopy();
  const [copied, setCopied] = useState(false);
  const s = t.selfHost;

  async function copy() {
    if (await copyToClipboard(s.command)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <section id="self-host" className="lp-section lp-self">
      <Reveal className="lp-self__heading">
        <h2 className="lp-display">{s.heading}</h2>
      </Reveal>
      <Reveal delayMs={60} className="lp-self__picture">
        <ServerPicture />
      </Reveal>
      <Reveal delayMs={100} className="lp-self__body">
        <p>{s.body}</p>
        <div className="lp-cmd" data-ui>
          <code>{s.command}</code>
          <button type="button" className="lp-btn lp-btn--tonal" onClick={copy}>
            {copied ? s.copied : s.copy}
          </button>
        </div>
        <p className="lp-self__note">{s.note}</p>
        <a className="lp-self__link" href={`${EXTERNAL_LINKS.github}#readme`} target="_blank" rel="noreferrer">
          {s.docsLink} →
        </a>
      </Reveal>
    </section>
  );
}
