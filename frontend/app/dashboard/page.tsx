"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Shirt, MessageCircle, Plus } from "lucide-react";
import type { TryOnResult } from "@/types";
import { HeroVideo } from "@/components/dashboard/HeroVideo";
import { useAuth } from "@/components/AuthProvider";
import { apiGet } from "@/lib/api";
import type { WardrobeItem } from "@/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [recent, setRecent] = useState<TryOnResult[]>([]);

  useEffect(() => {
    if (!user) return;
    apiGet<WardrobeItem[]>(`/api/wardrobe`).then(setItems).catch(() => {});
    apiGet<TryOnResult[]>(`/api/tryon/recent`).then(r => setRecent(r.slice(0, 10))).catch(() => {});
  }, [user]);

  const archive = Object.values(
    items.reduce<Record<string, { category: string; count: number; preview: string }>>((acc, it) => {
      const key = it.category;
      if (!acc[key]) acc[key] = { category: key, count: 0, preview: it.image_url };
      acc[key].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.count - a.count);

  return (
    // Full-height scroll container on mobile; two-col grid on desktop
    <div className="h-full overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pb-6">

        {/* ── Right column (shows first on mobile via order) ── */}
        <div className="md:col-span-8 flex flex-col gap-4 order-1">
          <h1 className="font-display text-3xl md:text-4xl leading-tight">
            Your Digital Runway
          </h1>

          {/* Hero ramp video */}
          <HeroVideo />

          {/* Recent try-ons or action cards */}
          {recent.length > 0 ? (
            <div>
              <h3
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: "var(--text-dim)" }}
              >
                Recent Try-Ons
              </h3>
              {/* Mobile: horizontal scroll; desktop: 4-col grid */}
              <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:overflow-visible md:pb-0">
                {recent.map((r) => (
                  <Link
                    key={r.id}
                    href="/studio"
                    className="surface overflow-hidden flex-shrink-0 md:flex-shrink"
                    style={{ width: 140, padding: 0, textDecoration: "none" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.event_scene_url || r.result_image_url}
                      alt="Try-on"
                      style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }}
                    />
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ActionCard
                href="/wardrobe"
                icon={<Plus size={18} />}
                title="Add to closet"
                desc="Upload a photo or paste a product URL."
              />
              <ActionCard
                href="/studio"
                icon={<Sparkles size={18} />}
                title="Try on an outfit"
                desc="Compose a look and see it on your avatar."
              />
              <ActionCard
                href="/stylist"
                icon={<MessageCircle size={18} />}
                title="Ask your stylist"
                desc="Get item picks for your next event."
              />
            </div>
          )}
        </div>

        {/* ── Left column: wardrobe categories (shows second on mobile) ── */}
        <div className="md:col-span-4 flex flex-col gap-3 order-2">
          <h2 className="font-display text-2xl">Wardrobe</h2>
          {archive.length === 0 ? (
            <Link
              href="/wardrobe"
              className="surface surface-hover block p-6 text-center text-sm"
              style={{ color: "var(--text-muted)", textDecoration: "none" }}
            >
              <Shirt size={22} className="mx-auto mb-2" style={{ color: "var(--text-dim)" }} />
              Add items to build your archive.
            </Link>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {archive.map((a, i) => (
                <motion.div
                  key={a.category}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i }}
                >
                  <Link
                    href={`/wardrobe?category=${a.category}`}
                    className="surface surface-hover block overflow-hidden relative"
                    style={{ textDecoration: "none", color: "inherit", border: "1px solid var(--ink)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.preview} alt={a.category} className="w-full aspect-[4/5] object-cover" />
                    <div
                      className="absolute bottom-0 left-0 right-0 px-2 py-1 flex items-center justify-between"
                      style={{ background: "var(--ink)", color: "var(--bg)" }}
                    >
                      <span className="text-xs font-mono capitalize">{a.category}</span>
                      <span className="text-xs font-mono">{a.count}</span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function ActionCard({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="surface surface-hover px-5 py-4 block" style={{ textDecoration: "none", color: "inherit" }}>
      <div
        className="w-9 h-9 flex items-center justify-center mb-3"
        style={{ background: "var(--surface2)", color: "var(--ink)", border: "1px solid var(--border)" }}
      >
        {icon}
      </div>
      <div className="font-display text-xl mb-1">{title}</div>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{desc}</p>
    </Link>
  );
}
