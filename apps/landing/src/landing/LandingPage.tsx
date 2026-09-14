import { LandingI18nProvider } from "./LandingI18n";
import { LandingHeader } from "./LandingHeader";
import { HeroSection } from "./sections/HeroSection";
import { CompatStrip } from "./sections/CompatStrip";
import { ProblemSection } from "./sections/ProblemSection";
import { HowItWorksSection } from "./sections/HowItWorksSection";
import { FeatureGrid } from "./sections/FeatureGrid";
import { SecuritySection } from "./sections/SecuritySection";
import { LivePreviewSection } from "./sections/LivePreviewSection";
import { StatsSection } from "./sections/StatsSection";
import { AudienceSection } from "./sections/AudienceSection";
import { ComparisonSection } from "./sections/ComparisonSection";
import { SelfHostSection } from "./sections/SelfHostSection";
import { ClosingCta } from "./sections/ClosingCta";
import { LandingFooter } from "./sections/LandingFooter";

function LandingContent() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <LandingHeader />
      <main>
        <HeroSection />
        <CompatStrip />
        <ProblemSection />
        <HowItWorksSection />
        <FeatureGrid />
        <SecuritySection />
        <LivePreviewSection />
        <StatsSection />
        <AudienceSection />
        <ComparisonSection />
        <SelfHostSection />
        <ClosingCta />
      </main>
      <LandingFooter />
    </div>
  );
}

/**
 * The whole site — mirrors apps/web/src/pages/landing/LandingPage.tsx, minus the inline
 * sign-in/sign-up card (`AuthCard`, `authCardRef`/`focusAuth`) that used to live in the hero. This
 * is now purely informational: it links out to GitHub and the self-host instructions instead of
 * authenticating anyone — see the app's own `/` for the actual sign-in/sign-up screen.
 */
export function LandingPage() {
  return (
    <LandingI18nProvider>
      <LandingContent />
    </LandingI18nProvider>
  );
}
