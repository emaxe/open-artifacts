import { useEffect, useRef, useState } from "react";
import { useInViewOnce } from "./useInViewOnce";
import { useReducedMotion } from "./useReducedMotion";
import { useLandingCopy } from "./LandingI18n";

const DURATION_MS = 900;

/** Counts up from 0 to `value` once scrolled into view. Every value on this page is a real, verifiable product fact (see copy.ts's `stats`) — never an invented metric, per this repo's own promo design guidance. */
export function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const { lang } = useLandingCopy();
  const reducedMotion = useReducedMotion();
  const [ref, inView] = useInViewOnce<HTMLSpanElement>();
  const [display, setDisplay] = useState(reducedMotion ? value : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value);
      return;
    }
    if (!inView) return;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [inView, reducedMotion, value]);

  const formatted = new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US").format(display);

  return (
    <span ref={ref} className="tabular-nums">
      {formatted}
      {suffix}
    </span>
  );
}
