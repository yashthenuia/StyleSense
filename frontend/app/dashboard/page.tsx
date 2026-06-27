"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Shirt, MessageCircle, Plus } from "lucide-react";
import type { TryOnResult } from "@/types";
import { HeroVideo } from "@/components/dashboard/HeroVideo";
import { useAppStore } from "@/store/app";
import { useAuth } from "@/components/AuthProvider";
import { apiGet } from "@/lib/api";
import type { WardrobeItem } from "@/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const { avatarSelfieUrl } = useAppStore();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [recent, setRecent] = useState<TryOnResult[]>([]);

  useEffect(() => {
    if (!user) return;
    apiGet<WardrobeItem[]>(`/api/wardrobe`).then(setItems).catch(() => {});
    apiGet<TryOnResult[]>(`/api/tryon/recent`).then(r => setRecent(r.slice(0, 10))).catch(() => {});
  }, [user]);

  const isNewUser = !avatarSelfieUrl && items.length === 0;

  const archive = Object.values(
    items.reduce<Record<string, { category: string; count: number; preview: string }>>((acc, it) => {
      const key = it.category;
      if (!acc[key]) acc[key] = { category: key, count: 0, preview: it.image_url };
      acc[key].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.count - a.count);

  return (
    <div className="h-full overflow-y-auto md:overflow-visible grid grid-cols-1 md:grid-cols-12 gap-6 pb-4 md:pb-0">
      {/* Left column: wardrobe categories — limited count, fits in screen height */}
      <div className="md:col-span-4 flex flex-col gap-3 min-h-0 overflow-y-auto order-2 md:order-1">
        <h2 className="font-display text-3xl shrink-0">Wardrobe</h2>
        {archive.length === 0 ? (
          <Link
            href="/wardrobe"
            className="surface surface-hover block p-6 text-center text-sm"
            style={{ color: "var(--text-muted)", textDecoration: "none" }}
          >
            <Shirt size={24} className="mx-auto mb-2" style={{ color: "var(--text-dim)" }} />
            Add items to build your archive.
          </Link>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {archive.map((a, i) => (
              <motion.div
                key={a.category}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
              >
                <Link
                  href={`/wardrobe?category=${a.category}`}
                  className="surface surface-hover block overflow-hidden"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.preview} alt={a.category} className="w-full aspect-[4/5] object-cover" />
                  <div className="px-3 py-2">
                    <div className="text-sm capitalize">{a.category}</div>
                    <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                      {a.count} item{a.count === 1 ? "" : "s"}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Right column: video (top) + try-ons or action cards (bottom) — L-shape */}
      <div className="md:col-span-8 flex flex-col min-h-0 gap-4 order-1 md:order-2">
        <div className="flex items-center gap-2 shrink-0">
          <h1 className="font-display text-4xl leading-tight">Your Digital Runway Awaits</h1>
          <Sparkles size={22} style={{ color: "var(--text-dim)" }} />
        </div>

        {/* Aria / user ramp video — 220px compact strip */}
        <div className="relative overflow-hidden shrink-0" style={{ height: 220 }}>
          <HeroVideo />
        </div>

        {/* Try-ons (horizontal scroll) or action cards — fills remaining space */}
        {recent.length > 0 ? (
          <div className="flex-1 min-h-0 flex flex-col">
            <h3
              className="text-xs font-semibold uppercase tracking-widest mb-3 shrink-0"
              style={{ color: "var(--text-dim)" }}
            >
              Recent Try-Ons
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recent.map((r) => (
                <Link
                  key={r.id}
                  href="/studio"
                  className="surface overflow-hidden flex-shrink-0"
                  style={{ width: 200, padding: 0, textDecoration: "none" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.event_scene_url || r.result_image_url}
                    alt="Try-on"
                    style={{ width: 200, aspectRatio: "3/4", objectFit: "cover", display: "block" }}
                  />
                </Link>
              ))}
            </div>
          </div>
        ) : isNewUser ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
            <ActionCard
              href="/wardrobe"
              icon={<Plus size={20} />}
              title="Add to closet"
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
        ) : null}
      </div>
    </div>
  );
}

function ActionCard({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="surface surface-hover px-6 py-5 block" style={{ textDecoration: "none", color: "inherit" }}>
      <div
        className="w-10 h-10 rounded-[10px] flex items-center justify-center mb-3"
        style={{ background: "var(--surface2)", color: "var(--ink)" }}
      >
        {icon}
      </div>
      <div className="font-display text-2xl mb-1">{title}</div>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{desc}</p>
    </Link>
  );
}
