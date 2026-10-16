import { useEffect, useMemo, useRef, useState } from "react";
import { useDomain } from "./DomainContext";
import { useInViewOnce } from "./useInViewOnce";
import { useLandingCopy } from "./LandingI18n";
import { useReducedMotion } from "./useReducedMotion";
import { APP_VERSION } from "./links";

type Tone = "plain" | "dim" | "link";

/**
 * The real `oa` CLI transcript, typed out once as it scrolls into view. Deliberately left in English
 * in both languages: this is what a terminal prints on any install. The server in the commands is the
 * domain the visitor typed in the hero.
 */
export function TerminalAnimation() {
  const { t } = useLandingCopy();
  const { host, link } = useDomain();
  const reducedMotion = useReducedMotion();
  const [containerRef, inView] = useInViewOnce<HTMLDivElement>();
  const [visibleChars, setVisibleChars] = useState(reducedMotion ? Infinity : 0);
  const [runId, setRunId] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lines = useMemo<{ prompt?: string; text: string; tone: Tone }[]>(
    () => [
      { prompt: "$", text: "npx skills add emaxe/open-artifacts", tone: "plain" },
      { text: `ok Installed skill "open-artifacts" (@emaxe/oa ${APP_VERSION})`, tone: "dim" },
      { prompt: "$", text: `oa login --server https://${host}`, tone: "plain" },
      { text: "Verification code: ABCD-1234", tone: "dim" },
      { text: `Open https://${host}/activate?code=ABCD-1234 to continue…`, tone: "dim" },
      { text: "ok Signed in as you@example.com", tone: "dim" },
      { prompt: "$", text: "node constructor/build.mjs report.yaml --share", tone: "plain" },
      { text: "ok Spec validated: 8 blocks ok", tone: "dim" },
      { text: "ok Built: report.html (18.8 KB)", tone: "dim" },
      { text: "ok Created artifact a1b2c3 (v1)", tone: "dim" },
      { text: `→ ${link}`, tone: "link" },
    ],
    [host, link],
  );

  const transcript = lines.map((l) => (l.prompt ? `${l.prompt} ${l.text}` : l.text)).join("\n");
  const totalChars = transcript.length;

  useEffect(() => {
    if (reducedMotion) {
      setVisibleChars(totalChars);
      return;
    }
    if (!inView) return;
    setVisibleChars(0);
    let i = 0;
    timerRef.current = setInterval(() => {
      i += 2;
      setVisibleChars(Math.min(i, totalChars));
      if (i >= totalChars && timerRef.current) clearInterval(timerRef.current);
    }, 12);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // The transcript text depends on the typed domain; replay is driven by inView/runId only, so
    // typing in the hero does not restart the animation mid-way.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reducedMotion, runId]);

  const shownLines = transcript.slice(0, visibleChars).split("\n");
  const done = visibleChars >= totalChars;

  return (
    <div ref={containerRef} className="lp-term" data-ui>
      <div className="lp-term__bar">
        <span>{t.how.terminalCaption}</span>
        {!reducedMotion && done && (
          <button type="button" className="lp-term__replay" onClick={() => setRunId((n) => n + 1)}>
            ↻ {t.how.terminalReplay}
          </button>
        )}
      </div>
      <pre aria-hidden="true">
        {lines.map((line, idx) => {
          const text = shownLines[idx];
          if (text === undefined) return null;
          return (
            <div key={idx} className={line.tone === "dim" ? "lp-term__dim" : line.tone === "link" ? "lp-term__link" : undefined}>
              {line.prompt && <span className="lp-term__prompt">{line.prompt}</span>}
              {text.replace(/^\$ /, "")}
            </div>
          );
        })}
        {!done && <span className="oa-caret" aria-hidden="true" />}
      </pre>
      {/* The full transcript, always present for assistive tech — the typing above is decorative. */}
      <pre className="sr-only">{transcript}</pre>
    </div>
  );
}
