import { Hero } from "@/components/sections/Hero";
import { CredibilityStats } from "@/components/sections/CredibilityStats";
import { WhyIACourtier } from "@/components/sections/WhyIACourtier";
import { AssistantsShowcase } from "@/components/sections/AssistantsShowcase";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { ProductShowcase } from "@/components/sections/ProductShowcase";
import { GuideGratuitSection } from "@/components/sections/GuideGratuitSection";
import { Comparison } from "@/components/sections/Comparison";
import { Testimonials } from "@/components/sections/Testimonials";
import { AboutPreview } from "@/components/sections/AboutPreview";
import { FAQ } from "@/components/sections/FAQ";
import { CTA } from "@/components/sections/CTA";

export default function HomePage() {
  return (
    <>
      <Hero />
      <CredibilityStats />
      <WhyIACourtier />
      <AssistantsShowcase limit={6} />
      <HowItWorks />
      <ProductShowcase />
      <GuideGratuitSection source="homepage" />
      <Comparison />
      <Testimonials />
      <AboutPreview />
      <FAQ />
      <CTA />
    </>
  );
}
