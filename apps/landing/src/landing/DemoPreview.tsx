import { useState } from "react";
import { copyToClipboard } from "../lib/clipboard";
import { DEMO_HTML } from "./demo/demoArtifact";
import { useDomain } from "./DomainContext";
import { useLandingCopy } from "./LandingI18n";

/**
 * A real sandboxed iframe, not a screenshot: `sandbox="allow-scripts"` with NO `allow-same-origin`
 * is exactly the isolation `/embed/:token` uses in production (packages/shared/src/csp.ts). Above it
 * sits a fragment of the real viewer panel (data-ui: the product's own interface, drawn in HTML) —
 * title, meta, the link on the visitor's own domain and a working "copy link" button.
 */
export function DemoPreview() {
  const { t } = useLandingCopy();
  const { link } = useDomain();
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (await copyToClipboard(link)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <div className="lp-product__frame">
      <div className="lp-panel" data-ui>
        <span className="lp-panel__title">{t.product.panelTitle}</span>
        <span className="lp-panel__meta">{t.product.panelMeta}</span>
        <span className="lp-panel__url">{link.replace("https://", "")}</span>
        <button type="button" className="lp-btn lp-btn--tonal" onClick={copy}>
          {copied ? t.product.copied : t.product.copy}
        </button>
      </div>
      <iframe title={t.product.frameTitle} sandbox="allow-scripts" srcDoc={DEMO_HTML} loading="lazy" referrerPolicy="no-referrer" />
    </div>
  );
}
