import { ARTIFACT_THEMES, type ArtifactThemeId, type ArtifactThemeSummary } from "../lib/artifactThemes.generated";
import { cn } from "../lib/cn";

type Scheme = ArtifactThemeSummary["light"];

/** One half of the preview: a mini page in the theme's own colours for one colour scheme. */
function Swatch({ colors, label }: { colors: Scheme; label: string }) {
  return (
    <div className="flex-1 rounded-sm p-2" style={{ background: colors.bg }} aria-hidden="true">
      <div className="rounded-sm p-1.5" style={{ background: colors.surface }}>
        <div className="mb-1 h-1.5 w-8 rounded-full" style={{ background: colors.fg, opacity: 0.8 }} />
        <div className="flex gap-1">
          {[colors.accent, colors.c2, colors.c3, colors.c4].map((c, i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
          ))}
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * Radio-card picker for the artifact colour theme. `value === null` means "inherit"; the inherit
 * card is only shown when `inheritLabel` is given (artifact and team level — the service level
 * always holds a concrete theme).
 */
export function ThemePicker({
  value,
  onChange,
  inheritLabel,
  disabled,
  ariaLabel = "Тема оформления",
}: {
  value: ArtifactThemeId | null;
  onChange: (v: ArtifactThemeId | null) => void;
  /** e.g. "Как у команды: Ocean". Omit to hide the inherit option. */
  inheritLabel?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const card = (selected: boolean) =>
    cn(
      "flex flex-col gap-2 rounded-control border p-2.5 text-left transition-colors",
      "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
      selected ? "border-accent bg-accent-soft" : "border-border bg-panel hover:bg-panel-muted",
    );

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      // 6 cards with "inherit", 5 without: columns chosen so no row is left with a lone card.
      className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", inheritLabel === undefined && "lg:grid-cols-5")}
    >
      {inheritLabel !== undefined && (
        <button type="button" role="radio" aria-checked={value === null} disabled={disabled} onClick={() => onChange(null)} className={card(value === null)}>
          <span className="flex h-[3.75rem] items-center justify-center rounded-sm border border-dashed border-border text-xs text-muted">наследуется</span>
          <span className="text-sm font-medium text-fg">Наследовать</span>
          <span className="text-xs text-muted">{inheritLabel}</span>
        </button>
      )}
      {ARTIFACT_THEMES.map((t) => {
        const selected = value === t.id;
        return (
          <button key={t.id} type="button" role="radio" aria-checked={selected} disabled={disabled} onClick={() => onChange(t.id)} className={card(selected)}>
            <span className="flex gap-1">
              <Swatch colors={t.light} label="светлая версия" />
              <Swatch colors={t.dark} label="тёмная версия" />
            </span>
            <span className="text-sm font-medium text-fg" style={{ fontFamily: t.fontFamily }}>
              {t.name}
            </span>
            <span className="text-xs text-muted">{t.description}</span>
          </button>
        );
      })}
    </div>
  );
}

export function themeName(id: ArtifactThemeId | string | null | undefined): string {
  return ARTIFACT_THEMES.find((t) => t.id === id)?.name ?? String(id ?? "");
}
