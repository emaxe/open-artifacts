import { useMediaQuery } from "./useMediaQuery";

/** Moved from the former landing (pages/landing/useReducedMotion.ts) and rebuilt on the
 * generalized useMediaQuery — the sign-in screen's brand panel needs the same live
 * `prefers-reduced-motion: reduce` tracking the demo trio (TerminalAnimation/DemoPreview) always
 * used, plus its own `(min-width: 1024px)` check for whether to render the panel at all. */
export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
