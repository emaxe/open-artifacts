import { DomainProvider } from "./DomainContext";
import { LandingI18nProvider } from "./LandingI18n";
import { LandingHeader } from "./LandingHeader";
import { HeroSection } from "./sections/HeroSection";
import { HowItWorksSection } from "./sections/HowItWorksSection";
import { ShowcaseSection } from "./sections/ShowcaseSection";
import { ProductSection } from "./sections/ProductSection";
import { CompareSection } from "./sections/CompareSection";
import { PosterSection } from "./sections/PosterSection";
import { SelfHostSection } from "./sections/SelfHostSection";
import { PressBand, PressVideoBand } from "./MediaBands";
import { CtaBand } from "./sections/CtaBand";
import { LandingFooter } from "./sections/LandingFooter";
import "./landing.css";

function LandingContent() {
  return (
    <div className="lp">
      <LandingHeader />
      <main>
        <HeroSection />
        <PressBand />
        <HowItWorksSection />
        <ShowcaseSection />
        <PressVideoBand />
        <ProductSection />
        <CompareSection />
        <PosterSection />
        <SelfHostSection />
        <CtaBand />
      </main>
      <LandingFooter />
    </div>
  );
}

/**
 * The whole site: one page, no router, no backend. The visitor's typed domain (DomainProvider) is the
 * one live thing — see HeroSection. Purely informational: it links out to GitHub and the setup guide.
 */
export function LandingPage() {
  return (
    <LandingI18nProvider>
      <DomainProvider>
        <LandingContent />
      </DomainProvider>
    </LandingI18nProvider>
  );
}
