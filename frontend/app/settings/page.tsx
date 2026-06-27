"use client";
import { motion } from "framer-motion";
import { LogOut, User } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/store/app";
import { useAuth } from "@/components/AuthProvider";
import { TRYON_MODELS, VIDEO_MODELS } from "@/lib/models";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { tryonModel, videoModel, setTryonModel, setVideoModel } = useAppStore();

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

        {/* Account */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="surface p-7 mb-6"
        >
          <h2 className="font-display text-2xl mb-1">Account</h2>
          <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>{user?.email}</p>

          <div className="flex items-center gap-3">
            <Link
              href="/onboarding"
              className="btn-secondary flex items-center gap-2"
              style={{ textDecoration: "none" }}
            >
              <User size={15} /> Edit your look
            </Link>
            <button
              className="btn-secondary flex items-center gap-2"
              onClick={signOut}
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
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
