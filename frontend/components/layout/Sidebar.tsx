"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Home, Shirt, Sparkles, Layers, MessageCircle } from "lucide-react";

const NAV = [
  { href: "/",         label: "Dashboard",  Icon: Home },
  { href: "/wardrobe", label: "Wardrobe",   Icon: Shirt },
  { href: "/studio",   label: "Studio",     Icon: Sparkles },
  { href: "/outfits",  label: "Outfits",    Icon: Layers },
  { href: "/stylist",  label: "AI Stylist", Icon: MessageCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const hidden = pathname?.startsWith("/studio");

  // Studio gets full-bleed canvas — collapse the sidebar gutter entirely.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      hidden ? "0px" : "64px"
    );
  }, [hidden]);

  if (hidden) return null;

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col items-center py-6"
      style={{
        width: "var(--sidebar-width)",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
      }}
    >
      <nav className="flex-1 flex flex-col items-center gap-1 mt-2">
        {NAV.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className="w-10 h-10 flex items-center justify-center rounded-[10px] transition-all"
              style={{
                color: active ? "var(--gold)" : "var(--text-muted)",
                background: active ? "var(--gold-dim)" : "transparent",
              }}
            >
              <Icon size={18} strokeWidth={1.6} />
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center justify-center" title="Powered by Runway">
        <span className="dot-gold" />
      </div>
    </aside>
  );
}
