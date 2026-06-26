import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

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

const FEATURES: {
  n: string;
  h2: [string, string];
  body: string;
  img: string;
  alt: string;
  imageRight: boolean;
}[] = [
  {
    n: "01",
    h2: ["See yourself", "in anything."],
    body: "Upload a photo. Add any garment. AI places it on you in seconds.",
    img: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?q=85&w=1000&fit=crop",
    alt: "Fashion model in editorial clothing for virtual try-on",
    imageRight: true,
  },
  {
    n: "02",
    h2: ["Any outfit.", "Any world."],
    body: "Place yourself on a runway, a rooftop, a beach. One prompt, any scene.",
    img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=85&w=1000&fit=crop",
    alt: "Model in urban editorial scene setting",
    imageRight: false,
  },
  {
    n: "03",
    h2: ["A stylist that", "knows your closet."],
    body: "Chat with an AI that has read every piece you own and knows what works.",
    img: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=85&w=1000&fit=crop",
    alt: "Editorial fashion photography for AI stylist feature",
    imageRight: true,
  },
];

function FeatureSection({
  n,
  h2,
  body,
  img,
  alt,
  imageRight,
}: (typeof FEATURES)[number]) {
  const textBlock = (
    <div
      className="flex items-center justify-center"
      style={{ flex: "0 0 42%", padding: "4rem 5rem" }}
    >
      <div style={{ maxWidth: "28ch" }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.7rem",
            letterSpacing: "0.22em",
            color: "var(--text-dim)",
            marginBottom: "1.75rem",
          }}
        >
          {n}
        </div>
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(2rem, 3.5vw, 3.2rem)",
            lineHeight: 1.05,
            color: "var(--text)",
            marginBottom: "1.25rem",
            letterSpacing: "-0.01em",
          }}
        >
          {h2[0]}
          <br />
          {h2[1]}
        </h2>
        <p style={{ color: "var(--text-muted)", lineHeight: 1.7, fontSize: "0.95rem" }}>
          {body}
        </p>
      </div>
    </div>
  );

  const imageBlock = (
    <div
      className="relative overflow-hidden"
      style={{ flex: "0 0 58%", minHeight: "100vh" }}
    >
      <Image src={img} alt={alt} fill style={{ objectFit: "cover", objectPosition: "center top" }} />
    </div>
  );

  return (
    <section aria-label={h2.join(" ")} className="flex" style={{ minHeight: "100vh" }}>
      {imageRight ? (
        <>
          {textBlock}
          {imageBlock}
        </>
      ) : (
        <>
          {imageBlock}
          {textBlock}
        </>
      )}
    </section>
  );
}

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="landing-scroll">
        {/* Navbar */}
        <header
          className="sticky top-0 z-50 flex items-center justify-between"
          style={{
            padding: "1.25rem 2.5rem",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            background: "rgba(247, 241, 234, 0.88)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div
            className="font-display"
            style={{ fontSize: "1.5rem", color: "var(--text)", letterSpacing: "-0.01em" }}
          >
            StyleSense
          </div>
          <nav aria-label="Main navigation" className="flex items-center gap-5">
            <Link href="/login" className="landing-nav-link">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="btn-primary"
              style={{ padding: "0.55rem 1.35rem", fontSize: "0.88rem" }}
            >
              Get started
            </Link>
          </nav>
        </header>

        {/* Hero — split screen */}
        <section
          aria-label="Hero"
          className="flex"
          style={{ minHeight: "calc(100vh - 65px)" }}
        >
          {/* Left: editorial image */}
          <div
            className="relative overflow-hidden"
            style={{ flex: "0 0 58%" }}
          >
            <Image
              src="https://images.unsplash.com/photo-1509631179647-0177331693ae?q=85&w=1400&fit=crop"
              alt="Editorial fashion photography — StyleSense AI wardrobe"
              fill
              priority
              style={{ objectFit: "cover", objectPosition: "center top" }}
            />
          </div>

          {/* Right: headline + CTA */}
          <div
            className="flex items-center"
            style={{
              flex: "0 0 42%",
              padding: "4rem 5rem",
              background: "var(--bg)",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.65rem",
                  letterSpacing: "0.28em",
                  color: "var(--text-dim)",
                  marginBottom: "2.25rem",
                  textTransform: "uppercase",
                }}
              >
                AI Wardrobe · Virtual Try-On
              </div>

              <h1
                className="font-display"
                style={{
                  fontSize: "clamp(3rem, 5.5vw, 5rem)",
                  lineHeight: 1.0,
                  color: "var(--text)",
                  letterSpacing: "-0.025em",
                  marginBottom: "1.5rem",
                }}
              >
                Wear it
                <br />
                before
                <br />
                you buy it.
              </h1>

              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "1rem",
                  lineHeight: 1.7,
                  maxWidth: "26ch",
                  marginBottom: "2.5rem",
                }}
              >
                Upload a selfie. Try on any outfit.
                <br />
                See yourself anywhere.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", alignItems: "flex-start" }}>
                <Link
                  href="/signup"
                  className="btn-primary"
                  style={{ padding: "0.85rem 2rem", fontSize: "0.92rem" }}
                >
                  Get started — it&apos;s free
                </Link>
                <Link
                  href="/login"
                  className="landing-nav-link"
                  style={{ fontSize: "0.82rem" }}
                >
                  Already have an account? Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Feature sections */}
        {FEATURES.map((f) => (
          <FeatureSection key={f.n} {...f} />
        ))}

        {/* Closing CTA */}
        <section
          aria-label="Sign up call to action"
          style={{
            minHeight: "55vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "6rem 2rem",
            borderTop: "1px solid var(--border)",
          }}
        >
          <p
            className="font-display"
            style={{
              fontSize: "clamp(2.2rem, 4.5vw, 4rem)",
              color: "var(--text)",
              lineHeight: 1.05,
              fontStyle: "italic",
              marginBottom: "2.5rem",
              letterSpacing: "-0.01em",
            }}
          >
            Your wardrobe,
            <br />
            finally intelligent.
          </p>
          <Link
            href="/signup"
            className="btn-primary"
            style={{ padding: "0.9rem 2.5rem", fontSize: "0.95rem" }}
          >
            Get started — it&apos;s free
          </Link>
          <p
            style={{
              marginTop: "1.25rem",
              color: "var(--text-dim)",
              fontSize: "0.8rem",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.08em",
            }}
          >
            No credit card required.
          </p>
        </section>

        {/* Footer */}
        <footer
          style={{
            padding: "1.5rem 2.5rem",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            className="font-display"
            style={{ color: "var(--text-dim)", fontSize: "0.95rem" }}
          >
            StyleSense
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.7rem",
              color: "var(--text-dim)",
              letterSpacing: "0.06em",
            }}
          >
            © 2026
          </span>
        </footer>
      </div>
    </>
  );
}
