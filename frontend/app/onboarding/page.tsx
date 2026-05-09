"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, Check, Loader2, Camera, Sparkles, Info } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/store/app";
import { useAuth } from "@/components/AuthProvider";
import { apiPost, apiUpload } from "@/lib/api";
import { toast } from "@/components/ui/Toast";

export default function OnboardingPage() {
  const { user } = useAuth();
  const { avatarSelfieUrl, avatarCharacterId, setAvatar, setSelfieOnly } = useAppStore();
  const [uploading, setUploading] = useState(false);
  const [creatingChar, setCreatingChar] = useState(false);
  const [manualId, setManualId] = useState("");
  const [fallbackInfo, setFallbackInfo] = useState<{ instructions_text?: string; fallback?: string } | null>(null);

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

  async function createCharacter() {
    if (!avatarSelfieUrl) return;
    setCreatingChar(true);
    setFallbackInfo(null);
    try {
      const res = await apiPost<{ character_id: string }>("/api/avatar/create-character", {
        selfie_url: avatarSelfieUrl,
        name: "My Stylist",
      });
      setAvatar(res.character_id, avatarSelfieUrl);
      toast.success("Character created!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Backend returns structured fallback when programmatic creation isn't available
      try {
        const parsed = JSON.parse(msg);
        setFallbackInfo(parsed);
      } catch {
        setFallbackInfo({ fallback: msg });
      }
      toast.info("Programmatic character creation unavailable. See manual fallback below.");
    } finally {
      setCreatingChar(false);
    }
  }

  async function saveManualCharId() {
    if (!manualId.trim()) return;
    const fd = new FormData();
    fd.append("character_id", manualId.trim());
    try {
      await apiUpload("/api/avatar/save-character-id", fd);
      setAvatar(manualId.trim(), avatarSelfieUrl);
      toast.success("Character ID saved.");
      setFallbackInfo(null);
    } catch (e) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Step 1"
        title="Create your avatar."
        subtitle="One selfie. Front-facing, good lighting. Your avatar will look like you across every try-on and chat."
      />

      {/* Step 1: Selfie upload */}
      <Step
        n={1}
        title="Upload your selfie"
        done={!!avatarSelfieUrl}
        active={!avatarSelfieUrl}
      >
        <div className="flex items-center gap-6">
          <SelfieDropzone onFile={handleUpload} loading={uploading} preview={avatarSelfieUrl} />
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            <p className="mb-2 font-medium" style={{ color: "var(--text)" }}>Tips for best results:</p>
            <ul className="space-y-1" style={{ paddingLeft: "1rem", listStyle: "disc" }}>
              <li>Front-facing, shoulders visible</li>
              <li>Even lighting, plain background</li>
              <li>Minimum 512×512 pixels</li>
              <li>JPEG, PNG, or WebP (max 16MB)</li>
            </ul>
          </div>
        </div>
      </Step>

      {/* Step 2: Create character */}
      <Step
        n={2}
        title="Create your AI stylist character"
        done={!!avatarCharacterId}
        active={!!avatarSelfieUrl && !avatarCharacterId}
        disabled={!avatarSelfieUrl}
      >
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          We&apos;ll create a Runway Custom Character from your selfie. This gives you a talking avatar
          on the AI Stylist page that knows your wardrobe.
        </p>
        <button
          className="btn-primary"
          onClick={createCharacter}
          disabled={!avatarSelfieUrl || creatingChar || !!avatarCharacterId}
        >
          {creatingChar ? <><Loader2 size={16} className="spin" /> Creating...</> :
           avatarCharacterId ? <><Check size={16} /> Created</> :
           <><Sparkles size={16} /> Create character</>}
        </button>

        {fallbackInfo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="surface p-5 mt-5"
            style={{ borderColor: "var(--border-gold)" }}
          >
            <div className="flex items-start gap-2 mb-3">
              <Info size={16} style={{ color: "var(--gold)", flexShrink: 0, marginTop: 2 }} />
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                {fallbackInfo.fallback || "Programmatic character creation isn't available. Use the manual portal flow:"}
              </div>
            </div>
            <ol className="text-sm mb-3" style={{ color: "var(--text)", paddingLeft: "1.2rem", listStyle: "decimal" }}>
              <li>Open <a href="https://dev.runwayml.com" target="_blank" rel="noreferrer" style={{ color: "var(--gold)", textDecoration: "underline" }}>dev.runwayml.com</a> → Characters → Create Character.</li>
              <li>Upload your selfie. Use the instructions text below as the system prompt.</li>
              <li>Copy the resulting character UUID and paste it here.</li>
            </ol>
            {fallbackInfo.instructions_text && (
              <details className="mb-3">
                <summary className="text-sm cursor-pointer" style={{ color: "var(--gold)" }}>
                  View suggested instructions text
                </summary>
                <pre className="text-xs mt-2 p-3 whitespace-pre-wrap" style={{ background: "var(--bg)", borderRadius: 8, color: "var(--text-muted)", maxHeight: 200, overflow: "auto" }}>
                  {fallbackInfo.instructions_text}
                </pre>
              </details>
            )}
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Paste character UUID here"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
              />
              <button className="btn-secondary" onClick={saveManualCharId} disabled={!manualId.trim()}>
                Save
              </button>
            </div>
          </motion.div>
        )}
      </Step>

      {/* Step 3: Sync wardrobe */}
      <Step
        n={3}
        title="Sync wardrobe to stylist (optional)"
        done={false}
        active={!!avatarCharacterId}
        disabled={!avatarCharacterId}
      >
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Once you&apos;ve added items to your wardrobe, sync them to your stylist&apos;s knowledge base so it can recommend specific items by name.
        </p>
        <button
          className="btn-secondary"
          disabled={!avatarCharacterId}
          onClick={async () => {
            try {
              const res = await apiPost<{ uploaded: boolean; item_count: number }>(
                "/api/avatar/sync-wardrobe-knowledge",
                {}
              );
              toast.success(
                res.uploaded
                  ? `Synced ${res.item_count} items to stylist.`
                  : `Generated knowledge for ${res.item_count} items (manual upload needed).`
              );
            } catch (e) {
              toast.error(`Sync failed: ${e instanceof Error ? e.message : "unknown"}`);
            }
          }}
        >
          Sync wardrobe knowledge
        </button>
      </Step>
    </div>
  );
}

function Step({
  n, title, done, active, disabled, children,
}: {
  n: number; title: string; done: boolean; active: boolean;
  disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: disabled ? 0.5 : 1, y: 0 }}
      className="surface p-7 mb-5"
      style={{
        borderColor: active ? "var(--border-gold)" : "var(--border)",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
          style={{
            background: done ? "var(--gold)" : active ? "var(--gold-dim)" : "var(--surface3)",
            color: done ? "var(--bg)" : active ? "var(--gold)" : "var(--text-dim)",
          }}
        >
          {done ? <Check size={16} /> : n}
        </div>
        <h2 className="font-display text-2xl">{title}</h2>
      </div>
      {children}
    </motion.section>
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
      style={{ width: 200, height: 200, borderStyle: preview ? "solid" : "dashed" }}
    >
      {loading ? (
        <Loader2 size={28} className="spin" style={{ color: "var(--gold)" }} />
      ) : preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Selfie preview" className="w-full h-full object-cover" />
      ) : (
        <div className="text-center" style={{ color: "var(--text-dim)" }}>
          <Camera size={28} className="mx-auto mb-2" />
          <div className="text-xs">Click to upload selfie</div>
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
