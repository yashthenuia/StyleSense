"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Camera, Star, Trash2, Plus, Sparkles, Check } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/store/app";
import { useAuth } from "@/components/AuthProvider";
import { apiGet, apiUpload, apiDelete } from "@/lib/api";
import { toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useSeenOnce } from "@/lib/useSeenOnce";

interface SelfieListResponse {
  selfie_urls: string[];
  primary_url: string | null;
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const { avatarSelfieUrl, setSelfieOnly } = useAppStore();
  const [uploading, setUploading] = useState(false);
  const [selfies, setSelfies] = useState<string[]>([]);
  const [primaryUrl, setPrimaryUrl] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const tipsSeen = useSeenOnce("onboarding-tips");

  const refreshSelfies = useCallback(async () => {
    try {
      const data = await apiGet<SelfieListResponse>("/api/avatar/selfies");
      setSelfies(data.selfie_urls);
      setPrimaryUrl(data.primary_url);
      if (data.primary_url && data.primary_url !== avatarSelfieUrl) {
        setSelfieOnly(data.primary_url);
      }
    } catch {
      // v2d migration may not be applied; selfie list endpoint silently no-ops
    }
  }, [avatarSelfieUrl, setSelfieOnly]);

  useEffect(() => {
    if (!user) return;
    refreshSelfies();
  }, [user, refreshSelfies]);

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

  async function setPrimary(url: string) {
    try {
      const fd = new FormData();
      fd.append("url", url);
      const res = await apiUpload<{ primary_url: string }>(
        "/api/avatar/set-primary-selfie", fd
      );
      setPrimaryUrl(res.primary_url);
      setSelfieOnly(res.primary_url);
      toast.success("Primary selfie updated.");
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  async function removeSelfie(url: string) {
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

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Setup"
        title="Add your selfies."
        tutorialKey="onboarding"
        subtitle="Upload up to 3 selfies. Your primary one is used as the model in try-ons."
      />

      {/* Single step: selfie gallery */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="surface p-7 mb-5"
        style={{ borderColor: avatarSelfieUrl ? "var(--border)" : "var(--border-gold)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
            style={{
              background: avatarSelfieUrl ? "var(--gold)" : "var(--gold-dim)",
              color: avatarSelfieUrl ? "var(--on-gold)" : "var(--gold)",
            }}
          >
            {avatarSelfieUrl ? <Check size={16} /> : "1"}
          </div>
          <h2 className="font-display text-2xl">Your selfies</h2>
        </div>

        <div className="flex flex-wrap gap-3 mb-3">
          {selfies.map((url) => {
            const isPrimary = url === primaryUrl;
            return (
              <div
                key={url}
                className="relative surface overflow-hidden group"
                style={{
                  width: 130, height: 160, padding: 0,
                  borderColor: isPrimary ? "var(--gold)" : undefined,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Selfie" className="w-full h-full object-cover" />
                {isPrimary && (
                  <div
                    className="absolute top-1 left-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1"
                    style={{ background: "var(--gold)", color: "var(--on-gold)" }}
                  >
                    <Star size={10} /> Primary
                  </div>
                )}
                {!isPrimary && (
                  <button
                    onClick={() => setPrimary(url)}
                    className="absolute top-1 left-1 px-2 py-0.5 rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition flex items-center gap-1"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer" }}
                  >
                    <Star size={10} /> Set primary
                  </button>
                )}
                <button
                  onClick={() => setPendingDelete(url)}
                  className="absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--red)", cursor: "pointer" }}
                  aria-label="Remove"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}

          {selfies.length < 3 && (
            <SelfieDropzone onFile={handleUpload} loading={uploading} preview={null} compact />
          )}
        </div>

        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          {selfies.length === 0 && "Upload your first selfie to get started."}
          {selfies.length > 0 && selfies.length < 3 && `${3 - selfies.length} more slot${3 - selfies.length === 1 ? "" : "s"} available.`}
          {selfies.length === 3 && "Maximum reached. Delete one to upload another."}
        </div>

        {!tipsSeen && (
          <div className="text-xs mt-3" style={{ color: "var(--text-dim)" }}>
            <strong>Tips:</strong> Front-facing, shoulders visible, even lighting, plain background, 512×512 min, JPEG/PNG/WebP up to 16MB.
          </div>
        )}
      </motion.section>

      {/* Stylist info card - no setup needed, always available */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="surface p-5 mb-5 flex items-start gap-4"
        style={{ background: "var(--gold-dim)", borderColor: "var(--border-gold)" }}
      >
        <Sparkles size={20} style={{ color: "var(--gold)", flexShrink: 0, marginTop: 2 }} />
        <div className="flex-1 text-sm">
          <div className="font-display text-lg mb-1" style={{ color: "var(--text)" }}>
            Your AI stylist is ready
          </div>
          <p style={{ color: "var(--text-muted)" }}>
            Aria, our admin stylist, is always available. No setup needed — go to{" "}
            <Link href="/stylist" style={{ color: "var(--gold)", textDecoration: "underline" }}>
              AI Stylist
            </Link>{" "}
            to talk or type with her about your wardrobe.
          </p>
        </div>
      </motion.div>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Remove this selfie?"
        description="It'll be removed from your gallery. Try-ons that already used it stay intact."
        confirmLabel="Remove"
        destructive
        onConfirm={() => pendingDelete && removeSelfie(pendingDelete)}
      />
    </div>
  );
}

function SelfieDropzone({
  onFile, loading, preview, compact = false,
}: {
  onFile: (f: File) => void; loading: boolean; preview: string | null; compact?: boolean;
}) {
  const w = compact ? 130 : 200;
  const h = compact ? 160 : 200;
  return (
    <label
      className="surface flex items-center justify-center cursor-pointer overflow-hidden"
      style={{ width: w, height: h, borderStyle: preview ? "solid" : "dashed" }}
    >
      {loading ? (
        <Loader2 size={compact ? 22 : 28} className="spin" style={{ color: "var(--gold)" }} />
      ) : preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Selfie preview" className="w-full h-full object-cover" />
      ) : (
        <div className="text-center" style={{ color: "var(--text-dim)" }}>
          {compact ? <Plus size={22} className="mx-auto mb-1" /> : <Camera size={28} className="mx-auto mb-2" />}
          <div className="text-xs">{compact ? "Add another" : "Click to upload selfie"}</div>
        </div>
      )}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </label>
  );
}
