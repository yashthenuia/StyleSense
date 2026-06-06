import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "StyleSense — AI Wardrobe & Virtual Try-On",
  description:
    "Upload a selfie, add clothes, and see yourself wearing any outfit. Place yourself in any scene, animate the look as video, and chat with an AI stylist that knows your closet.",
  alternates: { canonical: "/" },
};

const STEPS = [
  { n: "01", t: "Upload a selfie", d: "One photo becomes your editorial model." },
  { n: "02", t: "Build a look", d: "Add clothes from a photo or any product URL." },
  { n: "03", t: "See it on you", d: "AI try-on, then place yourself in any scene." },
  { n: "04", t: "Ask your stylist", d: "A stylist that actually knows your closet." },
];

export default function LandingPage() {
  return (
    <main className="h-screen overflow-hidden flex flex-col">
      <header className="flex items-center justify-between px-8 py-6 shrink-0">
        <div className="font-display text-2xl" style={{ color: "var(--gold)" }}>
          StyleSense
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="btn-secondary">Sign in</Link>
          <Link href="/signup" className="btn-primary">Get started</Link>
        </div>
      </header>

      <section className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-6">
        <div className="text-xs uppercase tracking-[0.2em] mb-4" style={{ color: "var(--gold)" }}>
          AI wardrobe · virtual try-on · personal stylist
        </div>
        <h1
          className="font-display leading-[1.05] mb-5"
          style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)" }}
        >
          Your closet, reimagined<br />by AI.
        </h1>
        <p className="max-w-xl text-lg mb-8" style={{ color: "var(--text-muted)" }}>
          Upload a selfie, try on any outfit, place yourself in any scene, and animate the
          look as video — with a stylist that knows every piece you own.
        </p>
        <div className="flex items-center gap-3">
          <Link href="/signup" className="btn-primary" style={{ padding: "0.85rem 2rem" }}>
            Get started — it&apos;s free
          </Link>
          <Link href="/login" className="btn-secondary" style={{ padding: "0.85rem 2rem" }}>
            Sign in
          </Link>
        </div>
      </section>

      <section className="shrink-0 px-8 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {STEPS.map((s) => (
            <div key={s.n} className="surface p-5 text-left">
              <div className="font-display text-2xl mb-1" style={{ color: "var(--gold)" }}>
                {s.n}
              </div>
              <div className="font-medium mb-1">{s.t}</div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>{s.d}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
