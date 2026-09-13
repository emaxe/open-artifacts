import { useTheme, type ThemePreference } from "../../lib/theme";
import { cn } from "../../lib/cn";

/**
 * Extracted from GlobalSidebar so the (bilingual) landing header can reuse the exact same
 * three-state control instead of re-implementing it — `labels` is the only thing that varies
 * between the Russian-only app chrome and the landing's RU/EN copy.
 */
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
            "flex-1 rounded-[calc(var(--radius-control)-2px)] px-2 py-1 text-xs font-medium",
            theme === value ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg",
          )}
        >
          {labels[value]}
        </button>
      ))}
    </div>
  );
}
