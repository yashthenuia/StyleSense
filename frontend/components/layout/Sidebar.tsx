"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Home, Shirt, Sparkles, MessageCircle, Layers, User, Users, MessagesSquare,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";

const NAV = [
  { href: "/",          label: "Dashboard",   Icon: Home },
  { href: "/wardrobe",  label: "Wardrobe",    Icon: Shirt },
  { href: "/studio",    label: "Studio",      Icon: Sparkles },
  { href: "/outfits",   label: "Outfits",     Icon: Layers },
  { href: "/stylist",   label: "AI Stylist",  Icon: MessageCircle },
  { href: "/friends",   label: "Friends",     Icon: Users },
  { href: "/chat",      label: "Chat",        Icon: MessagesSquare },
  { href: "/onboarding",label: "Avatar Setup",Icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const supabase = getSupabaseBrowser();
  const [pendingFriends, setPendingFriends] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);

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

    // Realtime: bump counters when new friend request or message arrives
    const channel = supabase
      .channel(`sidebar:${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        () => setUnreadMsgs((n) => n + 1))
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "friendships", filter: `addressee_id=eq.${user.id}` },
        () => setPendingFriends((n) => n + 1))
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [user, supabase]);

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col"
      style={{
        width: "var(--sidebar-width)",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
      }}
    >
      <div className="px-6 py-7">
        <h1 className="font-display text-3xl tracking-tight" style={{ color: "var(--gold)" }}>
          StyleAI
        </h1>
        <p className="text-xs mt-1" style={{ color: "var(--text-dim)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Editorial Wardrobe
        </p>
      </div>

      <nav className="flex-1 px-3 mt-2 overflow-y-auto">
        {NAV.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
          const badge =
            href === "/friends" ? pendingFriends :
            href === "/chat"    ? unreadMsgs :
            0;
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] mb-1 transition-all"
              style={{
                color: active ? "var(--gold)" : "var(--text-muted)",
                background: active ? "var(--gold-dim)" : "transparent",
                borderLeft: active ? "2px solid var(--gold)" : "2px solid transparent",
              }}
            >
              <Icon size={18} strokeWidth={1.6} />
              <span className="text-sm font-medium flex-1">{label}</span>
              {badge > 0 && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: "var(--gold)", color: "var(--bg)", minWidth: 18, textAlign: "center" }}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-5 mt-auto" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="dot-gold" />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Powered by Runway</span>
        </div>
      </div>
    </aside>
  );
}
