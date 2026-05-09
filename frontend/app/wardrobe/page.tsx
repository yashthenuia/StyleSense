"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Plus, Trash2, Sparkles, Shirt, Loader2, Link as LinkIcon, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/store/app";
import { useAuth } from "@/components/AuthProvider";
import { apiGet, apiPost, apiDelete, apiUpload } from "@/lib/api";
import { toast } from "@/components/ui/Toast";
import type { WardrobeItem } from "@/types";

const CATEGORIES = ["all", "tops", "bottoms", "dresses", "outerwear", "shoes", "accessories"];
const OCCASIONS = ["any", "casual", "formal", "evening", "sport", "beach"];

export default function WardrobePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [filterCategory, setFilterCategory] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toggleSelected, selectedItemIds, clearSelected } = useAppStore();

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

  async function deleteItem(id: string) {
    if (!confirm("Remove this item?")) return;
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
    <div>
      <PageHeader
        eyebrow="Your closet"
        title="Wardrobe."
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

      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="surface aspect-[3/4] shimmer" />
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
        <div className="grid grid-cols-4 gap-4">
          <AnimatePresence>
            {filtered.map((item, i) => {
              const selected = selectedItemIds.includes(item.id);
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.03 }}
                  className="surface surface-hover overflow-hidden cursor-pointer relative group"
                  style={{ borderColor: selected ? "var(--gold)" : undefined }}
                  onClick={() => toggleSelected(item.id)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full aspect-[3/4] object-cover"
                  />
                  {selected && (
                    <div
                      className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs"
                      style={{ background: "var(--gold)", color: "var(--bg)" }}
                    >
                      {selectedItemIds.indexOf(item.id) + 1}
                    </div>
                  )}
                  <div className="px-4 py-3">
                    <div className="text-sm truncate" title={item.name}>{item.name}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                        {item.category}{item.color ? ` · ${item.color}` : ""}
                      </span>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition"
                        style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}
                        onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                        aria-label="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {selectedItemIds.length > 0 && (
        <div
          className="fixed bottom-6 left-1/2 surface px-5 py-3 flex items-center gap-3"
          style={{ transform: "translateX(-50%)", zIndex: 50, boxShadow: "0 12px 40px -12px rgba(0,0,0,0.7)" }}
        >
          <span className="text-sm">
            <strong style={{ color: "var(--gold)" }}>{selectedItemIds.length}</strong> selected
            {selectedItemIds.length === 2 && <span style={{ color: "var(--text-muted)" }}> (max)</span>}
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
        {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onAdded={(item) => { setItems((p) => [item, ...p]); setShowAdd(false); }} />}
      </AnimatePresence>
    </div>
  );
}

function AddItemModal({ onClose, onAdded }: { onClose: () => void; onAdded: (item: WardrobeItem) => void }) {
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

  async function submit() {
    if (!name.trim()) { toast.error("Name is required."); return; }
    setSubmitting(true);
    try {
      let item: WardrobeItem;
      if (tab === "upload") {
        if (!file) { toast.error("Upload a file first."); setSubmitting(false); return; }
        const fd = new FormData();
        fd.append("file", file);
        fd.append("name", name);
        fd.append("category", category);
        fd.append("occasion", occasion);
        if (color) fd.append("color", color);
        if (brand) fd.append("brand", brand);
        item = await apiUpload<WardrobeItem>("/api/wardrobe/upload", fd);
      } else {
        if (!scrapedImage) { toast.error("Scrape a URL first."); setSubmitting(false); return; }
        item = await apiPost<WardrobeItem>("/api/wardrobe/from-url", {
          name,
          category,
          occasion,
          color: color || undefined,
          brand: brand || undefined,
          image_url: scrapedImage,
          source_url: url,
        });
      }
      toast.success("Item added.");
      onAdded(item);
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
        style={{ maxWidth: 520 }}
        onClick={(e) => e.stopPropagation()}
      >
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
      </motion.div>
    </motion.div>
  );
}
