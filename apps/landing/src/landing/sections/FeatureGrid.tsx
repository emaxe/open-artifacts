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
} from "../../components/ui/icons";
import { Reveal } from "../Reveal";
import { useLandingCopy } from "../LandingI18n";
import { SectionHead } from "../SectionHead";

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

// The two headline capabilities get large tiles (indices into copy.ts items); the rest is a quiet list.
const FEATURED = [0, 4];

// Chips under the two large tiles — code identifiers, so they are not translated.
const CHIPS: Record<number, string[]> = {
  0: ["sandbox", "default-src 'none'", "connect-src 'none'", "frame-ancestors", "text/plain source"],
  4: ["kpi-row", "chart-bar", "gallery", "slideshow", "cards", "accordion", "tabs", "toc", "feature-matrix", "mermaid-diagram"],
};

export function FeatureGrid() {
  const { t } = useLandingCopy();
  const items = t.features.items.map((item, i) => ({ item, Icon: ICONS[i], i }));
  const featured = items.filter(({ i }) => FEATURED.includes(i));
  const rest = items.filter(({ i }) => !FEATURED.includes(i));
  return (
    <section id="features" className="scroll-mt-16 mx-auto max-w-6xl px-4 py-20 sm:py-24 sm:px-6">
      <Reveal>
        <SectionHead index={3} label={t.kickers.features} title={t.features.heading} lead={t.features.subtitle} />
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-2">
        {featured.map(({ item, Icon, i }, n) => (
          <Reveal key={item.title} delayMs={n * 80}>
            <div
              className={`h-full rounded-card p-6 sm:p-8 ${i === 4 ? "bg-accent-soft" : "bg-panel"}`}
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-control bg-accent text-accent-fg">
                {Icon && <Icon size={22} />}
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">{item.title}</h3>
              <p className="mt-2 max-w-prose text-muted">{item.body}</p>
              {CHIPS[i] && (
                <ul className="mt-5 flex flex-wrap gap-2" aria-hidden="true">
                  {CHIPS[i].map((chip) => (
                    <li key={chip} className={`rounded-control px-2 py-0.5 font-mono text-xs text-muted ${i === 4 ? "bg-panel" : "bg-panel-muted"}`}>
                      {chip}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-12">
      <ul className="oa-stagger-list grid gap-x-12 gap-y-8 sm:grid-cols-2">
        {rest.map(({ item, Icon }) => (
          <li key={item.title} className="flex gap-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
              {Icon && <Icon size={18} />}
            </span>
            <div>
              <h3 className="text-base font-medium text-fg">{item.title}</h3>
              <p className="mt-1 text-sm text-muted">{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
      </Reveal>
    </section>
  );
}
