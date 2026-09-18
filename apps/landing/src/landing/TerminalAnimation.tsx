import { useEffect, useRef, useState } from "react";
import { TerminalIcon } from "../components/ui/icons";
import { useReducedMotion } from "./useReducedMotion";
import { useInViewOnce } from "./useInViewOnce";
import { useLandingCopy } from "./LandingI18n";

// The real `oa` CLI transcript — deliberately left in English everywhere (see copy.ts's
// terminalCaption): this is what actually prints in a terminal on any install, translating it
// would show something a viewer would never actually see.
const LINES: { prompt?: string; text: string; className?: string }[] = [
  { prompt: "$", text: "npx skills add emaxe/open-artifacts" },
  { text: "✓ Installed skill \"open-artifacts\" (@emaxe/oa 0.10.0)", className: "text-success" },
  { prompt: "$", text: "oa login --server https://your-server" },
  { text: "Verification code: ABCD-1234", className: "text-muted" },
  { text: "Open https://your-server/activate?code=ABCD-1234 to continue…", className: "text-muted" },
  { text: "✓ Signed in as you@example.com", className: "text-success" },
  { prompt: "$", text: "oa push report.html --title \"Q3 Summary\" --share" },
  { text: "✓ Created artifact a1b2c3 (v1)", className: "text-success" },
  { text: "🔗 https://your-server/s/9kQ2xR", className: "text-accent" },
];

const FULL_TRANSCRIPT = LINES.map((l) => (l.prompt ? `${l.prompt} ${l.text}` : l.text)).join("\n");

export function TerminalAnimation() {
  const { t } = useLandingCopy();
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
    <div ref={containerRef} className="overflow-hidden rounded-card border border-border bg-[#0d1117] shadow-sm">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-white/70">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
        <span className="ml-2 flex items-center gap-1.5 text-xs">
          <TerminalIcon size={12} /> zsh
        </span>
        {!reducedMotion && done && (
          <button
            type="button"
            onClick={() => setRunId((n) => n + 1)}
            className="ml-auto rounded-control px-2 py-0.5 text-xs text-white/60 hover:bg-white/10 hover:text-white"
          >
            ↻ {t.how.terminalReplay}
          </button>
        )}
      </div>
      <pre aria-hidden="true" className="min-h-56 overflow-x-auto p-4 text-xs leading-relaxed text-[#c9d1d9] sm:text-sm">
        {LINES.map((line, idx) => {
          const lineText = shownLines[idx];
          if (lineText === undefined) return null;
          return (
            <div key={idx} className={line.className}>
              {line.prompt && <span className="mr-2 text-[#7ee787]">{line.prompt}</span>}
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
