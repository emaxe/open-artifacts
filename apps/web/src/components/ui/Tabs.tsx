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
    <nav className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-control bg-panel-muted p-1", className)}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "whitespace-nowrap rounded-control px-3.5 py-1.5 text-sm font-medium transition-colors duration-150",
              isActive ? "bg-panel text-fg" : "text-muted hover:text-fg",
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
