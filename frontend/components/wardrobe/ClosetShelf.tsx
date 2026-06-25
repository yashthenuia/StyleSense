"use client";
import { useRef } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import type { WardrobeItem } from "@/types";

// One category "shelf": a horizontal, swipeable row of garments standing on a
// wooden plank. Items are transparent cutouts (cutout_url) so they appear to
// float; falls back to the white-bg image_url if a cutout isn't ready yet.
export function ClosetShelf({
  label,
  items,
  selectedItemIds,
  onSelect,
  onDelete,
}: {
  label: string;
  items: WardrobeItem[];
  selectedItemIds: string[];
  onSelect: (id: string) => void;
  onDelete: (item: WardrobeItem) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  function scrollBy(dir: 1 | -1) {
    scroller.current?.scrollBy({ left: dir * 360, behavior: "smooth" });
  }

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-baseline gap-2">
          <h3 className="font-display capitalize" style={{ fontSize: "1.35rem", color: "#f3e8d4", letterSpacing: "0.02em" }}>
            {label}
          </h3>
          <span style={{ color: "rgba(243,232,212,0.45)", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {items.length}
          </span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => scrollBy(-1)} className="closet-chevron" aria-label="Scroll left">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => scrollBy(1)} className="closet-chevron" aria-label="Scroll right">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* the shelf: items row + wooden plank beneath */}
      <div className="relative">
        <div
          ref={scroller}
          className="flex gap-5 overflow-x-auto pb-5 pt-2 px-2 closet-scroller"
          style={{ scrollSnapType: "x proximity" }}
        >
          {items.map((item) => {
            const selected = selectedItemIds.includes(item.id);
            const order = selectedItemIds.indexOf(item.id) + 1;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                title={item.name}
                className="closet-item group relative shrink-0 flex flex-col items-center justify-end"
                style={{ scrollSnapAlign: "start", width: 150, height: 210 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.cutout_url || item.image_url}
                  alt={item.name}
                  className="closet-cutout"
                  style={{
                    maxHeight: 180,
                    maxWidth: 140,
                    objectFit: "contain",
                    filter: selected
                      ? "drop-shadow(0 12px 10px rgba(0,0,0,0.5)) drop-shadow(0 0 10px var(--gold-glow))"
                      : "drop-shadow(0 12px 10px rgba(0,0,0,0.45))",
                  }}
                />
                {selected && (
                  <div
                    className="absolute top-0 right-2 w-6 h-6 rounded-full flex items-center justify-center font-bold"
                    style={{ background: "var(--gold)", color: "var(--on-gold)", fontSize: "0.7rem", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
                  >
                    {order}
                  </div>
                )}
                <button
                  className="absolute top-0 left-2 opacity-0 group-hover:opacity-100 transition w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(20,14,10,0.7)", color: "#f3e8d4", border: "none", cursor: "pointer" }}
                  onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                  aria-label="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </button>
            );
          })}
        </div>
        {/* wooden plank */}
        <div className="closet-plank" />
      </div>
    </div>
  );
}
