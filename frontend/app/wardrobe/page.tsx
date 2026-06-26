"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Plus, Sparkles, Shirt, Loader2, Link as LinkIcon, Upload, Check, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/store/app";
import { useAuth } from "@/components/AuthProvider";
import { apiGet, apiPost, apiDelete, apiUpload } from "@/lib/api";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { ClosetShelf } from "@/components/wardrobe/ClosetShelf";
import type { WardrobeItem, DetectedItem } from "@/types";

const CATEGORIES = ["all", "tops", "bottoms", "dresses", "outerwear", "shoes", "accessories"];
const OCCASIONS = ["any", "casual", "formal", "evening", "sport", "beach"];
// Fixed display order for the closet shelves (boutique-style top-to-bottom).
const SHELF_ORDER = ["tops", "outerwear", "bottoms", "dresses", "shoes", "accessories"];

export default function WardrobePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [filterCategory, setFilterCategory] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toggleSelected, selectedItemIds, clearSelected } = useAppStore();
  const [pendingDelete, setPendingDelete] = useState<WardrobeItem | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await apiGet<WardrobeItem[]>(`/api/wardrobe`);
      setItems(data);
    } catch (e) {
      toast.error(`Failed to load wardrobe: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (user) refresh(); }, [user]);

  async function performDelete(id: string) {
    try {
      await apiDelete(`/api/wardrobe/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Item removed.");
    } catch (e) {
      toast.error(`Delete failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  const filtered = filterCategory === "all"
    ? items
    : items.filter((i) => i.category === filterCategory);

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0">
        <PageHeader
          tutorialKey="wardrobe"
          subtitle="Add items by photo upload or product URL. Select up to 2 items, then open Studio to try them on."
          action={
            <div className="flex items-center gap-2">
              {selectedItemIds.length > 0 && (
                <Link href="/studio" className="btn-primary">
                  <Sparkles size={16} /> Try on {selectedItemIds.length} selected
                </Link>
              )}
              <button className="btn-primary" onClick={() => setShowAdd(true)}>
                <Plus size={16} /> Add item
              </button>
            </div>
          }
        />

        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`chip ${filterCategory === c ? "chip-active" : ""}`}
              onClick={() => setFilterCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-4">
      {loading ? (
        <div className="closet">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mb-6">
              <div className="shimmer" style={{ height: 18, width: 120, borderRadius: 6, marginBottom: 12, opacity: 0.4 }} />
              <div className="flex gap-5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="shimmer" style={{ width: 140, height: 180, borderRadius: 8, opacity: 0.25 }} />
                ))}
              </div>
              <div className="closet-plank" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface p-12 text-center" style={{ color: "var(--text-muted)" }}>
          <Shirt size={32} className="mx-auto mb-3" style={{ color: "var(--text-dim)" }} />
          <p>{items.length === 0 ? "Your wardrobe is empty." : `No items in ${filterCategory}.`}</p>
          {items.length === 0 && (
            <button className="btn-primary mt-4" onClick={() => setShowAdd(true)}>
              <Plus size={16} /> Add your first item
            </button>
          )}
        </div>
      ) : (
        <div className="closet">
          {SHELF_ORDER
            .filter((cat) => filterCategory === "all" || filterCategory === cat)
            .map((cat) => (
              <ClosetShelf
                key={cat}
                label={cat}
                items={filtered.filter((it) => it.category === cat)}
                selectedItemIds={selectedItemIds}
                onSelect={toggleSelected}
                onDelete={(item) => setPendingDelete(item)}
              />
            ))}
        </div>
      )}
      </div>

      {selectedItemIds.length > 0 && (
        <div
          className="fixed bottom-6 left-1/2 surface px-5 py-3 flex items-center gap-3"
          style={{ transform: "translateX(-50%)", zIndex: 50, boxShadow: "0 12px 40px -12px rgba(0,0,0,0.7)" }}
        >
          <span className="text-sm">
            <strong style={{ color: "var(--text)" }}>{selectedItemIds.length}</strong> selected
            {selectedItemIds.length >= 6 && <span style={{ color: "var(--text-muted)" }}> (max)</span>}
          </span>
          <button className="btn-secondary" onClick={clearSelected} style={{ padding: "0.4rem 0.9rem" }}>
            Clear
          </button>
          <Link href="/studio" className="btn-primary" style={{ padding: "0.5rem 1rem" }}>
            <Sparkles size={14} /> Try on
          </Link>
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <AddItemModal
            onClose={() => setShowAdd(false)}
            onAdded={(item) => { setItems((p) => [item, ...p]); setShowAdd(false); }}
            onAddedMany={(rows) => { setItems((p) => [...rows, ...p]); setShowAdd(false); }}
          />
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Remove this item?"
        description={pendingDelete?.name}
        confirmLabel="Remove"
        destructive
        onConfirm={() => { if (pendingDelete) performDelete(pendingDelete.id); }}
      />
    </div>
  );
}

function AddItemModal({
  onClose,
  onAdded,
  onAddedMany,
}: {
  onClose: () => void;
  onAdded: (item: WardrobeItem) => void;
  onAddedMany: (rows: WardrobeItem[]) => void;
}) {
  const [tab, setTab] = useState<"upload" | "url">("upload");

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // URL state
  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapedImage, setScrapedImage] = useState<string | null>(null);

  // Shared form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("tops");
  const [occasion, setOccasion] = useState("casual");
  const [color, setColor] = useState("");
  const [brand, setBrand] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Multi-item review state
  const [phase, setPhase] = useState<"form" | "detecting" | "adding" | "checklist">("form");
  const [detected, setDetected] = useState<DetectedItem[]>([]);
  const [detectedSourceUrl, setDetectedSourceUrl] = useState<string | null>(null);

  function handleFile(f: File) {
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function scrape() {
    if (!url.trim()) return;
    setScraping(true);
    try {
      const res = await apiPost<{ image_url: string; name: string; suggested_category: string }>(
        "/api/scrape/product-url",
        { url: url.trim() }
      );
      setScrapedImage(res.image_url);
      setName(res.name);
      if (res.suggested_category) setCategory(res.suggested_category);
      toast.success("Product scraped.");
    } catch (e) {
      toast.error(`Could not scrape: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setScraping(false);
    }
  }

  // For URL tab: same as before. For Upload tab: detect first, then route to
  // either single-item upload or the multi-item checklist.
  async function submit() {
    if (tab === "url") {
      if (!name.trim()) { toast.error("Name is required."); return; }
      if (!scrapedImage) { toast.error("Scrape a URL first."); return; }
      setSubmitting(true);
      try {
        const item = await apiPost<WardrobeItem>("/api/wardrobe/from-url", {
          name,
          category,
          occasion,
          color: color || undefined,
          brand: brand || undefined,
          image_url: scrapedImage,
          source_url: url,
        });
        toast.success("Item added.");
        onAdded(item);
      } catch (e) {
        toast.error(`Failed: ${e instanceof Error ? e.message : "unknown"}`);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Upload tab
    if (!file) { toast.error("Upload a file first."); return; }
    setPhase("detecting");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiUpload<{ image_url: string; detected: DetectedItem[] }>(
        "/api/wardrobe/detect-items", fd
      );
      if (!res.detected || res.detected.length === 0) {
        toast.error("No clothing items detected. Try a clearer photo.");
        setPhase("form");
        return;
      }
      if (res.detected.length === 1) {
        // Single-item path: re-upload via existing /upload using detection to fill blanks.
        // Switch the loader copy so it reflects the second call instead of staying on "Analyzing...".
        setPhase("adding");
        const d = res.detected[0];
        const fd2 = new FormData();
        fd2.append("file", file);
        fd2.append("name", name.trim() || d.name);
        fd2.append("category", category !== "tops" ? category : (d.category || "tops"));
        fd2.append("occasion", occasion);
        const finalColor = color.trim() || d.color || "";
        const finalBrand = brand.trim() || d.brand || "";
        if (finalColor) fd2.append("color", finalColor);
        if (finalBrand) fd2.append("brand", finalBrand);
        const item = await apiUpload<WardrobeItem>("/api/wardrobe/upload", fd2);
        toast.success("Item added.");
        onAdded(item);
        return;
      }
      // 2+ detected → review checklist
      setDetected(res.detected);
      setDetectedSourceUrl(res.image_url);
      setPhase("checklist");
    } catch (e) {
      toast.error(`Detection failed: ${e instanceof Error ? e.message : "unknown"}`);
      setPhase("form");
    }
  }

  async function confirmMulti(picked: DetectedItem[]) {
    if (!detectedSourceUrl || picked.length === 0) return;
    setSubmitting(true);
    try {
      const res = await apiPost<{ created: WardrobeItem[]; failed: { name: string; reason: string }[] }>(
        "/api/wardrobe/add-multi",
        { source_image_url: detectedSourceUrl, items: picked }
      );
      const okCount = res.created?.length || 0;
      const failCount = res.failed?.length || 0;
      if (okCount > 0) {
        toast.success(
          failCount > 0
            ? `${okCount} item${okCount === 1 ? "" : "s"} added. ${failCount} failed.`
            : `${okCount} item${okCount === 1 ? "" : "s"} added.`
        );
        onAddedMany(res.created);
      } else {
        toast.error("Could not add any items. Try again or upload them individually.");
      }
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ background: "rgba(8,8,13,0.85)", zIndex: 100 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="surface p-7 w-full"
        style={{ maxWidth: phase === "checklist" ? 640 : 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        {phase === "detecting" && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 size={32} className="spin mb-4" style={{ color: "var(--text-muted)" }} />
            <h2 className="font-display text-2xl mb-1">Analyzing your photo...</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Looking for individual clothing items.
            </p>
          </div>
        )}

        {phase === "adding" && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 size={32} className="spin mb-4" style={{ color: "var(--gold)" }} />
            <h2 className="font-display text-2xl mb-1">Adding to your closet...</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Cleaning up the garment and saving it.
            </p>
          </div>
        )}

        {phase === "checklist" && (
          <DetectedItemsChecklist
            sourceUrl={detectedSourceUrl!}
            initial={detected}
            submitting={submitting}
            onCancel={() => setPhase("form")}
            onConfirm={confirmMulti}
          />
        )}

        {phase === "form" && (
          <>
        <h2 className="font-display text-3xl mb-5">Add item</h2>

        <div className="flex gap-2 mb-5">
          <button
            className={`chip ${tab === "upload" ? "chip-active" : ""}`}
            onClick={() => setTab("upload")}
          >
            <Upload size={12} style={{ marginRight: 6 }} /> Upload photo
          </button>
          <button
            className={`chip ${tab === "url" ? "chip-active" : ""}`}
            onClick={() => setTab("url")}
          >
            <LinkIcon size={12} style={{ marginRight: 6 }} /> Product URL
          </button>
        </div>

        {tab === "upload" ? (
          <label
            className="surface flex items-center justify-center cursor-pointer overflow-hidden mb-4"
            style={{ width: "100%", height: 200, borderStyle: file ? "solid" : "dashed" }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Preview" className="w-full h-full object-contain" />
            ) : (
              <div className="text-center" style={{ color: "var(--text-dim)" }}>
                <Upload size={28} className="mx-auto mb-2" />
                <div className="text-xs">Click to upload (JPG, PNG, WebP)</div>
              </div>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        ) : (
          <div className="mb-4">
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="https://amazon.com/dp/... or any product URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button className="btn-secondary" onClick={scrape} disabled={!url.trim() || scraping}>
                {scraping ? <Loader2 size={16} className="spin" /> : "Scrape"}
              </button>
            </div>
            {scrapedImage && (
              <div className="surface mt-3 p-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={scrapedImage} alt="Scraped" style={{ width: 80, height: 80, objectFit: "contain" }} />
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Scraped successfully. Will be re-hosted to Supabase Storage when you save.
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="col-span-2">
            <label className="label">Name *</label>
            <input className="input" placeholder="Navy linen blazer" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.filter((c) => c !== "all").map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Occasion</label>
            <select className="input" value={occasion} onChange={(e) => setOccasion(e.target.value)}>
              {OCCASIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Color</label>
            <input className="input" placeholder="navy" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          <div>
            <label className="label">Brand</label>
            <input className="input" placeholder="optional" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? <><Loader2 size={16} className="spin" /> Saving...</> : "Add to wardrobe"}
          </button>
        </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function DetectedItemsChecklist({
  sourceUrl,
  initial,
  submitting,
  onCancel,
  onConfirm,
}: {
  sourceUrl: string;
  initial: DetectedItem[];
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (picked: DetectedItem[]) => void;
}) {
  const [rows, setRows] = useState(initial.map((d) => ({ ...d, checked: true })));

  function update(idx: number, patch: Partial<typeof rows[number]>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  const checkedCount = rows.filter((r) => r.checked).length;

  return (
    <div>
      <h2 className="font-display text-3xl mb-1">
        {initial.length} items detected
      </h2>
      <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
        Review, edit, then add. Each item gets isolated as its own clean product shot.
      </p>

      <div className="surface p-3 mb-5 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sourceUrl} alt="Source" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6 }} />
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          Your source photo. Each item below will be extracted from it on a clean white background.
        </div>
      </div>

      <div className="space-y-3 mb-5" style={{ maxHeight: 360, overflowY: "auto" }}>
        {rows.map((r, i) => (
          <div
            key={i}
            className="surface p-3 flex items-start gap-3"
            style={{ borderColor: r.checked ? "var(--border-gold)" : "var(--border)", opacity: r.checked ? 1 : 0.55 }}
          >
            <button
              onClick={() => update(i, { checked: !r.checked })}
              className="w-6 h-6 rounded flex items-center justify-center mt-1 flex-shrink-0"
              style={{
                background: r.checked ? "var(--ink)" : "var(--surface2)",
                border: `1px solid ${r.checked ? "var(--ink)" : "var(--border)"}`,
                color: r.checked ? "var(--parchment)" : "var(--text-dim)",
                cursor: "pointer",
              }}
              aria-label={r.checked ? "Uncheck" : "Check"}
            >
              {r.checked ? <Check size={14} /> : <X size={14} />}
            </button>

            <div className="flex-1 grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <input
                  className="input"
                  value={r.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="Item name"
                  style={{ fontSize: "0.9rem" }}
                />
              </div>
              <select
                className="input"
                value={r.category}
                onChange={(e) => update(i, { category: e.target.value as DetectedItem["category"] })}
                style={{ fontSize: "0.85rem" }}
              >
                {CATEGORIES.filter((c) => c !== "all").map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                className="input"
                placeholder="Color"
                value={r.color || ""}
                onChange={(e) => update(i, { color: e.target.value })}
                style={{ fontSize: "0.85rem" }}
              />
              {r.position && (
                <div className="col-span-2 text-xs" style={{ color: "var(--text-dim)" }}>
                  In source: {r.position}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Back
        </button>
        <button
          className="btn-primary"
          onClick={() => onConfirm(rows.filter((r) => r.checked).map(({ checked, ...rest }) => rest))}
          disabled={submitting || checkedCount === 0}
        >
          {submitting ? (
            <><Loader2 size={16} className="spin" /> Adding {checkedCount}...</>
          ) : (
            <>Add {checkedCount} item{checkedCount === 1 ? "" : "s"}</>
          )}
        </button>
      </div>
    </div>
  );
}
