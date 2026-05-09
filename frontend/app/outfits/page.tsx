"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Calendar, Share2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/components/AuthProvider";
import { apiGet } from "@/lib/api";
import { ShareToFriendModal } from "@/components/ShareToFriendModal";
import type { Outfit } from "@/types";

export default function OutfitsPage() {
  const { user } = useAuth();
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareTarget, setShareTarget] = useState<Outfit | null>(null);

  useEffect(() => {
    if (!user) return;
    apiGet<Outfit[]>(`/api/outfits`)
      .then(setOutfits)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div>
      <PageHeader
        eyebrow="Saved looks"
        title="Outfits."
        subtitle="Your saved combinations from the Studio. Click any to revisit."
      />

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="surface aspect-[3/4] shimmer" />
          ))}
        </div>
      ) : outfits.length === 0 ? (
        <div className="surface p-12 text-center" style={{ color: "var(--text-muted)" }}>
          <Layers size={32} className="mx-auto mb-3" style={{ color: "var(--text-dim)" }} />
          <p>No saved outfits yet. Generate a try-on in Studio and click &quot;Save outfit&quot;.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {outfits.map((o, i) => (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="surface surface-hover overflow-hidden group relative"
            >
              {o.preview_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.preview_image_url} alt={o.name} className="w-full aspect-[3/4] object-cover" />
              ) : (
                <div className="aspect-[3/4] flex items-center justify-center" style={{ background: "var(--surface2)" }}>
                  <Layers size={32} style={{ color: "var(--text-dim)" }} />
                </div>
              )}
              <button
                onClick={() => setShareTarget(o)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition rounded-full p-2"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer" }}
                aria-label="Share with friend"
                title="Share with friend"
              >
                <Share2 size={14} />
              </button>
              <div className="px-4 py-3">
                <div className="font-display text-xl">{o.name}</div>
                <div className="flex items-center gap-2 text-xs mt-1" style={{ color: "var(--text-dim)" }}>
                  <span>{o.item_ids.length} items</span>
                  {o.occasion && <><span>·</span><span>{o.occasion}</span></>}
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                    <Calendar size={10} /> {new Date(o.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
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
      </AnimatePresence>
    </div>
  );
}
