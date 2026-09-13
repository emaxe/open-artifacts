import { useRef } from "react";
import { useReducedMotion } from "./useReducedMotion";
import { LandingI18nProvider } from "./LandingI18n";
import { LandingHeader } from "./LandingHeader";
import type { AuthCardHandle, AuthTab } from "./AuthCard";
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
  const authCardRef = useRef<AuthCardHandle>(null);
  const reducedMotion = useReducedMotion();

  function focusAuth(tab: AuthTab) {
    authCardRef.current?.focus(tab);
    document.getElementById("auth-card")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      <LandingHeader onFocusAuth={focusAuth} />
      <main>
        <HeroSection authCardRef={authCardRef} />
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
        <ClosingCta onFocusAuth={focusAuth} />
      </main>
      <LandingFooter />
    </div>
  );
}

/**
 * Marketing landing at `/` (for a signed-out visitor — see RootRoute.tsx) and at the explicit
 * `/welcome` path (reachable even signed in). Bilingual (RU/EN, landing-only — see copy.ts) with
 * an inline sign-in/sign-up card, so this is also the app's actual `/login`+`/register` entry
 * point for most visitors; the dedicated `/login` and `/register` pages keep working unchanged for
 * `?next=` redirects from share links.
 */
export function LandingPage() {
  return (
    <LandingI18nProvider>
      <LandingContent />
    </LandingI18nProvider>
  );
}
