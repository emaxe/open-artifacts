import {
  ShieldIcon,
  GridIcon,
  PlugIcon,
  TerminalIcon,
  SparklesIcon,
  HistoryIcon,
  UsersIcon,
  LinkIcon,
  DatabaseIcon,
  ClockIcon,
  SettingsIcon,
  ServerIcon,
  type IconProps,
} from "../../../components/ui/icons";
import { Reveal } from "../Reveal";
import { useLandingCopy } from "../LandingI18n";

// Icons aren't translated, so they're zipped with the bilingual copy by index rather than living
// inside copy.ts (which would otherwise couple plain data to React components in both languages).
// Order must match LandingCopy["features"]["items"] in copy.ts.
const ICONS: ((props: IconProps) => React.JSX.Element)[] = [
  ShieldIcon,
  GridIcon,
  PlugIcon,
  TerminalIcon,
  SparklesIcon,
  HistoryIcon,
  UsersIcon,
  LinkIcon,
  DatabaseIcon,
  ClockIcon,
  SettingsIcon,
  ServerIcon,
];

export function FeatureGrid() {
  const { t } = useLandingCopy();
  return (
    <section id="features" className="scroll-mt-16 mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <Reveal className="text-center">
        <h2 className="text-2xl font-semibold text-fg sm:text-3xl">{t.features.heading}</h2>
        <p className="mt-2 text-muted">{t.features.subtitle}</p>
      </Reveal>
      <div className="mt-10 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {t.features.items.map((item, i) => {
          const Icon = ICONS[i];
          return (
            <Reveal key={item.title} delayMs={(i % 4) * 60}>
              <div className="h-full rounded-card border border-border bg-panel p-4">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-control bg-panel-muted text-accent">
                  {Icon && <Icon size={18} />}
                </div>
                <h3 className="text-sm font-semibold text-fg">{item.title}</h3>
                <p className="mt-1 text-sm text-muted">{item.body}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
