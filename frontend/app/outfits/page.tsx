"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Calendar, Share2, Eye, Trash2, Sparkles } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { apiGet, apiDelete } from "@/lib/api";
import { ShareToFriendModal } from "@/components/ShareToFriendModal";
import { OutfitDetailModal } from "@/components/OutfitDetailModal";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { toast } from "@/components/ui/Toast";
import type { Outfit } from "@/types";

export default function OutfitsPage() {
  const { user } = useAuth();
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareTarget, setShareTarget] = useState<Outfit | null>(null);
  const [openOutfit, setOpenOutfit] = useState<Outfit | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Outfit | null>(null);
  const [deleting, setDeleting] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    apiGet<Outfit[]>(`/api/outfits`)
      .then(setOutfits)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  // Translate vertical wheel/trackpad scroll into horizontal movement on the rail
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    function onWheel(e: WheelEvent) {
      if (!rail) return;
      // Only hijack when there's no significant horizontal intent already
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
        e.preventDefault();
        rail.scrollLeft += e.deltaY * 0.55;
      }
    }
    rail.addEventListener("wheel", onWheel, { passive: false });
    return () => rail.removeEventListener("wheel", onWheel);
  }, [outfits.length]);

  async function performDelete(outfit: Outfit) {
    setDeleting(true);
    try {
      await apiDelete(`/api/outfits/${outfit.id}`);
      setOutfits((prev) => prev.filter((o) => o.id !== outfit.id));
      toast.success("Outfit deleted.");
    } catch (e) {
      toast.error(`Delete failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <PageHeader
        eyebrow="Outfits"
        title="Saved Looks"
        tutorialKey="outfits"
        subtitle="Every outfit you save from Studio lives here. Click any card to view items, re-share, or delete."
        action={
          <Link
            href="/studio"
            className="surface surface-hover px-4 py-2 text-sm flex items-center gap-2"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Sparkles size={14} style={{ color: "var(--gold)" }} />
            New look
          </Link>
        }
      />
      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-2 flex-1 min-h-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="surface flex-shrink-0 shimmer"
              style={{ width: "min(155px, 55vw)", aspectRatio: "3/4" }}
            />
          ))}
        </div>
      ) : outfits.length === 0 ? (
        <div className="surface p-12 text-center flex-1" style={{ color: "var(--text-muted)" }}>
          <Layers size={32} className="mx-auto mb-3" style={{ color: "var(--text-dim)" }} />
          <p>No saved outfits yet. Generate a try-on in Studio and click &quot;Save outfit&quot;.</p>
        </div>
      ) : (
        <div
          ref={railRef}
          className="flex gap-3 overflow-x-auto flex-1 min-h-0 pb-2"
          style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory" }}
        >
          <AnimatePresence>
            {outfits.map((o, i) => (
              <motion.div
                key={o.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.04 }}
                className="flex-shrink-0 flex flex-col"
                style={{ width: "min(155px, 55vw)", scrollSnapAlign: "start" }}
              >
                {/* Card */}
                <button
                  onClick={() => setOpenOutfit(o)}
                  className="overflow-hidden group relative text-left w-full"
                  style={{
                    padding: 0,
                    cursor: "pointer",
                    color: "inherit",
                    background: "var(--bg)",
                    border: "1.5px solid var(--border)",
                    flex: "none",
                  }}
                >
                  {o.preview_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={o.preview_image_url}
                      alt={o.name}
                      className="w-full object-cover"
                      style={{ aspectRatio: "3/4", display: "block" }}
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center w-full"
                      style={{ aspectRatio: "3/4", background: "var(--surface2)" }}
                    >
                      <Layers size={24} style={{ color: "var(--text-dim)" }} />
                    </div>
                  )}

                  {/* View overlay */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition flex items-end justify-center pb-4"
                    style={{
                      background: "linear-gradient(to top, rgba(8,8,13,0.75) 0%, transparent 55%)",
                      pointerEvents: "none",
                    }}
                  >
                    <div
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold"
                      style={{ background: "var(--ink)", color: "var(--parchment)" }}
                    >
                      <Eye size={12} /> View
                    </div>
                  </div>

                  {/* Share */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setShareTarget(o); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setShareTarget(o); } }}
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition p-1.5 cursor-pointer"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
                    aria-label="Share"
                    title="Share"
                  >
                    <Share2 size={11} />
                  </div>

                  {/* Delete */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setPendingDelete(o); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setPendingDelete(o); } }}
                    className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition p-1.5 cursor-pointer"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--red)" }}
                    aria-label="Delete"
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </div>
                </button>

                {/* Footer */}
                <div className="pt-1.5 px-0.5">
                  <div className="font-display text-sm leading-tight truncate">{o.name}</div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span
                      className="font-mono text-[9px] px-1.5 py-0.5"
                      style={{ background: "var(--ink)", color: "var(--bg)" }}
                    >
                      {o.item_ids.length} items
                    </span>
                    {o.occasion && (
                      <span
                        className="font-mono text-[9px] px-1.5 py-0.5 truncate"
                        style={{ background: "var(--surface3)", color: "var(--text-muted)" }}
                      >
                        {o.occasion}
                      </span>
                    )}
                    <span className="font-mono text-[9px] flex items-center gap-0.5" style={{ color: "var(--text-dim)" }}>
                      <Calendar size={7} />
                      {new Date(o.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {shareTarget && (
          <ShareToFriendModal
            target={{
              outfit_id: shareTarget.id,
              preview_image_url: shareTarget.preview_image_url || undefined,
              label: shareTarget.name,
            }}
            onClose={() => setShareTarget(null)}
          />
        )}
        {openOutfit && (
          <OutfitDetailModal
            outfit={openOutfit}
            onClose={() => setOpenOutfit(null)}
            onDeleted={(id) => setOutfits((prev) => prev.filter((o) => o.id !== id))}
          />
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete this outfit?"
        description={pendingDelete ? `"${pendingDelete.name}" will be removed. The wardrobe items stay.` : ""}
        confirmLabel={deleting ? "Deleting…" : "Delete outfit"}
        destructive
        onConfirm={async () => { if (pendingDelete) await performDelete(pendingDelete); }}
      />
    </div>
  );
}
