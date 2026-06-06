"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Copy, Check, Loader2, Sparkles, Users, MessagesSquare, User, Menu, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "@/components/ui/Toast";
import { useTasks, selectRunningCount } from "@/store/tasks";
import { getSupabaseBrowser } from "@/lib/supabase/client";

const PRIMARY_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/wardrobe",  label: "Wardrobe" },
  { href: "/studio",    label: "Studio" },
  { href: "/outfits",   label: "Outfits" },
  { href: "/stylist",   label: "Aria" },
];

export function Topbar({ onBrandClick }: { onBrandClick?: () => void }) {
  const { user, profile, signOut } = useAuth();
  const pathname = usePathname();
  const supabase = getSupabaseBrowser();
  const [open, setOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pendingFriends, setPendingFriends] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const runningCount = useTasks(selectRunningCount);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    async function load() {
      const [friendsRes, msgsRes] = await Promise.all([
        supabase.from("friendships").select("id", { count: "exact", head: true })
          .eq("addressee_id", user!.id).eq("status", "pending"),
        supabase.from("messages").select("id", { count: "exact", head: true })
          .eq("recipient_id", user!.id).is("read_at", null),
      ]);
      if (!mounted) return;
      setPendingFriends(friendsRes.count ?? 0);
      setUnreadMsgs(msgsRes.count ?? 0);
    }
    load();

    const channel = supabase
      .channel(`topbar:${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        () => setUnreadMsgs((n) => n + 1))
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "friendships", filter: `addressee_id=eq.${user.id}` },
        () => setPendingFriends((n) => n + 1))
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [user, supabase]);

  function copyShareCode() {
    if (!profile?.share_code) return;
    navigator.clipboard.writeText(profile.share_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Share code copied!");
  }

  const initial = (profile?.full_name?.[0] || user?.email?.[0] || "?").toUpperCase();

  return (
    <>
      <header
        className="flex items-center px-4 md:px-8 py-4 relative gap-4 md:gap-6 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {/* LEFT — Brand + tasks */}
        <div id="topbar-brand-group" className="flex items-center gap-2 md:gap-4 min-w-0 cursor-pointer" onClick={onBrandClick}>
          <Link href="/dashboard" className="font-display tracking-tight" style={{ color: "var(--gold)", fontSize: "clamp(1.2rem, 4vw, 1.6rem)", textDecoration: "none" }}>
            StyleSense
          </Link>
          {runningCount > 0 && (
            <Link
              href="/studio"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
              style={{
                background: "var(--gold-dim)",
                border: "1px solid var(--border-gold)",
                color: "var(--gold)",
                textDecoration: "none",
              }}
              title="Click to view in Studio"
            >
              <Loader2 size={12} className="spin" />
              <span>{runningCount} {runningCount === 1 ? "task" : "tasks"} running</span>
              <Sparkles size={11} />
            </Link>
          )}
        </div>

        {/* CENTER — Primary nav (hidden on mobile) */}
        <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1">
          {PRIMARY_NAV.map(({ href, label }) => {
            const active = href === "/dashboard" ? pathname === "/dashboard" : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={
                  active
                    ? "bg-[#eae4da] text-[#301c10] border-transparent font-bold rounded-xl px-4 py-2 text-sm transition-all"
                    : "bg-transparent border-2 border-[#301c10] text-[#301c10] hover:bg-[#301c10]/5 font-normal rounded-xl px-4 py-2 text-sm transition-all"
                }
                style={{ textDecoration: "none" }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT — Mobile menu + Friends, Chat, Avatar */}
        <div className="ml-auto flex items-center gap-1 md:gap-2">
          {/* Mobile hamburger menu button */}
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden w-10 h-10 flex items-center justify-center transition-colors"
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link
            href="/friends"
            title="Friends"
            aria-label="Friends"
            className="relative w-10 h-10 flex items-center justify-center rounded-[10px] transition-colors"
            style={{
              color: pathname?.startsWith("/friends") ? "var(--gold)" : "var(--text-muted)",
              background: pathname?.startsWith("/friends") ? "var(--gold-dim)" : "transparent",
            }}
          >
            <Users size={18} strokeWidth={1.6} />
            {pendingFriends > 0 && (
              <span
                className="absolute top-1 right-1 text-[10px] font-semibold px-1 rounded-full"
                style={{ background: "var(--gold)", color: "var(--on-gold)", minWidth: 16, textAlign: "center" }}
              >
                {pendingFriends}
              </span>
            )}
          </Link>

          <Link
            href="/chat"
            title="Chat"
            aria-label="Chat"
            className="relative w-10 h-10 flex items-center justify-center rounded-[10px] transition-colors"
            style={{
              color: pathname?.startsWith("/chat") ? "var(--gold)" : "var(--text-muted)",
              background: pathname?.startsWith("/chat") ? "var(--gold-dim)" : "transparent",
            }}
          >
            <MessagesSquare size={18} strokeWidth={1.6} />
            {unreadMsgs > 0 && (
              <span
                className="absolute top-1 right-1 text-[10px] font-semibold px-1 rounded-full"
                style={{ background: "var(--gold)", color: "var(--on-gold)", minWidth: 16, textAlign: "center" }}
              >
                {unreadMsgs}
              </span>
            )}
          </Link>

          <div ref={ref} className="relative ml-1 md:ml-2">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-3 cursor-pointer"
              style={{ background: "none", border: "none", color: "var(--text)" }}
            >
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
                <Link
                  href="/onboarding"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm"
                  style={{ color: "var(--text)", textDecoration: "none", borderRadius: 8 }}
                >
                  <User size={14} /> Avatar Setup
                </Link>
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
        </div>
      </header>

      {/* Mobile nav menu */}
      {mobileMenuOpen && (
        <nav className="md:hidden shrink-0 surface border-b" style={{ borderColor: "var(--border)" }}>
          <div className="px-4 py-2 space-y-1">
            {PRIMARY_NAV.map(({ href, label }) => {
              const active = href === "/dashboard" ? pathname === "/dashboard" : pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={
                    active
                      ? "block bg-[#eae4da] text-[#301c10] font-bold rounded-xl px-4 py-2.5 text-sm transition-all"
                      : "block bg-transparent border-2 border-[#301c10] text-[#301c10] font-normal rounded-xl px-4 py-2.5 text-sm transition-all"
                  }
                  style={{ textDecoration: "none" }}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
