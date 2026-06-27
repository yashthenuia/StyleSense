"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Shirt, MessageCircle, Plus } from "lucide-react";
import type { TryOnResult } from "@/types";
import { HeroVideo } from "@/components/dashboard/HeroVideo";
import { useAuth } from "@/components/AuthProvider";
import { apiGet } from "@/lib/api";
import type { WardrobeItem } from "@/types";

interface ArchiveEntry {
  category: string;
  count: number;
  previews: string[];
}

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
    items.reduce<Record<string, ArchiveEntry>>((acc, it) => {
      const key = it.category;
      if (!acc[key]) acc[key] = { category: key, count: 0, previews: [] };
      acc[key].count += 1;
      if (acc[key].previews.length < 6) acc[key].previews.push(it.image_url);
      return acc;
    }, {})
  ).sort((a, b) => b.count - a.count);

  return (
    <div className="h-full overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pb-6">

        {/* ── Right column (shows first on mobile via order) ── */}
        <div className="md:col-span-8 flex flex-col gap-4 order-1">
          <h1 className="font-display text-3xl md:text-4xl leading-tight">
            Your Digital Runway
          </h1>

          {/* Hero ramp video */}
          <HeroVideo />

          {/* Recent try-ons */}
          {recent.length > 0 && (
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
          )}

          {/* Shortcut cards — always visible */}
          <div className={`grid gap-3 ${recent.length > 0 ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3"}`}>
            <ActionCard
              href="/wardrobe"
              icon={<Plus size={18} />}
              title="Add to closet"
              desc={recent.length > 0 ? undefined : "Upload a photo or paste a product URL."}
            />
            <ActionCard
              href="/studio"
              icon={<Sparkles size={18} />}
              title="Try on an outfit"
              desc={recent.length > 0 ? undefined : "Compose a look and see it on your avatar."}
            />
            <ActionCard
              href="/stylist"
              icon={<MessageCircle size={18} />}
              title="Ask your stylist"
              desc={recent.length > 0 ? undefined : "Get item picks for your next event."}
            />
          </div>
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
                <CategoryCard key={a.category} entry={a} index={i} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function CategoryCard({ entry, index }: { entry: ArchiveEntry; index: number }) {
  const [imgIdx, setImgIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (entry.previews.length <= 1) return;
    // Stagger start so cards don't all flip simultaneously
    const delay = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setImgIdx(i => (i + 1) % entry.previews.length);
      }, 2400);
    }, index * 600);
    return () => {
      clearTimeout(delay);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [entry.previews.length, index]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index }}
    >
      <Link
        href={`/wardrobe?category=${entry.category}`}
        className="surface surface-hover block overflow-hidden relative"
        style={{ textDecoration: "none", color: "inherit", border: "1px solid var(--ink)" }}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={imgIdx}
            src={entry.previews[imgIdx]}
            alt={entry.category}
            className="w-full aspect-[4/5] object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            // eslint-disable-next-line @next/next/no-img-element
          />
        </AnimatePresence>
        <div
          className="absolute bottom-0 left-0 right-0 px-2 py-1 flex items-center justify-between"
          style={{ background: "var(--ink)", color: "var(--bg)" }}
        >
          <span className="text-xs font-mono capitalize">{entry.category}</span>
          <span className="text-xs font-mono">{entry.count}</span>
        </div>
      </Link>
    </motion.div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc?: string;
}) {
  return (
    <Link
      href={href}
      className="surface surface-hover block"
      style={{
        textDecoration: "none",
        color: "inherit",
        padding: desc ? "20px" : "12px 16px",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: desc ? 36 : 28,
            height: desc ? 36 : 28,
            background: "var(--surface2)",
            color: "var(--ink)",
            border: "1px solid var(--border)",
          }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className={`font-display leading-tight ${desc ? "text-xl" : "text-base"}`}>{title}</div>
          {desc && <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{desc}</p>}
        </div>
      </div>
    </Link>
  );
}
