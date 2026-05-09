"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import {
  Sparkles, MapPin, Film, Loader2, Save, ArrowLeftRight, Shirt, Plus, AlertCircle, Share2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { GeneratingState } from "@/components/studio/GeneratingState";
import { ShareToFriendModal } from "@/components/ShareToFriendModal";
import { useAppStore } from "@/store/app";
import { useAuth } from "@/components/AuthProvider";
import { apiGet, apiPost } from "@/lib/api";
import { toast } from "@/components/ui/Toast";
import type { WardrobeItem } from "@/types";

const EVENT_PRESETS = [
  "beach wedding, golden hour",
  "rooftop cocktail party at night",
  "casual brunch in a sunny garden",
  "formal job interview, modern office lobby",
  "evening art gallery opening",
  "city street, autumn leaves",
];

export default function StudioPage() {
  const { user } = useAuth();
  const { avatarSelfieUrl, selectedItemIds, toggleSelected, clearSelected } = useAppStore();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  // Event scene
  const [eventInput, setEventInput] = useState("");
  const [eventLoading, setEventLoading] = useState(false);
  const [eventUrl, setEventUrl] = useState<string | null>(null);

  // Animate
  const [animating, setAnimating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Share
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    if (!user) return;
    apiGet<WardrobeItem[]>(`/api/wardrobe`).then(setItems).catch(() => {});
  }, [user]);

  const selectedItems = items.filter((i) => selectedItemIds.includes(i.id));

  function reset() {
    setResultUrl(null);
    setResultId(null);
    setEventUrl(null);
    setVideoUrl(null);
    setShowCompare(false);
  }

  async function generate() {
    if (!avatarSelfieUrl) { toast.error("Upload your selfie first (Avatar Setup)."); return; }
    if (selectedItems.length === 0) { toast.error("Select at least one item from your wardrobe."); return; }
    setGenerating(true);
    reset();
    try {
      let res: { result_image_url: string; result_id: string };
      if (selectedItems.length === 1) {
        const item = selectedItems[0];
        res = await apiPost("/api/tryon/generate", {
          wardrobe_item_id: item.id,
          item_image_url: item.image_url,
          avatar_selfie_url: avatarSelfieUrl,
          item_name: item.name,
          item_category: item.category,
        });
      } else {
        res = await apiPost("/api/tryon/generate-multi", {
          avatar_selfie_url: avatarSelfieUrl,
          items: selectedItems.map((i) => ({ image_url: i.image_url, name: i.name, category: i.category })),
        });
      }
      setResultUrl(res.result_image_url);
      setResultId(res.result_id);
      toast.success("Try-on ready!");
    } catch (e) {
      toast.error(`Generation failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setGenerating(false);
    }
  }

  async function generateEventScene(context: string) {
    if (!resultUrl) return;
    setEventLoading(true);
    setEventUrl(null);
    try {
      const res = await apiPost<{ event_image_url: string }>("/api/tryon/event-scene", {
        tryon_result_url: resultUrl,
        event_context: context,
        tryon_result_id: resultId,
      });
      setEventUrl(res.event_image_url);
      toast.success(`Placed in: ${context}`);
    } catch (e) {
      toast.error(`Event scene failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setEventLoading(false);
    }
  }

  async function animate() {
    const sourceUrl = eventUrl || resultUrl;
    if (!sourceUrl) return;
    setAnimating(true);
    setVideoUrl(null);
    try {
      const res = await apiPost<{ video_url: string }>("/api/tryon/animate", {
        image_url: sourceUrl,
        tryon_result_id: resultId,
      });
      setVideoUrl(res.video_url);
      toast.success("Video ready!");
    } catch (e) {
      toast.error(`Animation failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setAnimating(false);
    }
  }

  async function saveOutfit() {
    const name = prompt("Name this outfit:");
    if (!name) return;
    try {
      await apiPost("/api/outfits/save", {
        name,
        item_ids: selectedItemIds,
        preview_image_url: resultUrl,
      });
      toast.success("Outfit saved.");
    } catch (e) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Studio"
        title="Compose. Try on. Animate."
        subtitle="Pick 1 or 2 items from your wardrobe, then generate a try-on on your avatar."
      />

      {!avatarSelfieUrl && (
        <div className="surface p-5 mb-6 flex items-start gap-3" style={{ borderColor: "var(--border-gold)", background: "var(--gold-dim)" }}>
          <AlertCircle size={18} style={{ color: "var(--gold)", flexShrink: 0, marginTop: 2 }} />
          <div className="text-sm">
            <strong>Avatar not set.</strong> Upload your selfie in <Link href="/onboarding" style={{ color: "var(--gold)", textDecoration: "underline" }}>Avatar Setup</Link> to enable try-ons.
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="surface p-5 mb-6 flex items-start gap-3">
          <Shirt size={18} style={{ color: "var(--text-dim)", flexShrink: 0, marginTop: 2 }} />
          <div className="text-sm">
            <strong>Empty wardrobe.</strong> Add items in <Link href="/wardrobe" style={{ color: "var(--gold)", textDecoration: "underline" }}>Wardrobe</Link> first.
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* LEFT: item picker */}
        <div className="col-span-3">
          <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            Your wardrobe
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-[600px] overflow-auto pr-1">
            {items.map((it) => {
              const sel = selectedItemIds.includes(it.id);
              return (
                <button
                  key={it.id}
                  onClick={() => toggleSelected(it.id)}
                  className="surface overflow-hidden relative"
                  style={{
                    padding: 0, cursor: "pointer",
                    borderColor: sel ? "var(--gold)" : "var(--border)",
                  }}
                  title={it.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.image_url} alt={it.name} className="w-full aspect-square object-cover" />
                  {sel && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                         style={{ background: "var(--gold)", color: "var(--bg)" }}>
                      {selectedItemIds.indexOf(it.id) + 1}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* CENTER: canvas */}
        <div className="col-span-6">
          {generating ? (
            <GeneratingState avatarUrl={avatarSelfieUrl} itemUrls={selectedItems.map((i) => i.image_url)} />
          ) : resultUrl ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="surface overflow-hidden"
            >
              {videoUrl ? (
                <video src={videoUrl} controls autoPlay loop className="w-full" style={{ aspectRatio: "3/4" }} />
              ) : showCompare && avatarSelfieUrl ? (
                <ReactCompareSlider
                  itemOne={<ReactCompareSliderImage src={avatarSelfieUrl} alt="Before" />}
                  itemTwo={<ReactCompareSliderImage src={resultUrl} alt="After" />}
                  style={{ aspectRatio: "3/4" }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={eventUrl || resultUrl} alt="Try-on result" className="w-full" style={{ aspectRatio: "3/4", objectFit: "cover" }} />
              )}
            </motion.div>
          ) : (
            <div className="surface flex items-center justify-center" style={{ minHeight: 480, borderStyle: "dashed", color: "var(--text-dim)" }}>
              <div className="text-center">
                <Sparkles size={32} className="mx-auto mb-3" />
                <div>Pick items and click Generate.</div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: controls */}
        <div className="col-span-3 flex flex-col gap-3">
          <div className="surface p-5">
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
              Selected ({selectedItems.length}/2)
            </div>
            {selectedItems.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>None yet.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {selectedItems.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 text-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.image_url} alt={it.name} style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 6 }} />
                    <span className="truncate flex-1">{it.name}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              className="btn-primary w-full"
              onClick={generate}
              disabled={!avatarSelfieUrl || selectedItems.length === 0 || generating}
            >
              {generating ? <><Loader2 size={16} className="spin" /> Generating</> : <><Sparkles size={16} /> Generate</>}
            </button>
            {selectedItems.length > 0 && !generating && (
              <button className="btn-secondary w-full mt-2" onClick={() => { clearSelected(); reset(); }} style={{ padding: "0.5rem 1rem" }}>
                Clear & reset
              </button>
            )}
          </div>

          {resultUrl && !videoUrl && (
            <>
              <div className="surface p-5">
                <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Compare</div>
                <button
                  className="btn-secondary w-full"
                  onClick={() => setShowCompare((v) => !v)}
                  disabled={!avatarSelfieUrl}
                >
                  <ArrowLeftRight size={14} /> {showCompare ? "Hide before/after" : "Before / After"}
                </button>
              </div>

              <div className="surface p-5">
                <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                  Place in event
                </div>
                <input
                  className="input mb-2"
                  placeholder="e.g. beach wedding"
                  value={eventInput}
                  onChange={(e) => setEventInput(e.target.value)}
                />
                <button
                  className="btn-secondary w-full"
                  onClick={() => generateEventScene(eventInput)}
                  disabled={!eventInput.trim() || eventLoading}
                >
                  {eventLoading ? <Loader2 size={14} className="spin" /> : <MapPin size={14} />}
                  {eventLoading ? "Placing..." : "Place in scene"}
                </button>
                <div className="flex flex-wrap gap-1 mt-3">
                  {EVENT_PRESETS.map((p) => (
                    <button
                      key={p}
                      className="chip"
                      onClick={() => { setEventInput(p); generateEventScene(p); }}
                      disabled={eventLoading}
                      style={{ fontSize: "0.7rem", padding: "0.2rem 0.6rem" }}
                    >
                      {p.split(",")[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="surface p-5">
                <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Animate</div>
                <button
                  className="btn-primary w-full"
                  onClick={animate}
                  disabled={animating}
                >
                  {animating ? <><Loader2 size={14} className="spin" /> Rendering (~60s)</> : <><Film size={14} /> Animate (5s video)</>}
                </button>
                <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>
                  Uses gen4.5 · ~60 credits
                </p>
              </div>

              <div className="surface p-5 space-y-2">
                <button className="btn-secondary w-full" onClick={saveOutfit}>
                  <Save size={14} /> Save outfit
                </button>
                <button className="btn-secondary w-full" onClick={() => setShowShare(true)} disabled={!resultId}>
                  <Share2 size={14} /> Share with friend
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showShare && resultId && (
        <ShareToFriendModal
          target={{
            tryon_id: resultId,
            preview_image_url: eventUrl || resultUrl || undefined,
            label: selectedItems.map((i) => i.name).join(" + ") || "Try-on",
          }}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
