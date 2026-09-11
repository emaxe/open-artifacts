import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";

export interface TabItem {
  to: string;
  label: string;
  end?: boolean;
}

/**
 * A thin `NavLink` wrapper, not a stateful tabs primitive — every tab bar in this app is a set of
 * real routes, so the active tab lives in the URL (deep-linkable, survives a refresh) rather than
 * in component state.
 */
export function Tabs({ items, className }: { items: TabItem[]; className?: string }) {
  return (
    <nav className={cn("flex gap-1 border-b border-border", className)}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              isActive ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg",
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
