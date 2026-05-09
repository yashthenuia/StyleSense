"use client";
import { useEffect, useRef, useState } from "react";
import { LogOut, Copy, Check } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "@/components/ui/Toast";

export function Topbar() {
  const { user, profile, signOut } = useAuth();
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${url}/health`).then((r) => setHealthy(r.ok)).catch(() => setHealthy(false));
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function copyShareCode() {
    if (!profile?.share_code) return;
    navigator.clipboard.writeText(profile.share_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Share code copied!");
  }

  const initial = (profile?.full_name?.[0] || user?.email?.[0] || "?").toUpperCase();

  return (
    <header
      className="flex items-center justify-between px-8 py-4 relative"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-3 text-sm" style={{ color: "var(--text-muted)" }}>
        <span style={{
          width: 6, height: 6, borderRadius: 999,
          background: healthy ? "var(--green)" : healthy === false ? "var(--red)" : "var(--text-dim)",
        }} />
        <span>{healthy ? "Backend connected" : healthy === false ? "Backend offline" : "Connecting..."}</span>
      </div>

      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 cursor-pointer"
          style={{ background: "none", border: "none", color: "var(--text)" }}
        >
          <div className="text-right">
            <div className="text-sm font-medium">{profile?.full_name || user?.email?.split("@")[0]}</div>
            <div className="text-xs" style={{ color: "var(--text-dim)" }}>{user?.email}</div>
          </div>
          <div
            className="rounded-full flex items-center justify-center font-semibold text-sm"
            style={{
              width: 36, height: 36,
              background: "var(--gold-dim)",
              color: "var(--gold)",
              border: "1px solid var(--border-gold)",
            }}
          >
            {initial}
          </div>
        </button>

        {open && (
          <div
            className="absolute right-0 top-full mt-2 surface p-2 min-w-[260px]"
            style={{ zIndex: 50 }}
          >
            {profile?.share_code && (
              <button
                onClick={copyShareCode}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md hover:bg-surface3 text-left"
                style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer", borderRadius: 8 }}
              >
                <div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>Your share code</div>
                  <div className="font-mono text-sm" style={{ color: "var(--gold)", letterSpacing: "0.1em" }}>
                    {profile.share_code}
                  </div>
                </div>
                {copied ? <Check size={14} color="var(--green)" /> : <Copy size={14} />}
              </button>
            )}
            <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm"
              style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer", borderRadius: 8 }}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
