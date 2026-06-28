"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { LogOut, User, Camera, Loader2 } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/store/app";
import { useAuth } from "@/components/AuthProvider";
import { TRYON_MODELS, VIDEO_MODELS } from "@/lib/models";
import { apiGet, apiUpload } from "@/lib/api";
import { toast } from "@/components/ui/Toast";

export default function SettingsPage() {
  const { user, signOut, refreshProfile } = useAuth();
  const { tryonModel, videoModel, setTryonModel, setVideoModel, setSelfieOnly } = useAppStore();
  const [primaryUrl, setPrimaryUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const refreshSelfie = useCallback(async () => {
    try {
      const data = await apiGet<{ selfie_urls: string[]; primary_url: string | null }>("/api/avatar/selfies");
      setPrimaryUrl(data.primary_url);
      if (data.primary_url) setSelfieOnly(data.primary_url);
    } catch {}
  }, [setSelfieOnly]);

  useEffect(() => { if (user) refreshSelfie(); }, [user, refreshSelfie]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiUpload<{ selfie_url: string }>("/api/avatar/upload-selfie", fd);
      setPrimaryUrl(res.selfie_url);
      setSelfieOnly(res.selfie_url);
      await refreshProfile();
      toast.success("Selfie uploaded.");
    } catch (e) {
      toast.error(`Upload failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto pb-16">
      <div className="max-w-2xl">
        <PageHeader
          eyebrow="Preferences"
          tutorialKey="settings"
          subtitle="Account and generation preferences."
        />

        {/* Generation quality */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface p-7 mb-6"
        >
          <h2 className="font-display text-2xl mb-1">Generation quality</h2>
          <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
            Choose speed vs. quality for try-ons and animations. Higher quality uses more Runway credits.
          </p>

          <div className="flex flex-col gap-5">
            <ModelPicker
              label="Try-on model"
              value={tryonModel}
              options={TRYON_MODELS}
              onChange={setTryonModel}
            />
            <ModelPicker
              label="Video model"
              value={videoModel}
              options={VIDEO_MODELS}
              onChange={setVideoModel}
            />
          </div>
        </motion.div>

        {/* Avatar Setup */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="surface p-7 mb-6"
        >
          <h2 className="font-display text-2xl mb-1">Your Avatar</h2>
          <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
            Your face photo is used for photoreal try-ons in Studio.
          </p>

          <div className="flex items-center gap-5">
            {/* Current primary selfie or placeholder */}
            <div
              className="relative flex-shrink-0 overflow-hidden"
              style={{ width: 90, height: 110, border: primaryUrl ? "2px solid #513229" : "2px dashed rgba(81,50,41,0.35)" }}
            >
              {primaryUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={primaryUrl} alt="Your selfie" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1" style={{ color: "var(--text-dim)" }}>
                  <User size={22} />
                  <span className="text-[10px]">No photo</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label
                className="btn-secondary flex items-center gap-2 cursor-pointer"
                style={{ display: "inline-flex" }}
              >
                {uploading
                  ? <><Loader2 size={14} className="spin" /> Uploading…</>
                  : <><Camera size={14} /> {primaryUrl ? "Change selfie" : "Add selfie"}</>
                }
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                />
              </label>
              <Link
                href="/onboarding"
                className="btn-secondary flex items-center gap-2"
                style={{ textDecoration: "none" }}
              >
                <User size={14} /> Manage all photos
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Account */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="surface p-7 mb-6"
        >
          <h2 className="font-display text-2xl mb-1">Account</h2>
          <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>{user?.email}</p>

          <button
            className="btn-secondary flex items-center gap-2"
            onClick={signOut}
          >
            <LogOut size={15} /> Sign out
          </button>
        </motion.div>
      </div>
    </div>
  );
}

function ModelPicker({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string; blurb: string }[];
  onChange: (id: string) => void;
}) {
  const groupId = `model-picker-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div role="group" aria-labelledby={groupId}>
      <div id={groupId} className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--ink)", fontWeight: 600 }}>
        {label}
      </div>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            aria-pressed={value === opt.id}
            className="text-left px-4 py-2.5 text-sm transition-all"
            style={{
              background: value === opt.id ? "var(--parchment)" : "var(--surface2)",
              border: value === opt.id ? "2px solid #513229" : "1.5px solid var(--border)",
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            <div className="font-semibold">{opt.label}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{opt.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
