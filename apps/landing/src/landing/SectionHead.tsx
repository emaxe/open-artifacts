import type { ReactNode } from "react";

/**
 * Left-aligned section heading: a small numbered label ("03 · Features"), the headline and an
 * optional lead paragraph. Only the hero and the closing call to action stay centred.
 */
export function SectionHead({
  index,
  label,
  title,
  lead,
}: {
  index: number;
  label: string;
  title: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <header className="mb-10 max-w-3xl">
      <p className="mb-3 flex items-center gap-2 text-sm font-medium text-accent">
        <span className="tabular-nums">{String(index).padStart(2, "0")}</span>
        <span aria-hidden="true" className="h-px w-6 bg-accent/50" />
        <span>{label}</span>
      </p>
      <h2 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">{title}</h2>
      {lead ? <p className="mt-3 max-w-prose text-muted">{lead}</p> : null}
    </header>
  );
}
