"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Shirt, MessageCircle, ArrowRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/store/app";
import { useAuth } from "@/components/AuthProvider";
import { apiGet } from "@/lib/api";
import type { WardrobeItem, TryOnResult } from "@/types";

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const { avatarSelfieUrl, avatarCharacterId } = useAppStore();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [recent, setRecent] = useState<TryOnResult[]>([]);

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
      <PageHeader
        eyebrow={`Welcome${profile?.full_name ? `, ${profile.full_name}` : ""}`}
        title="Your editorial closet."
        subtitle="Try anything on your own avatar in seconds. Save outfits. Ask your stylist."
        action={
          <Link href="/studio" className="btn-primary">
            <Sparkles size={16} /> Open Studio
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-10">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="surface px-6 py-5"
          >
            <div className="text-xs uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>
              {s.label}
            </div>
            <div className="font-display text-4xl mt-2">{s.value}</div>
          </motion.div>
        ))}
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
            <div key={r.id} className="surface surface-hover overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.result_image_url} alt="Try-on" className="w-full aspect-[3/4] object-cover" />
              <div className="px-4 py-3">
                <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!avatarCharacterId && (
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
          <h3 className="font-display text-2xl mt-1">Set up your AI avatar</h3>
          <p className="mt-2 max-w-xl" style={{ color: "var(--text)" }}>
            Upload one selfie to unlock the talking avatar stylist and personalized try-ons.
          </p>
          <Link href="/onboarding" className="btn-primary mt-4 inline-flex">
            Start avatar setup <ArrowRight size={14} />
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
