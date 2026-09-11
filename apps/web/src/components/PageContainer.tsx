import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * Replaces `.main { max-width: 960px }` — 960px can't hold a data-dense admin table (user rows
 * with org chips, audit filters) at any reasonable column width. `wide` opts into a bigger cap for
 * exactly those screens; everything else keeps a comfortable reading width.
 */
export function PageContainer({ children, wide = false, className }: { children: ReactNode; wide?: boolean; className?: string }) {
  return <div className={cn("mx-auto w-full px-4 py-6 md:px-6", wide ? "max-w-6xl" : "max-w-5xl", className)}>{children}</div>;
}
