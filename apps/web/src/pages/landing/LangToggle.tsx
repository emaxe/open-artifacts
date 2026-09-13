import { GlobeIcon } from "../../components/ui/icons";
import { useLandingCopy } from "./LandingI18n";

/** Same visual shape as `ui/ThemeSwitch` (segmented control), but only two options — kept as its own tiny component rather than generalizing ThemeSwitch to N options for a one-off case. */
export function LangToggle() {
  const { lang, setLang } = useLandingCopy();
  return (
    <div className="flex items-center gap-1 rounded-control bg-panel-muted p-1" aria-label="Language / Язык">
      <GlobeIcon size={14} className="ml-1 text-muted" />
      {(["ru", "en"] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={lang === value}
          onClick={() => setLang(value)}
          className={`rounded-[calc(var(--radius-control)-2px)] px-2 py-1 text-xs font-medium uppercase ${
            lang === value ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg"
          }`}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
