"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Shirt, MessageCircle, ArrowRight, Plus, Eye } from "lucide-react";
import { HeroVideo } from "@/components/dashboard/HeroVideo";
import { useAppStore } from "@/store/app";
import { useAuth } from "@/components/AuthProvider";
import { apiGet } from "@/lib/api";
import { TryOnDetailModal } from "@/components/TryOnDetailModal";
import type { WardrobeItem, TryOnResult } from "@/types";

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const { avatarSelfieUrl } = useAppStore();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [recent, setRecent] = useState<TryOnResult[]>([]);
  const [openTryOn, setOpenTryOn] = useState<TryOnResult | null>(null);

  useEffect(() => {
    if (!user) return;
    apiGet<WardrobeItem[]>(`/api/wardrobe`).then(setItems).catch(() => {});
    apiGet<TryOnResult[]>(`/api/tryon/recent?limit=6`).then(setRecent).catch(() => {});
  }, [user]);

  const stats = [
    { label: "Wardrobe items", value: items.length },
    { label: "Try-ons created", value: recent.length },
    { label: "Avatar status", value: avatarSelfieUrl ? "Ready" : "Not set" },
  ];

  return (
    <div>
      {/* Top row: landscape ramp video on the left, welcome + stats on the right */}
      <div className="grid grid-cols-12 gap-6 mb-10">
        <div className="col-span-7">
          <HeroVideo />
        </div>
        <div className="col-span-5 flex flex-col">
          <div className="mb-5">
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--gold)", letterSpacing: "0.15em" }}>
              {`Welcome${profile?.full_name ? `, ${profile.full_name}` : ""}`}
            </div>
            <h1 className="font-display text-4xl leading-tight mb-3">Your Digital Runway Awaits</h1>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              Compose. Try on. Slay. AI that actually gets your style.
            </p>
            <Link href="/studio" className="btn-primary inline-flex">
              <Sparkles size={16} /> Open Studio
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-auto">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                className="surface px-3 py-3"
              >
                <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>
                  {s.label}
                </div>
                <div className="font-display text-2xl mt-1">{s.value}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-10">
        <ActionCard
          href="/wardrobe"
          icon={<Plus size={20} />}
          title="Add to wardrobe"
          desc="Upload a photo, paste an Amazon URL, or scan a product link."
        />
        <ActionCard
          href="/studio"
          icon={<Sparkles size={20} />}
          title="Try on an outfit"
          desc="Compose a look from your wardrobe and see it on your avatar."
        />
        <ActionCard
          href="/stylist"
          icon={<MessageCircle size={20} />}
          title="Ask your stylist"
          desc="What should you wear to your next event? Get specific item picks."
        />
      </div>

      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider" style={{ color: "var(--gold)" }}>
            Recent
          </div>
          <h2 className="font-display text-3xl mt-1">Latest try-ons</h2>
        </div>
        <Link href="/studio" className="text-sm flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
          Open studio <ArrowRight size={14} />
        </Link>
      </div>

      {recent.length === 0 ? (
        <div className="surface p-12 text-center" style={{ color: "var(--text-muted)" }}>
          <Shirt size={32} className="mx-auto mb-3" style={{ color: "var(--text-dim)" }} />
          <p>No try-ons yet. Head to the Studio to create your first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {recent.map((r) => (
            <button
              key={r.id}
              onClick={() => setOpenTryOn(r)}
              className="surface surface-hover overflow-hidden group relative text-left"
              style={{ padding: 0, cursor: "pointer", color: "inherit" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.event_scene_url || r.result_image_url} alt="Try-on" className="w-full aspect-[3/4] object-cover" />
              {/* Hover overlay - same pattern as Outfits page */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition flex items-end justify-center pb-6"
                style={{
                  background: "linear-gradient(to top, rgba(8,8,13,0.8) 0%, rgba(8,8,13,0) 50%)",
                  pointerEvents: "none",
                }}
              >
                <div
                  className="flex items-center gap-2 px-4 py-2 rounded-full"
                  style={{ background: "var(--gold)", color: "var(--on-gold)", fontWeight: 600, fontSize: "0.8rem" }}
                >
                  <Eye size={14} /> View details
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                  {new Date(r.created_at).toLocaleString()}
                </div>
                {r.event_context && (
                  <div className="text-xs mt-1 truncate" style={{ color: "var(--gold)" }}>
                    ✦ {r.event_context}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {openTryOn && (
          <TryOnDetailModal result={openTryOn} onClose={() => setOpenTryOn(null)} />
        )}
      </AnimatePresence>

      {!avatarSelfieUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="surface p-6 mt-10"
          style={{ borderColor: "var(--border-gold)", background: "var(--gold-dim)" }}
        >
          <div className="text-xs uppercase tracking-wider" style={{ color: "var(--gold)" }}>
            Next step
          </div>
          <h3 className="font-display text-2xl mt-1">Add your selfie</h3>
          <p className="mt-2 max-w-xl" style={{ color: "var(--text)" }}>
            Upload one selfie so the Studio can put you in any outfit. Aria, your stylist, is already standing by.
          </p>
          <Link href="/onboarding" className="btn-primary mt-4 inline-flex">
            Add a selfie <ArrowRight size={14} />
          </Link>
        </motion.div>
      )}
    </div>
  );
}

function ActionCard({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="surface surface-hover px-6 py-5 block" style={{ textDecoration: "none", color: "inherit" }}>
      <div
        className="w-10 h-10 rounded-[10px] flex items-center justify-center mb-3"
        style={{ background: "var(--gold-dim)", color: "var(--gold)" }}
      >
        {icon}
      </div>
      <div className="font-display text-2xl mb-1">{title}</div>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{desc}</p>
    </Link>
  );
}
