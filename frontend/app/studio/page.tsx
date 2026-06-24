"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import {
  Sparkles, MapPin, Film, Loader2, Save, ArrowLeftRight, Shirt, AlertCircle, Share2,
  User as UserIcon, RefreshCw, Upload, X,
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
import { TRYON_MODELS, VIDEO_MODELS } from "@/lib/models";
import type { WardrobeItem } from "@/types";

const MOTION_PRESETS = [
  { label: "Slow turn to camera", prompt: "The subject slowly turns toward the camera with a confident editorial pose, gentle hair movement." },
  { label: "Runway walk", prompt: "The subject walks toward the camera like a fashion runway model, full-body, smooth confident stride." },
  { label: "Windswept editorial", prompt: "Ambient breeze moves the hair and fabric, the subject shifts weight subtly, cinematic slow motion." },
];

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
    setSelected,
    clearSelected,
    stylizedAvatarUrl,
    stylizedAvatarStatus,
    setStylized,
    tryonModel,
    videoModel,
    setTryonModel,
    setVideoModel,
  } = useAppStore();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [eventInput, setEventInput] = useState("");
  const [motionPrompt, setMotionPrompt] = useState(MOTION_PRESETS[0].prompt);
  const [showShare, setShowShare] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [quality, setQuality] = useState<"standard" | "pro">("pro");
  const [settingInput, setSettingInput] = useState("");
  const [enhancePrompt, setEnhancePrompt] = useState(true);
  // Face picker: which selfie URL to use as the avatar reference for try-on
  const [activeFaceUrl, setActiveFaceUrl] = useState<string | null>(null);
  const [allSelfies, setAllSelfies] = useState<string[]>([]);
  // Optional 2nd reference selfie (Gemini uses up to 2 selfies for sharper identity)
  const [extraRefSelfies, setExtraRefSelfies] = useState<string[]>([]);
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
      if (res.selfie_urls) setAllSelfies(res.selfie_urls);
      switchFace(res.selfie_url);
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
  const cancelTryOn = useTasks((s) => s.cancelTryOn);
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

  // Category-aware selection: one item per outfit "slot" (top, bottom, outerwear,
  // shoes). A dress is mutually exclusive with tops + bottoms. Accessories stack.
  function selectItem(item: WardrobeItem) {
    const id = item.id;
    const cat = (item.category || "tops").toLowerCase();
    if (selectedItemIds.includes(id)) {
      setSelected(selectedItemIds.filter((x) => x !== id));
      return;
    }
    const catOf = (iid: string) => (items.find((w) => w.id === iid)?.category || "").toLowerCase();
    let next = [...selectedItemIds];
    if (cat === "accessories") {
      next.push(id);
    } else if (cat === "dresses") {
      next = next.filter((x) => !["dresses", "tops", "bottoms"].includes(catOf(x)));
      next.push(id);
    } else if (cat === "tops" || cat === "bottoms") {
      next = next.filter((x) => catOf(x) !== cat && catOf(x) !== "dresses");
      next.push(id);
    } else {
      next = next.filter((x) => catOf(x) !== cat);
      next.push(id);
    }
    setSelected(next);
  }

  function reset() {
    setShowCompare(false);
    setEventInput("");
    useTasks.getState().clearDone();
  }

  // Switching the face must refresh the canvas: drop the lingering previous result
  // so the idle view shows the NEWLY chosen face (otherwise the old model photo
  // stays on screen and it looks like nothing changed).
  function switchFace(url: string) {
    setActiveFaceUrl(url);
    setShowCompare(false);
    setExtraRefSelfies([]);
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
      model: tryonModel,
      enhancePrompt,
      referenceSelfieUrls: extraRefSelfies.length
        ? extraRefSelfies.filter((u) => u !== effectiveSelfieUrl)
        : undefined,
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
      model: videoModel,
      motionPrompt: motionPrompt.trim() || undefined,
      enhancePrompt,
    });
  }

  async function saveOutfit(name: string) {
    try {
      await apiPost("/api/outfits/save", {
        name,
        item_ids: selectedItemIds,
        preview_image_url: eventUrl || resultUrl,
        tryon_result_id: resultId,
      });
      toast.success("Saved — it's now in your Outfits & history.");
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
                  onClick={() => selectItem(it)}
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
            <GeneratingState avatarUrl={effectiveSelfieUrl} itemUrls={activeTryOn?.itemImageUrls || []} startedAt={activeTryOn?.startedAt} />
          ) : resultUrl ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="surface overflow-hidden"
            >
              {videoUrl ? (
                // Natural ratio, capped to the viewport height -> whole video visible,
                // and no forced letterbox (which paints black bars on <video>).
                <video src={videoUrl} controls autoPlay loop
                  style={{ display: "block", margin: "0 auto", maxHeight: "72vh", maxWidth: "100%" }} />
              ) : showCompare && effectiveSelfieUrl ? (
                <div style={{ maxWidth: "calc(72vh * 9 / 16)", margin: "0 auto" }}>
                  <ReactCompareSlider
                    itemOne={<ReactCompareSliderImage src={effectiveSelfieUrl} alt="Before" />}
                    itemTwo={<ReactCompareSliderImage src={resultUrl} alt="After" />}
                    style={{ aspectRatio: "9/16", width: "100%" }}
                  />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={eventUrl || resultUrl} alt="Try-on result"
                  style={{ display: "block", margin: "0 auto", maxHeight: "72vh", maxWidth: "100%" }} />
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

          {resultUrl && !generating && (activeTryOn?.itemImageUrls?.length ?? 0) > 0 && (
            <div className="surface p-3 mt-3">
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                Items in this look — click one to try it alone
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {activeTryOn!.itemImageUrls.map((u, i) => {
                  const match = items.find((w) => w.image_url === u);
                  return (
                    <button
                      key={i}
                      className="shrink-0 text-center"
                      style={{ width: 56, background: "none", border: "none", padding: 0, cursor: match ? "pointer" : "default" }}
                      title={match ? `Try "${match.name}" alone` : (activeTryOn!.itemNames?.[i] || "")}
                      onClick={() => {
                        if (!match) return;
                        setSelected([match.id]);
                        reset();
                        toast.info(`Selected "${match.name}" — click Manifest to try it alone.`);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="object-cover" style={{ width: 56, height: 56, borderRadius: 8, border: "1px solid var(--border)" }} />
                      <div className="truncate text-[10px] mt-1" style={{ color: "var(--text-dim)" }}>
                        {activeTryOn!.itemNames?.[i] || ""}
                      </div>
                    </button>
                  );
                })}
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
                      onClick={() => { switchFace(url); setShowFacePicker(false); }}
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

                {allSelfies.length > 1 && (
                  <div className="mb-3">
                    <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                      2nd reference selfie · Gemini
                    </div>
                    <div className="text-[10px] mb-2" style={{ color: "var(--text-dim)" }}>
                      Add another angle to sharpen the face (Gemini only).
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allSelfies.filter((u) => u !== effectiveSelfieUrl).map((url) => {
                        const on = extraRefSelfies.includes(url);
                        return (
                          <button
                            key={url}
                            onClick={() => setExtraRefSelfies(on ? [] : [url])}
                            className="surface overflow-hidden relative"
                            style={{ width: 50, height: 50, padding: 0, cursor: "pointer", borderColor: on ? "var(--gold)" : undefined }}
                            title={on ? "Remove 2nd reference" : "Use as 2nd reference"}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            {on && (
                              <div className="absolute top-0 right-0 text-[9px] px-1 font-bold"
                                   style={{ background: "var(--gold)", color: "var(--on-gold)" }}>2</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

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

            <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Try-on model</div>
            <select className="input mb-1" value={tryonModel} onChange={(e) => setTryonModel(e.target.value)}
                    style={{ fontSize: "0.85rem" }}>
              {TRYON_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label} — {m.tier}</option>
              ))}
            </select>
            <div className="text-[10px] mb-3" style={{ color: "var(--text-dim)" }}>
              {TRYON_MODELS.find((m) => m.id === tryonModel)?.blurb}
            </div>

            <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              Pose / setting (optional)
            </div>
            <input className="input mb-2" placeholder="e.g. golden hour, garden walk"
                   value={settingInput} onChange={(e) => setSettingInput(e.target.value)}
                   style={{ fontSize: "0.85rem" }} />
            <label className="flex items-center gap-2 mb-3 cursor-pointer" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              <input type="checkbox" checked={enhancePrompt} onChange={(e) => setEnhancePrompt(e.target.checked)} />
              <span>✦ AI-enhance my prompt (try-on + video)</span>
            </label>

            <button className="btn-primary w-full" onClick={generate}
                    disabled={!effectiveSelfieUrl || selectedItems.length === 0 || generating}>
              {generating ? <><Loader2 size={16} className="spin" /> Manifesting</> : <><Sparkles size={16} /> Manifest This Look</>}
            </button>
            {generating && (
              <button className="btn-secondary w-full mt-2" onClick={() => { cancelTryOn(); toast.info("Generation cancelled."); }} style={{ padding: "0.5rem 1rem" }}>
                <X size={14} /> Cancel
              </button>
            )}
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
                <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Animate your current scene</div>
                {eventUrl && (
                  <div className="text-[11px] mb-2" style={{ color: "var(--gold)" }}>
                    Using placed scene: {eventInput || "current scene"}
                  </div>
                )}

                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Video model</div>
                <select className="input mb-1" value={videoModel} onChange={(e) => setVideoModel(e.target.value)}
                        style={{ fontSize: "0.85rem" }}>
                  {VIDEO_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label} — {m.tier}</option>
                  ))}
                </select>
                <div className="text-[10px] mb-3" style={{ color: "var(--text-dim)" }}>
                  {VIDEO_MODELS.find((m) => m.id === videoModel)?.blurb}
                </div>

                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Motion</div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {MOTION_PRESETS.map((p) => (
                    <button key={p.label} className={`chip ${motionPrompt === p.prompt ? "chip-active" : ""}`}
                            onClick={() => setMotionPrompt(p.prompt)} disabled={animating}
                            style={{ fontSize: "0.7rem", padding: "0.2rem 0.6rem" }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <input className="input mb-3" placeholder="Describe the motion (optional)"
                       value={motionPrompt} onChange={(e) => setMotionPrompt(e.target.value)}
                       style={{ fontSize: "0.8rem" }} disabled={animating} />

                <button className="btn-primary w-full" onClick={animate} disabled={animating}>
                  {animating ? <><Loader2 size={14} className="spin" /> Rendering (~60s)</> : <><Film size={14} /> Animate (6s video)</>}
                </button>
              </div>
            </>
          )}

          {/* Save/Share stays available even after a video is generated */}
          {resultUrl && (
            <div className="surface p-5 space-y-2">
              <button className="btn-secondary w-full" onClick={() => setShowSaveDialog(true)}>
                <Save size={14} /> Save {videoUrl ? "look" : "outfit"}
              </button>
              <button className="btn-secondary w-full" onClick={() => setShowShare(true)} disabled={!resultId}>
                <Share2 size={14} /> Share with friend
              </button>
            </div>
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
