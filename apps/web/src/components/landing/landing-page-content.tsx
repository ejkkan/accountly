"use client";

import React from "react";
import { LandingNavbar } from "./navbar";
import { HeroSection } from "./hero-section";
import { AboutSection } from "./about-section";
import { FeaturesSection } from "./features-section";
import { FaqSection } from "./faq-section";
import { CTASection } from "./cta-section";
import { LandingFooter } from "./footer";
import { LandingThemeCustomizer, LandingThemeCustomizerTrigger } from "./landing-theme-customizer";

export function LandingPageContent() {
  const [themeCustomizerOpen, setThemeCustomizerOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />

      <main>
        <HeroSection />
        <AboutSection />
        <FeaturesSection />
        <FaqSection />
        <CTASection />
      </main>

      <LandingFooter />

      <LandingThemeCustomizerTrigger onClick={() => setThemeCustomizerOpen(true)} />
      <LandingThemeCustomizer open={themeCustomizerOpen} onOpenChange={setThemeCustomizerOpen} />
    </div>
  );
}
