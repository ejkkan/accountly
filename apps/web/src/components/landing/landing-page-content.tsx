"use client"

import React from 'react'
import { LandingNavbar } from './navbar'
import { HeroSection } from './hero-section'
import { LogoCarousel } from './logo-carousel'
import { StatsSection } from './stats-section'
import { FeaturesSection } from './features-section'
import { TeamSection } from './team-section'
import { TestimonialsSection } from './testimonials-section'
import { BlogSection } from './blog-section'
import { PricingSection } from './pricing-section'
import { CTASection } from './cta-section'
import { ContactSection } from './contact-section'
import { FaqSection } from './faq-section'
import { LandingFooter } from './footer'
import { LandingThemeCustomizer, LandingThemeCustomizerTrigger } from './landing-theme-customizer'
import { AboutSection } from './about-section'

export function LandingPageContent() {
  const [themeCustomizerOpen, setThemeCustomizerOpen] = React.useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <LandingNavbar />

      {/* Main Content */}
      <main>
        <HeroSection />
        <LogoCarousel />
        <StatsSection />
        <AboutSection />
        <FeaturesSection />
        <TeamSection />
        <PricingSection />
        <TestimonialsSection />
        <BlogSection />
        <FaqSection />
        <CTASection />
        <ContactSection />
      </main>

      {/* Footer */}
      <LandingFooter />

      {/* Theme Customizer */}
      <LandingThemeCustomizerTrigger onClick={() => setThemeCustomizerOpen(true)} />
      <LandingThemeCustomizer open={themeCustomizerOpen} onOpenChange={setThemeCustomizerOpen} />
    </div>
  )
}
