import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { useInViewOnce } from "./useInViewOnce";

/**
 * Fades/slides a section in once it scrolls into view. The `oa-reveal` class and its
 * `prefers-reduced-motion` kill switch live in styles.css — this component only toggles the
 * `is-visible` modifier, so a reduced-motion viewer gets the exact same DOM, just without motion.
 */
export function Reveal({ children, className, delayMs = 0 }: { children: ReactNode; className?: string; delayMs?: number }) {
  const [ref, inView] = useInViewOnce<HTMLDivElement>();
  return (
    <div ref={ref} className={cn("oa-reveal", inView && "is-visible", className)} style={{ transitionDelay: inView ? `${delayMs}ms` : "0ms" }}>
      {children}
    </div>
  );
}
