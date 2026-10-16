import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-fg md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-prose text-[0.9375rem] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
