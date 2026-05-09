"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  "Analyzing your avatar...",
  "Detecting garment shape and texture...",
  "Compositing outfit on body...",
  "Applying studio lighting...",
  "Finishing details...",
];

export function GeneratingState({ avatarUrl, itemUrls }: { avatarUrl: string | null; itemUrls: string[] }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => setSecs((s) => s + 1), 1000);
    const stepTick = setInterval(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), 6000);
    return () => { clearInterval(tick); clearInterval(stepTick); };
  }, []);

  return (
    <div className="surface p-8 flex flex-col items-center text-center" style={{ minHeight: 480 }}>
      {/* Visual: selfie + items orbiting around a sparkle */}
      <div className="flex items-center gap-6 mb-6">
        {avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="You" className="rounded-full object-cover"
               style={{ width: 80, height: 80, border: "1px solid var(--border-gold)" }} />
        )}
        <motion.span
          className="font-display text-3xl"
          style={{ color: "var(--gold)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
          ✦
        </motion.span>
        <div className="flex gap-2">
          {itemUrls.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={u} alt={`Item ${i + 1}`} className="rounded-md object-cover"
                 style={{ width: 80, height: 80, border: "1px solid var(--border)" }} />
          ))}
        </div>
      </div>

      <div className="font-display text-2xl mb-2">Composing your look</div>
      <AnimatePresence mode="wait">
        <motion.div
          key={stepIdx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="text-sm mb-6"
          style={{ color: "var(--text-muted)" }}
        >
          {STEPS[stepIdx]}
        </motion.div>
      </AnimatePresence>

      {/* Progress bar */}
      <div className="w-full max-w-md mb-3">
        <div style={{ height: 4, background: "var(--surface3)", borderRadius: 999, overflow: "hidden" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "85%" }}
            transition={{ duration: 28, ease: [0.6, 0.05, 0.4, 0.9] }}
            style={{ height: "100%", background: "var(--gold)", boxShadow: "0 0 12px var(--gold-glow)" }}
          />
        </div>
        <div className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>
          ~{Math.max(0, 30 - secs)}s remaining · {secs}s elapsed
        </div>
      </div>

      {/* Step list */}
      <div className="w-full max-w-md text-left mt-4">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 text-xs py-1" style={{ color: i <= stepIdx ? "var(--gold)" : "var(--text-dim)" }}>
            <span style={{
              width: 12, textAlign: "center",
              color: i < stepIdx ? "var(--green)" : i === stepIdx ? "var(--gold)" : "var(--text-dim)",
            }}>
              {i < stepIdx ? "✓" : i === stepIdx ? "⟳" : "·"}
            </span>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
