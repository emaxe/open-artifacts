import { useState } from "react";
import { Select, Input } from "./Input";
import { formatLifetime } from "../../lib/labels";

/** 1 hour, 6 hours, 1 day, 7 days, 30 days, 90 days — filtered down to whatever fits under `maxMinutes`. */
const PRESET_MINUTES = [60, 360, 1440, 10080, 43200, 129600];

/**
 * Picks an artifact lifetime in minutes. `value === null` means "never expires" and is only
 * offered as a choice when `maxMinutes === null` (unlimited) — under a finite ceiling, "never"
 * isn't a legal choice, so it's simply not in the list.
 */
export function LifetimeSelect({
  value,
  maxMinutes,
  onChange,
  disabled,
}: {
  value: number | null;
  maxMinutes: number | null;
  onChange: (minutes: number | null) => void;
  disabled?: boolean;
}) {
  const presets = PRESET_MINUTES.filter((m) => maxMinutes === null || m <= maxMinutes);
  const isPreset = value !== null && presets.includes(value);
  const mode = value === null ? "unlimited" : isPreset ? String(value) : "custom";

  const [customDraft, setCustomDraft] = useState(value !== null && !isPreset ? String(value) : "");

  function handleModeChange(next: string) {
    if (next === "unlimited") {
      onChange(null);
      return;
    }
    if (next === "custom") {
      const n = Number(customDraft);
      onChange(n > 0 ? n : (presets[0] ?? 60));
      return;
    }
    onChange(Number(next));
  }

  function handleCustomChange(raw: string) {
    setCustomDraft(raw);
    const n = Number(raw);
    if (n > 0) onChange(n);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={mode} disabled={disabled} onChange={(e) => handleModeChange(e.target.value)} className="max-w-48">
        {presets.map((m) => (
          <option key={m} value={m}>
            {formatLifetime(m)}
          </option>
        ))}
        <option value="custom">Другое…</option>
        {maxMinutes === null && <option value="unlimited">Без ограничений</option>}
      </Select>
      {mode === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={1}
            max={maxMinutes ?? undefined}
            disabled={disabled}
            value={customDraft}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="w-24"
          />
          <span className="text-xs text-muted">минут</span>
        </div>
      )}
    </div>
  );
}
