"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import {
  Sparkles, MapPin, Film, Loader2, Save, ArrowLeftRight, Shirt, AlertCircle, Share2,
  User as UserIcon, RefreshCw, Upload,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { GeneratingState } from "@/components/studio/GeneratingState";
import { ShareToFriendModal } from "@/components/ShareToFriendModal";
import { PromptDialog } from "@/components/ui/Dialog";
import { useAppStore } from "@/store/app";
import { useAuth } from "@/components/AuthProvider";
import { useTasks, selectActiveTryOn } from "@/store/tasks";
import { apiGet, apiPost, apiUpload } from "@/lib/api";
import { toast } from "@/components/ui/Toast";
import { useSeenOnce } from "@/lib/useSeenOnce";
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
  const {
    avatarSelfieUrl,
    selectedItemIds,
    toggleSelected,
    clearSelected,
    stylizedAvatarUrl,
    stylizedAvatarStatus,
    setStylized,
  } = useAppStore();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [eventInput, setEventInput] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [quality, setQuality] = useState<"standard" | "pro">("pro");
  const [settingInput, setSettingInput] = useState("");
  // Face picker: which selfie URL to use as the avatar reference for try-on
  const [activeFaceUrl, setActiveFaceUrl] = useState<string | null>(null);
  const [allSelfies, setAllSelfies] = useState<string[]>([]);
  const [showFacePicker, setShowFacePicker] = useState(false);
  const [customFaceUrl, setCustomFaceUrl] = useState("");
  const [uploadingFace, setUploadingFace] = useState(false);
  const taskHintSeen = useSeenOnce("studio-task-hint");

  async function handleFaceUpload(file: File) {
    setUploadingFace(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiUpload<{ selfie_url: string; selfie_urls?: string[] }>(
        "/api/avatar/upload-selfie", fd
      );
      setActiveFaceUrl(res.selfie_url);
      if (res.selfie_urls) setAllSelfies(res.selfie_urls);
      setShowFacePicker(false);
      toast.success("Face uploaded — using it for the next try-on.");
    } catch (e) {
      toast.error(`Upload failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setUploadingFace(false);
    }
  }

  // Tasks live in a global store -> survive page navigation
  const startTryOn = useTasks((s) => s.startTryOn);
  const startEventScene = useTasks((s) => s.startEventScene);
  const startAnimate = useTasks((s) => s.startAnimate);
  const activeTryOn = useTasks(selectActiveTryOn);

  const generating = activeTryOn?.status === "running";
  const resultUrl = activeTryOn?.resultUrl;
  const resultId = activeTryOn?.resultId;
  const eventUrl = activeTryOn?.eventUrl;
  const videoUrl = activeTryOn?.videoUrl;

  // Other ongoing operations - simple booleans derived from store
  const eventLoading = useTasks((s) =>
    s.tasks.some((t) => t.kind === "event" && t.status === "running" && t.parentTryOnDbId === resultId)
  );
  const animating = useTasks((s) =>
    s.tasks.some((t) => t.kind === "animate" && t.status === "running")
  );

  useEffect(() => {
    if (!user) return;
    apiGet<WardrobeItem[]>(`/api/wardrobe`).then(setItems).catch(() => {});
    apiGet<{ selfie_urls: string[]; primary_url: string | null }>("/api/avatar/selfies")
      .then((d) => {
        setAllSelfies(d.selfie_urls || []);
        // Honor a "borrowed face" set by clicking "Use this face" on a chat-shared try-on
        const borrowed = typeof window !== "undefined" ? sessionStorage.getItem("studio_borrowed_face") : null;
        if (borrowed) {
          setActiveFaceUrl(borrowed);
          sessionStorage.removeItem("studio_borrowed_face");
          toast.success("Using a borrowed face for this session");
        } else {
          setActiveFaceUrl((cur) => cur || d.primary_url || avatarSelfieUrl);
        }
      })
      .catch(() => { setActiveFaceUrl(avatarSelfieUrl); });
  }, [user, avatarSelfieUrl]);

  // Fetch + poll stylized full-body avatar (auto-generated server-side on selfie upload).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function tick() {
      try {
        const d = await apiGet<{ url: string | null; status: string }>("/api/avatar/stylized");
        if (cancelled) return;
        setStylized(d.url, d.status as never);
        if (d.status === "generating") timer = setTimeout(tick, 4000);
      } catch {
        if (!cancelled) timer = setTimeout(tick, 8000);
      }
    }
    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [user, setStylized]);

  const selectedItems = items.filter((i) => selectedItemIds.includes(i.id));
  const effectiveSelfieUrl = activeFaceUrl || avatarSelfieUrl;

  function reset() {
    setShowCompare(false);
    setEventInput("");
    useTasks.getState().clearDone();
  }

  function generate() {
    if (!effectiveSelfieUrl) { toast.error("Upload your selfie first (Avatar Setup)."); return; }
    if (selectedItems.length === 0) { toast.error("Select at least one item from your wardrobe."); return; }
    setShowCompare(false);
    startTryOn({
      items: selectedItems,
      avatarSelfieUrl: effectiveSelfieUrl,
      setting: settingInput.trim() || undefined,
      quality,
    });
  }

  function generateEventScene(context: string) {
    if (!resultUrl || !activeTryOn) return;
    startEventScene({
      parentTaskId: activeTryOn.id,
      parentTryOnDbId: resultId,
      tryOnImageUrl: resultUrl,
      context,
    });
  }

  function animate() {
    const sourceUrl = eventUrl || resultUrl;
    if (!sourceUrl || !activeTryOn) return;
    startAnimate({
      sourceUrl,
      parentTaskId: activeTryOn.id,
      parentTryOnDbId: resultId,
    });
  }

  async function saveOutfit(name: string) {
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
    <div className="h-full flex flex-col">
      <div className="shrink-0">
        <PageHeader
          eyebrow="The atelier"
          tutorialKey="studio"
          subtitle="Mix pieces from your closet, see them on you instantly, then bring them to life."
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
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-4">
      <div className="grid grid-cols-12 gap-6">
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
                  style={{ padding: 0, cursor: "pointer", borderColor: sel ? "var(--gold)" : "var(--border)" }}
                  title={it.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.image_url} alt={it.name} className="w-full aspect-square object-cover" />
                  {sel && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                         style={{ background: "var(--gold)", color: "var(--on-gold)" }}>
                      {selectedItemIds.indexOf(it.id) + 1}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="col-span-6">
          {generating ? (
            <GeneratingState avatarUrl={avatarSelfieUrl} itemUrls={activeTryOn?.itemImageUrls || []} />
          ) : resultUrl ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="surface overflow-hidden"
            >
              {videoUrl ? (
                <video src={videoUrl} controls autoPlay loop className="w-full" style={{ aspectRatio: "3/4" }} />
              ) : showCompare && (stylizedAvatarUrl || avatarSelfieUrl) ? (
                <ReactCompareSlider
                  itemOne={<ReactCompareSliderImage src={stylizedAvatarUrl || avatarSelfieUrl!} alt="Before" />}
                  itemTwo={<ReactCompareSliderImage src={resultUrl} alt="After" />}
                  style={{ aspectRatio: "3/4" }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={eventUrl || resultUrl} alt="Try-on result" className="w-full" style={{ aspectRatio: "3/4", objectFit: "cover" }} />
              )}
            </motion.div>
          ) : (
            // Compact empty state - prefers the stylized full-body editorial-3D
            // avatar (auto-generated server-side from the primary selfie). Falls
            // back to the raw selfie until that finishes.
            <div className="flex justify-center">
              <div className="surface overflow-hidden relative"
                   style={{ width: "100%", maxWidth: 360, aspectRatio: "3/4" }}>
                {(stylizedAvatarUrl || effectiveSelfieUrl) ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={stylizedAvatarUrl || effectiveSelfieUrl!}
                      alt="Your starting point"
                      className="w-full h-full object-cover"
                      style={{ filter: stylizedAvatarUrl ? "brightness(0.7)" : "brightness(0.55) saturate(0.9)" }}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 px-4 text-center">
                      {stylizedAvatarStatus === "generating" && (
                        <div
                          className="flex items-center gap-2 px-3 py-1 rounded-full mb-2"
                          style={{ background: "var(--gold-dim)", border: "1px solid var(--border-gold)" }}
                        >
                          <Loader2 size={11} className="spin" style={{ color: "var(--gold)" }} />
                          <span style={{ color: "var(--gold)", fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                            Stylizing your avatar...
                          </span>
                        </div>
                      )}
                      <div
                        className="px-3 py-1 rounded-full mb-2"
                        style={{ background: "var(--gold-dim)", border: "1px solid var(--border-gold)", color: "var(--gold)", fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase" }}
                      >
                        {stylizedAvatarUrl ? "Your editorial avatar" : "Your starting point"}
                      </div>
                      <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                        Pick items + click Generate
                      </div>
                      {!taskHintSeen && (
                        <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                          You can navigate away — task keeps running
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-center px-4" style={{ color: "var(--text-dim)" }}>
                    <div>
                      <UserIcon size={28} className="mx-auto mb-2" />
                      <div className="text-sm">Upload a selfie in <Link href="/onboarding" style={{ color: "var(--gold)" }}>Avatar Setup</Link> to get started</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="col-span-3 flex flex-col gap-3">
          {/* FACE picker - shows current selfie + lets user switch */}
          <div className="surface p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Face on the model
              </div>
              <button
                onClick={() => setShowFacePicker((v) => !v)}
                className="text-xs flex items-center gap-1"
                style={{ background: "none", border: "none", color: "var(--gold)", cursor: "pointer" }}
              >
                <RefreshCw size={11} /> Switch
              </button>
            </div>
            <div className="flex items-center gap-3">
              {effectiveSelfieUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={effectiveSelfieUrl}
                  alt="Active face"
                  className="rounded-full object-cover"
                  style={{ width: 56, height: 56, border: "2px solid var(--border-gold)" }}
                />
              ) : (
                <div className="rounded-full flex items-center justify-center"
                     style={{ width: 56, height: 56, background: "var(--surface2)", border: "1px dashed var(--border)", color: "var(--text-dim)" }}>
                  <UserIcon size={20} />
                </div>
              )}
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {effectiveSelfieUrl
                  ? (activeFaceUrl && activeFaceUrl !== avatarSelfieUrl
                      ? "Using a different face"
                      : "Your primary selfie")
                  : "Upload a selfie in Avatar Setup"}
              </div>
            </div>

            {showFacePicker && (
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Your selfies
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {allSelfies.map((url) => (
                    <button
                      key={url}
                      onClick={() => { setActiveFaceUrl(url); setShowFacePicker(false); }}
                      className="surface overflow-hidden"
                      style={{
                        width: 50, height: 50, padding: 0, cursor: "pointer",
                        borderColor: url === effectiveSelfieUrl ? "var(--gold)" : undefined,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
                <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Upload a photo
                </div>
                <label
                  className="surface flex items-center justify-center cursor-pointer mb-3"
                  style={{ height: 60, borderStyle: "dashed", color: "var(--text-dim)", fontSize: "0.75rem" }}
                >
                  {uploadingFace ? (
                    <Loader2 size={16} className="spin" style={{ color: "var(--gold)" }} />
                  ) : (
                    <>
                      <Upload size={14} style={{ marginRight: 6 }} />
                      <span>Click to upload a face photo</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFaceUpload(e.target.files[0])}
                    disabled={uploadingFace}
                  />
                </label>

                <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Or paste an image URL
                </div>
                <div className="flex gap-1">
                  <input
                    className="input"
                    placeholder="https://..."
                    value={customFaceUrl}
                    onChange={(e) => setCustomFaceUrl(e.target.value)}
                    style={{ fontSize: "0.75rem" }}
                  />
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      if (!customFaceUrl.trim()) return;
                      setActiveFaceUrl(customFaceUrl.trim());
                      setShowFacePicker(false);
                      setCustomFaceUrl("");
                      toast.success("Custom face set for this session");
                    }}
                    style={{ padding: "0.4rem 0.7rem", fontSize: "0.75rem" }}
                  >
                    Use
                  </button>
                </div>
                {activeFaceUrl !== avatarSelfieUrl && (
                  <button
                    className="text-xs mt-3 underline"
                    onClick={() => { setActiveFaceUrl(avatarSelfieUrl); setShowFacePicker(false); }}
                    style={{ background: "none", border: "none", color: "var(--gold)", cursor: "pointer" }}
                  >
                    ← Reset to my primary selfie
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="surface p-5">
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
              Selected ({selectedItems.length}/6)
            </div>
            {selectedItems.length === 0 ? (
              <p className="text-xs mb-3" style={{ color: "var(--text-dim)" }}>None yet.</p>
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

            <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Quality</div>
            <div className="flex gap-1 mb-3">
              <button className={`chip flex-1 justify-center ${quality === "standard" ? "chip-active" : ""}`}
                      onClick={() => setQuality("standard")} style={{ fontSize: "0.7rem" }}
                      title="Faster">Standard</button>
              <button className={`chip flex-1 justify-center ${quality === "pro" ? "chip-active" : ""}`}
                      onClick={() => setQuality("pro")} style={{ fontSize: "0.7rem" }}
                      title="Best quality">Pro ✦</button>
            </div>

            <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              Pose / setting (optional)
            </div>
            <input className="input mb-3" placeholder="e.g. golden hour, garden walk"
                   value={settingInput} onChange={(e) => setSettingInput(e.target.value)}
                   style={{ fontSize: "0.85rem" }} />

            <button className="btn-primary w-full" onClick={generate}
                    disabled={!effectiveSelfieUrl || selectedItems.length === 0 || generating}>
              {generating ? <><Loader2 size={16} className="spin" /> Manifesting</> : <><Sparkles size={16} /> Manifest This Look</>}
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
                <button className="btn-secondary w-full" onClick={() => setShowCompare((v) => !v)} disabled={!avatarSelfieUrl}>
                  <ArrowLeftRight size={14} /> {showCompare ? "Hide before/after" : "Before / After"}
                </button>
              </div>

              <div className="surface p-5">
                <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Place in event</div>
                <input className="input mb-2" placeholder="e.g. beach wedding"
                       value={eventInput} onChange={(e) => setEventInput(e.target.value)} />
                <button className="btn-secondary w-full" onClick={() => generateEventScene(eventInput)}
                        disabled={!eventInput.trim() || eventLoading}>
                  {eventLoading ? <Loader2 size={14} className="spin" /> : <MapPin size={14} />}
                  {eventLoading ? "Placing..." : "Place in scene"}
                </button>
                <div className="flex flex-wrap gap-1 mt-3">
                  {EVENT_PRESETS.map((p) => (
                    <button key={p} className="chip" onClick={() => { setEventInput(p); generateEventScene(p); }}
                            disabled={eventLoading} style={{ fontSize: "0.7rem", padding: "0.2rem 0.6rem" }}>
                      {p.split(",")[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="surface p-5">
                <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Animate</div>
                <button className="btn-primary w-full" onClick={animate} disabled={animating}>
                  {animating ? <><Loader2 size={14} className="spin" /> Rendering (~60s)</> : <><Film size={14} /> Animate (5s video)</>}
                </button>
              </div>

              <div className="surface p-5 space-y-2">
                <button className="btn-secondary w-full" onClick={() => setShowSaveDialog(true)}>
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

      <PromptDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        title="Name this outfit"
        description="Pick a name you'll recognize later in your Outfits tab."
        placeholder={selectedItems.map((i) => i.name).join(" + ").slice(0, 60) || "My new outfit"}
        defaultValue={selectedItems.map((i) => i.name).join(" + ").slice(0, 60)}
        confirmLabel="Save outfit"
        onSubmit={saveOutfit}
      />
    </div>
  );
}
