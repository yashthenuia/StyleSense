"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, Camera, LogOut } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/store/app";
import { useAuth } from "@/components/AuthProvider";
import { apiUpload } from "@/lib/api";
import { toast } from "@/components/ui/Toast";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { avatarSelfieUrl, avatarHeroVideoUrl, setSelfieOnly } = useAppStore();
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiUpload<{ selfie_url: string }>("/api/avatar/upload-selfie", fd);
      setSelfieOnly(res.selfie_url);
      toast.success("Selfie uploaded.");
    } catch (e) {
      toast.error(`Upload failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        eyebrow="Preferences"
        tutorialKey="settings"
        subtitle="Manage your avatar and account."
      />

      {/* Your Avatar section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="surface p-7 mb-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
            style={{
              background: avatarSelfieUrl ? "var(--gold)" : "var(--surface3)",
              color: avatarSelfieUrl ? "var(--bg)" : "var(--text-dim)",
            }}
          >
            {avatarSelfieUrl ? <Check size={16} /> : "1"}
          </div>
          <h2 className="font-display text-2xl">Your Avatar</h2>
        </div>

        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Upload a clear selfie. We&apos;ll auto-generate a looping cinematic video for your dashboard.
        </p>

        <div className="flex items-start gap-6">
          <SelfieDropzone onFile={handleUpload} loading={uploading} preview={avatarSelfieUrl} />

          {avatarHeroVideoUrl && (
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text-dim)" }}>
                Your avatar video
              </div>
              <div
                className="rounded-xl overflow-hidden"
                style={{ width: 220, height: 140, background: "var(--surface2)" }}
              >
                <video
                  src={avatarHeroVideoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Account section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="surface p-7"
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
            style={{ background: "var(--surface3)", color: "var(--text-dim)" }}
          >
            2
          </div>
          <h2 className="font-display text-2xl">Account</h2>
        </div>

        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          {user?.email}
        </p>
        <button
          className="btn-secondary"
          onClick={() => {
            signOut();
          }}
        >
          <LogOut size={16} /> Sign out
        </button>
      </motion.div>
    </div>
  );
}

function SelfieDropzone({
  onFile, loading, preview,
}: {
  onFile: (f: File) => void; loading: boolean; preview: string | null;
}) {
  return (
    <label
      className="surface flex items-center justify-center cursor-pointer overflow-hidden"
      style={{ width: 160, height: 160, borderStyle: preview ? "solid" : "dashed" }}
    >
      {loading ? (
        <Loader2 size={28} className="spin" style={{ color: "var(--gold)" }} />
      ) : preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Selfie preview" className="w-full h-full object-cover" />
      ) : (
        <div className="text-center" style={{ color: "var(--text-dim)" }}>
          <Camera size={28} className="mx-auto mb-2" />
          <div className="text-xs">Click to upload</div>
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
