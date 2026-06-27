"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Star, Trash2, Plus, Camera } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/store/app";
import { useAuth } from "@/components/AuthProvider";
import { apiGet, apiUpload, apiDelete } from "@/lib/api";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/Dialog";

const DICEBEAR_SEEDS = ["Felix", "Mia", "Jordan", "Alex", "Sam", "Taylor"];

interface SelfieListResponse {
  selfie_urls: string[];
  primary_url: string | null;
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const {
    avatarSelfieUrl, setSelfieOnly,
    bodyType, setBodyType, setBodyPhotoUrl, bodyPhotoUrl,
  } = useAppStore();
  const [uploading, setUploading] = useState(false);
  const [selfies, setSelfies] = useState<string[]>([]);
  const [primaryUrl, setPrimaryUrl] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [selectedSeed, setSelectedSeed] = useState<string | null>(null);

  const refreshSelfies = useCallback(async () => {
    try {
      const data = await apiGet<SelfieListResponse>("/api/avatar/selfies");
      setSelfies(data.selfie_urls);
      setPrimaryUrl(data.primary_url);
      if (data.primary_url && data.primary_url !== avatarSelfieUrl) {
        setSelfieOnly(data.primary_url);
        setSelectedSeed(null);
      }
    } catch {}
  }, [avatarSelfieUrl, setSelfieOnly]);

  useEffect(() => {
    if (!user) return;
    refreshSelfies();
    apiGet<{ full_body_url: string | null }>("/api/avatar/full-body")
      .then((d) => setFullBodyUrl(d.full_body_url))
      .catch(() => {});
  }, [user, refreshSelfies]);

  async function handleUploadFullBody(file: File) {
    setUploadingFull(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiUpload<{ full_body_url: string }>("/api/avatar/upload-full-body", fd);
      setFullBodyUrl(res.full_body_url);
      toast.success("Full-body photo uploaded — Aria will style for your body type.");
    } catch (e) {
      toast.error(`Upload failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setUploadingFull(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiUpload<{ selfie_url: string; selfie_urls?: string[] }>(
        "/api/avatar/upload-selfie", fd
      );
      setSelfieOnly(res.selfie_url);
      if (res.selfie_urls) setSelfies(res.selfie_urls);
      await refreshSelfies();
      toast.success("Selfie uploaded.");
    } catch (e) {
      toast.error(`Upload failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleSetPrimary(url: string) {
    try {
      const fd = new FormData();
      fd.append("url", url);
      const res = await apiUpload<{ primary_url: string }>("/api/avatar/set-primary-selfie", fd);
      setPrimaryUrl(res.primary_url);
      setSelfieOnly(res.primary_url);
      toast.success("Primary selfie updated.");
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  async function handleDelete(url: string) {
    try {
      await apiDelete<{ selfie_urls: string[]; primary_url: string | null }>(
        `/api/avatar/selfie?url=${encodeURIComponent(url)}`
      );
      await refreshSelfies();
      toast.success("Selfie removed.");
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  function selectDicebear(seed: string) {
    setSelectedSeed(seed);
    setSelfieOnly(`https://api.dicebear.com/10.x/open-peeps/svg?seed=${seed}`);
  }

  function handleBodyPhoto(file: File) {
    const url = URL.createObjectURL(file);
    setBodyPhotoUrl(url);
    setBodyType(null);
  }

  const slotHint =
    selfies.length === 0 ? "Front-facing, shoulders visible." :
    selfies.length < 3 ? `${3 - selfies.length} more slot${3 - selfies.length === 1 ? "" : "s"} available.` :
    "Delete one to upload another.";

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <PageHeader
        eyebrow="Setup"
        title="Your Look."
        tutorialKey="onboarding"
        subtitle="Set your face photo for try-ons and choose a body silhouette."
      />

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-5 px-4 sm:px-6 pb-6 overflow-y-auto lg:overflow-hidden">
        {/* LEFT: Face photo + Full body */}
        <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">

          {/* Face photo */}
          <section className="surface p-5">
            <div
              className="text-xs uppercase tracking-widest mb-3"
              style={{ color: "var(--ink)", fontWeight: 600 }}
            >
              Face photo
            </div>

            <div className="flex gap-3 mb-2" style={{ flexWrap: "wrap" }}>
              {selfies.map((url) => {
                const isPrimary = url === primaryUrl;
                return (
                  <div
                    key={url}
                    className="relative group overflow-hidden"
                    style={{
                      width: 110, height: 135,
                      border: isPrimary ? "2px solid #513229" : "1.5px solid var(--border)",
                      flexShrink: 0,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="Selfie" className="w-full h-full object-cover" />

                    {isPrimary && (
                      <div
                        className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-semibold flex items-center gap-1"
                        style={{ background: "#513229", color: "#fff" }}
                      >
                        <Star size={9} /> Primary
                      </div>
                    )}
                    {!isPrimary && (
                      <button
                        onClick={() => handleSetPrimary(url)}
                        className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] opacity-0 group-hover:opacity-100 transition flex items-center gap-1"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer" }}
                      >
                        <Star size={9} /> Set primary
                      </button>
                    )}
                    <button
                      onClick={() => setPendingDelete(url)}
                      className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 transition"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--red)", cursor: "pointer" }}
                      aria-label="Remove"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                );
              })}

              {selfies.length < 3 && (
                <label
                  className="flex flex-col items-center justify-center cursor-pointer"
                  style={{
                    width: 110, height: 135, flexShrink: 0,
                    border: "2px dashed rgba(81,50,41,0.45)",
                    color: "var(--text-dim)",
                  }}
                >
                  {uploading
                    ? <Loader2 size={20} className="spin" style={{ color: "var(--gold)" }} />
                    : selfies.length === 0
                      ? <><Camera size={20} className="mb-1" /><span className="text-xs">Add selfie</span></>
                      : <><Plus size={20} className="mb-1" /><span className="text-xs">Add another</span></>
                  }
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                  />
                </label>
              )}
            </div>

            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{slotHint}</p>
          </section>

          {/* Full body */}
          <section className="surface p-5">
            <div
              className="text-xs uppercase tracking-widest mb-3"
              style={{ color: "var(--ink)", fontWeight: 600 }}
            >
              Body silhouette
            </div>

            <div className="flex gap-3 mb-3">
              {(["female", "male"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => { setBodyType(type); setBodyPhotoUrl(null); }}
                  className="flex flex-col items-center gap-1 px-6 py-3 text-sm font-semibold transition-all"
                  style={{
                    background: bodyType === type ? "var(--parchment)" : "var(--surface2)",
                    border: bodyType === type ? "2px solid #513229" : "1.5px solid var(--border)",
                    color: "var(--ink)",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 18 }}>{type === "female" ? "♀" : "♂"}</span>
                  <span>{type === "female" ? "Female" : "Male"}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <label
                className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer"
                style={{
                  border: "1.5px dashed rgba(81,50,41,0.45)",
                  color: "var(--text-muted)",
                  display: "inline-flex",
                }}
              >
                <Plus size={12} /> or upload your own
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleBodyPhoto(e.target.files[0])}
                />
              </label>

              {bodyPhotoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bodyPhotoUrl}
                  alt="Body photo"
                  className="object-cover"
                  style={{ width: 40, height: 54, border: "1.5px solid var(--border)" }}
                />
              )}
            </div>
          </section>
        </div>

        {/* RIGHT: Illustrated defaults */}
        <div className="flex flex-col min-h-0 overflow-y-auto">
          <section className="surface p-5 flex-1">
            <div
              className="text-xs uppercase tracking-widest mb-3"
              style={{ color: "var(--text-muted)" }}
            >
              Or start with a look
            </div>

            <div className="grid grid-cols-3 gap-2">
              {DICEBEAR_SEEDS.map((seed) => {
                const isSelected = selectedSeed === seed && selfies.length === 0;
                return (
                  <button
                    key={seed}
                    onClick={() => selectDicebear(seed)}
                    title={seed}
                    style={{
                      background: "var(--surface2)",
                      padding: 0,
                      border: "none",
                      cursor: "pointer",
                      outline: isSelected ? "2px solid #513229" : "2px solid transparent",
                      outlineOffset: 2,
                      transition: "outline-color 0.1s",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.dicebear.com/10.x/open-peeps/svg?seed=${seed}`}
                      alt={seed}
                      style={{ width: "100%", aspectRatio: "1 / 1", display: "block" }}
                    />
                  </button>
                );
              })}
            </div>

            <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
              Upload a selfie for photoreal try-ons. These are illustrated placeholders.
            </p>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Remove this selfie?"
        description="It'll be removed from your gallery. Try-ons that already used it stay intact."
        confirmLabel="Remove"
        destructive
        onConfirm={() => { if (pendingDelete) handleDelete(pendingDelete); }}
      />
    </div>
  );
}
