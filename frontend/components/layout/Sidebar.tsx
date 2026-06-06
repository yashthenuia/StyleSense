"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Shirt, Sparkles, BookMarked, MessageCircle, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", icon: Home,          label: "Dashboard" },
  { href: "/wardrobe",  icon: Shirt,         label: "Wardrobe"  },
  { href: "/studio",    icon: Sparkles,      label: "Studio"    },
  { href: "/outfits",   icon: BookMarked,    label: "Outfits"   },
  { href: "/stylist",   icon: MessageCircle, label: "Aria"      },
];

interface SidebarProps {
  isOpen?: boolean;
}

export function Sidebar({ isOpen = true }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={[
        "flex flex-col items-center py-4 shrink-0 transition-all duration-300 border-r",
        isOpen
          ? "w-16 opacity-100"
          : "w-0 opacity-0 overflow-hidden border-r-0 pointer-events-none",
      ].join(" ")}
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <nav className="flex flex-col items-center gap-1 flex-1 w-full px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className="w-full flex items-center justify-center rounded-lg transition-colors"
              style={{
                height: 44,
                color: active ? "var(--gold)" : "var(--text-muted)",
                background: active ? "var(--gold-dim)" : "transparent",
                textDecoration: "none",
              }}
            >
              <Icon className="w-5 h-5 shrink-0" />
            </Link>
          );
        })}
      </nav>

      <div className="w-full px-2">
        <Link
          href="/settings"
          title="Settings"
          aria-label="Settings"
          className="w-full flex items-center justify-center rounded-lg transition-colors"
          style={{ height: 44, color: "var(--text-dim)", textDecoration: "none" }}
        >
          <Settings className="w-5 h-5 shrink-0" />
        </Link>
      </div>
    </aside>
  );
}
