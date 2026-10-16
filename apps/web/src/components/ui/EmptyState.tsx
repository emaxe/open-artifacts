import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-card bg-panel-muted px-6 py-14 text-center", className)}>
      {icon && <div className="text-muted">{icon}</div>}
      <div>
        <p className="text-base font-semibold text-fg">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
