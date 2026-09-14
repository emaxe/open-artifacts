import { useTheme, type ThemePreference } from "../../lib/theme";
import { cn } from "../../lib/cn";

// Mirrors apps/web/src/components/ui/ThemeSwitch.tsx verbatim (this package's own lib/theme).
export function ThemeSwitch({
  labels,
  className,
}: {
  labels: Record<ThemePreference, string>;
  className?: string;
}) {
  const { theme, setTheme } = useTheme();
  const options: ThemePreference[] = ["light", "system", "dark"];

  return (
    <div className={cn("flex gap-1 rounded-control bg-panel-muted p-1", className)}>
      {options.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            "min-w-0 flex-1 truncate rounded-[calc(var(--radius-control)-2px)] px-2 py-1 text-xs font-medium",
            theme === value ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg",
          )}
        >
          {labels[value]}
        </button>
      ))}
    </div>
  );
}
