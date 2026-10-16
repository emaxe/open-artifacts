import { useEffect, useRef, useState } from "react";
import { TerminalIcon } from "../ui/icons";
import { useReducedMotion } from "../../lib/useReducedMotion";
import { useInViewOnce } from "../../lib/useInViewOnce";
import { useAuthCopy } from "../../pages/auth/AuthI18n";

// The real `oa` CLI transcript — deliberately left in English everywhere (this is what actually
// prints in a terminal on any install; translating it would show something a viewer would never
// actually see). Moved from the former landing (pages/landing/TerminalAnimation.tsx) onto the
// sign-in screen's brand panel — the "@emaxe/oa X.Y.Z" version string is packages/cli's own
// version (published to npm separately from the app), not this app's — keep it in sync with
// packages/cli/package.json on release (see apps/landing's own copy of this file for the other
// half of that chore).
const LINES: { prompt?: string; text: string; className?: string }[] = [
  { prompt: "$", text: "npx skills add emaxe/open-artifacts" },
  { text: "ok Installed skill \"open-artifacts\" (@emaxe/oa 0.12.0)", className: "opacity-70" },
  { prompt: "$", text: "oa login --server https://your-server" },
  { text: "Verification code: ABCD-1234", className: "opacity-70" },
  { text: "Open https://your-server/activate?code=ABCD-1234 to continue…", className: "opacity-70" },
  { text: "ok Signed in as you@example.com", className: "opacity-70" },
  { prompt: "$", text: "oa push report.html --title \"Q3 Summary\" --share" },
  { text: "ok Created artifact a1b2c3 (v1)", className: "opacity-70" },
  { text: "→ https://your-server/s/9kQ2xR", className: "font-semibold" },
];

const FULL_TRANSCRIPT = LINES.map((l) => (l.prompt ? `${l.prompt} ${l.text}` : l.text)).join("\n");

export function TerminalAnimation() {
  const { t } = useAuthCopy();
  const reducedMotion = useReducedMotion();
  const [containerRef, inView] = useInViewOnce<HTMLDivElement>();
  const [visibleChars, setVisibleChars] = useState(reducedMotion ? Infinity : 0);
  const [runId, setRunId] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalChars = FULL_TRANSCRIPT.length;

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
      if (i >= totalChars && timerRef.current) {
        clearInterval(timerRef.current);
      }
    }, 12);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reducedMotion, runId, totalChars]);

  const shown = FULL_TRANSCRIPT.slice(0, visibleChars);
  const shownLines = shown.split("\n");
  const done = visibleChars >= totalChars;

  return (
    <div ref={containerRef} className="rounded-card bg-field-fg/10 p-5 text-field-fg">
      <div className="mb-3 flex items-center gap-2 text-[0.8125rem] opacity-80">
        <TerminalIcon size={13} /> zsh
        {!reducedMotion && done && (
          <button
            type="button"
            onClick={() => setRunId((n) => n + 1)}
            className="ml-auto rounded-control px-2 py-1 transition-colors duration-150 hover:bg-field-fg/15"
          >
            ↻ {t.brand.terminalReplay}
          </button>
        )}
      </div>
      <pre aria-hidden="true" className="min-h-56 overflow-x-auto font-mono text-[0.8125rem] leading-relaxed">
        {LINES.map((line, idx) => {
          const lineText = shownLines[idx];
          if (lineText === undefined) return null;
          return (
            <div key={idx} className={line.className}>
              {line.prompt && <span className="mr-2 text-accent-soft">{line.prompt}</span>}
              {lineText.replace(/^\$ /, "")}
            </div>
          );
        })}
        {!done && <span className="oa-caret" aria-hidden="true" />}
      </pre>
      {/* The full transcript, always present for assistive tech — the animation above is decorative. */}
      <pre className="sr-only">{FULL_TRANSCRIPT}</pre>
    </div>
  );
}
