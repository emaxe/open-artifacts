import { DEMO_HTML } from "./demo/demoArtifact";
import { useLandingCopy } from "./LandingI18n";

/**
 * A real sandboxed iframe, not a screenshot or a styled `<div>` mockup — `sandbox="allow-scripts"`
 * with NO `allow-same-origin` is exactly the isolation model `/embed/:token` uses in production
 * (see packages/shared/src/csp.ts), so what a visitor sees here is the actual mechanism, not a
 * drawing of it. The faux browser chrome around it makes that framing explicit: this is "someone
 * else's artifact, viewed through the product," which is what it actually is.
 */
export function DemoPreview() {
  const { t } = useLandingCopy();
  return (
    <div className="overflow-hidden rounded-card border border-border shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-panel-muted px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
        <span className="ml-2 truncate rounded-control bg-panel px-2 py-0.5 text-xs text-muted">{t.demo.fakeUrl}</span>
      </div>
      <iframe
        title={t.demo.frameTitle}
        sandbox="allow-scripts"
        srcDoc={DEMO_HTML}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-72 w-full border-0 bg-bg sm:h-80"
      />
      <p className="border-t border-border bg-panel-muted px-3 py-1.5 text-[11px] text-muted">{t.demo.note}</p>
    </div>
  );
}
