import type { Metadata } from "next";
import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import MetricsRow from "@/components/landing/MetricsRow";
import ProductDemo from "@/components/landing/ProductDemo";
import HowItWorks from "@/components/landing/HowItWorks";
import FeaturesTab from "@/components/landing/FeaturesTab";
import ToolsGrid from "@/components/landing/ToolsGrid";
import FAQAccordion from "@/components/landing/FAQAccordion";
import LandingFooter from "@/components/landing/LandingFooter";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "StyleSense — AI Wardrobe & Virtual Try-On",
  description:
    "StyleSense is your AI-powered wardrobe and virtual try-on studio. Upload a selfie, add clothes, see yourself in any outfit, place yourself in any scene, and chat with a stylist that knows your closet.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "StyleSense — AI Wardrobe & Virtual Try-On",
    description:
      "Upload a selfie, try on outfits with AI, place yourself in any scene, and chat with a stylist that knows your closet.",
    type: "website",
    siteName: "StyleSense",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "StyleSense — AI Wardrobe & Virtual Try-On",
    description:
      "Upload a selfie, try on outfits with AI, place yourself in any scene, and chat with a stylist that knows your closet.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "StyleSense",
  applicationCategory: "LifestyleApplication",
  description: "AI-powered wardrobe, virtual try-on, and personal stylist.",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="landing-scroll">
        <LandingNav />
        <HeroSection />
        <MetricsRow />
        <div id="product-demo">
          <ProductDemo />
        </div>
        <HowItWorks />
        <FeaturesTab />
        <ToolsGrid />
        <FAQAccordion />
        <LandingFooter />
      </main>
    </>
  );
}
