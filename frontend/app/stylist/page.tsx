"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, Sparkles, MessageCircle, Mic, Plus, Bookmark, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/store/app";
import { useAriaChat } from "@/store/ariaChat";
import { useAuth } from "@/components/AuthProvider";
import { apiGet, apiPost } from "@/lib/api";
import { toast } from "@/components/ui/Toast";
import type { ChatMessage, WardrobeItem } from "@/types";
import { AvatarWidget } from "@/components/stylist/AvatarWidget";

const SUGGESTION_PROMPTS = [
  "Dinner date that says 'I have taste'",
  "Main character energy for brunch",
  "Boardroom but make it fashion",
  "What goes well with my white t-shirt?",
  "Beach-day outfit from what I own",
];

export default function StylistPage() {
  const { user, profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0];
  const [tab, setTab] = useState<"chat" | "voice">("chat");
  // Chat history persists across navigation/reload (zustand + localStorage).
  const { messages, setMessages, reset } = useAriaChat();
  const greeting = (): ChatMessage => ({
    role: "assistant",
    content: firstName
      ? `Hey ${firstName}, I've studied every piece in your closet. What vibe are we creating today?`
      : "Hey — I've studied every piece in your closet. What vibe are we creating today?",
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Seed the greeting only when there's no existing conversation.
  useEffect(() => {
    if (messages.length === 0) setMessages([greeting()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, firstName]);

  function startNewChat() {
    reset();
    setMessages([greeting()]);
  }

  useEffect(() => {
    if (!user) return;
    apiGet<WardrobeItem[]>(`/api/wardrobe`).then(setItems).catch(() => {});
    // Face source for "Manifest": prefer the selfie, fall back to the full-body photo.
    Promise.all([
      apiGet<{ selfie_urls: string[]; primary_url: string | null }>("/api/avatar/selfies").catch(() => null),
      apiGet<{ full_body_url: string | null }>("/api/avatar/full-body").catch(() => null),
    ]).then(([s, b]) => {
      setSelfieUrl(s?.primary_url || s?.selfie_urls?.[0] || b?.full_body_url || null);
    });
  }, [user]);

  // Generate a try-on of Aria's recommended look, shown inline in that chat bubble.
  async function manifestLook(idx: number) {
    const msg = messages[idx];
    const picked = items.filter((it) => (msg.suggestedItemIds || []).includes(it.id));
    if (picked.length === 0) return;
    if (!selfieUrl) { toast.error("Add a selfie in Avatar Setup first."); return; }
    setMessages((prev) => prev.map((m, i) => (i === idx ? { ...m, manifesting: true } : m)));
    try {
      const res = await apiPost<{ result_image_url: string; result_id: string }>("/api/tryon/generate-multi", {
        avatar_selfie_url: selfieUrl,
        items: picked.map((it) => ({ image_url: it.image_url, name: it.name, category: it.category })),
        model: useAppStore.getState().tryonModel,
        setting: msg.scene || undefined,
        enhance_prompt: true,
      });
      setMessages((prev) => prev.map((m, i) => (i === idx ? { ...m, manifesting: false, manifestUrl: res.result_image_url, manifestId: res.result_id } : m)));
    } catch (e) {
      setMessages((prev) => prev.map((m, i) => (i === idx ? { ...m, manifesting: false } : m)));
      toast.error(`Manifest failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  // Save a manifested chat look to the Outfits section.
  async function saveManifestOutfit(idx: number) {
    const msg = messages[idx];
    const picked = items.filter((it) => (msg.suggestedItemIds || []).includes(it.id));
    if (!msg.manifestUrl || picked.length === 0) return;
    try {
      await apiPost("/api/outfits/save", {
        name: picked.map((it) => it.name).join(" + ").slice(0, 60) || "Aria's look",
        item_ids: picked.map((it) => it.id),
        preview_image_url: msg.manifestUrl,
        tryon_result_id: msg.manifestId,
        notes: "Saved from Aria chat",
      });
      setMessages((prev) => prev.map((m, i) => (i === idx ? { ...m, savedOutfit: true } : m)));
      toast.success("Saved to your Outfits.");
    } catch (e) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await apiPost<{ reply: string; suggested_item_ids: string[]; scene?: string | null }>(
        "/api/stylist/chat",
        {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }
      );
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply, suggestedItemIds: res.suggested_item_ids, scene: res.scene }]);
    } catch (e) {
      toast.error(`Stylist failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0">
        <PageHeader
          tutorialKey="stylist"
          subtitle="Ask anything — I know your full wardrobe and pick specific items."
        />

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <button
            className={`chip ${tab === "chat" ? "chip-active" : ""}`}
            onClick={() => setTab("chat")}
          >
            <MessageCircle size={12} style={{ marginRight: 6 }} /> Text chat
          </button>
          <button
            className={`chip ${tab === "voice" ? "chip-active" : ""}`}
            onClick={() => setTab("voice")}
          >
            <Mic size={12} style={{ marginRight: 6 }} /> Voice avatar
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-4">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8">
          {tab === "chat" ? (
            <div className="surface flex flex-col" style={{ height: 620 }}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Chat with Aria
                </span>
                <button
                  onClick={startNewChat}
                  className="text-xs flex items-center gap-1"
                  style={{ background: "none", border: "none", color: "var(--gold)", cursor: "pointer" }}
                  title="Start a new conversation"
                >
                  <Plus size={12} /> New chat
                </button>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-auto p-6 space-y-4">
                <AnimatePresence>
                  {messages.map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className="max-w-[80%] px-4 py-3 rounded-[12px]"
                        style={{
                          background: m.role === "user" ? "var(--gold-dim)" : "var(--surface2)",
                          border: m.role === "user" ? "1px solid var(--border-gold)" : "1px solid var(--border)",
                          color: "var(--text)",
                          whiteSpace: m.role === "user" ? "pre-wrap" : "normal",
                        }}
                      >
                        <FormattedReply
                          content={m.content}
                          itemIds={m.suggestedItemIds || []}
                          items={items}
                          manifesting={!!m.manifesting}
                          manifestUrl={m.manifestUrl}
                          savedOutfit={!!m.savedOutfit}
                          onManifest={selfieUrl ? () => manifestLook(i) : undefined}
                          onSaveOutfit={() => saveManifestOutfit(i)}
                        />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {loading && (
                  <div className="flex justify-start">
                    <div className="px-4 py-3 rounded-[12px]"
                         style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                      <Loader2 size={16} className="spin" style={{ color: "var(--gold)" }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="flex gap-2">
                  <input
                    className="input"
                    placeholder="Ask about an event, outfit, or color combo..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send(input)}
                    disabled={loading}
                  />
                  <button className="btn-primary" onClick={() => send(input)} disabled={!input.trim() || loading}>
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="surface flex flex-col" style={{ height: 620 }}>
              <div className="flex-1 overflow-hidden">
                <AvatarWidget />
              </div>
              {/* Type instead of speaking - auto-switches to text tab + sends */}
              <div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Or type your question
                </div>
                <div className="flex gap-2">
                  <input
                    className="input"
                    placeholder="Type and we'll switch to text mode..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && input.trim()) {
                        const text = input;
                        setTab("chat");
                        setTimeout(() => send(text), 50);
                      }
                    }}
                  />
                  <button
                    className="btn-primary"
                    onClick={() => {
                      if (!input.trim()) return;
                      const text = input;
                      setTab("chat");
                      setTimeout(() => send(text), 50);
                    }}
                    disabled={!input.trim()}
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="col-span-4">
          <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            Try asking
          </div>
          <div className="space-y-2 mb-6">
            {SUGGESTION_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  if (tab === "voice") {
                    setTab("chat");
                    setTimeout(() => send(p), 50);
                  } else {
                    send(p);
                  }
                }}
                disabled={loading}
                className="surface surface-hover w-full text-left text-sm px-4 py-3"
                style={{ display: "block" }}
              >
                <Sparkles size={12} style={{ display: "inline", marginRight: 8, color: "var(--gold)" }} />
                {p}
              </button>
            ))}
          </div>

          <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            Wardrobe context
          </div>
          <div className="surface p-4 text-sm">
            <div style={{ color: "var(--text)" }}>
              <strong>{items.length}</strong> items available
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              The stylist sees every item, color, brand and occasion to make picks.
            </div>
            <Link href="/wardrobe" className="text-xs mt-2 inline-block" style={{ color: "var(--gold)" }}>
              Manage wardrobe →
            </Link>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function FormattedReply({
  content, itemIds, items, manifesting, manifestUrl, savedOutfit, onManifest, onSaveOutfit,
}: {
  content: string;
  itemIds: string[];
  items: WardrobeItem[];
  manifesting?: boolean;
  manifestUrl?: string;
  savedOutfit?: boolean;
  onManifest?: () => void;
  onSaveOutfit?: () => void;
}) {
  // Strip the [ITEM:id] tokens from the displayed text (shown as cards below) and
  // tidy up so markdown bold still renders (e.g. "**[ITEM:x] Name**" -> "**Name**";
  // markdown ignores "** text**" with a space right after the **).
  const stripped = content
    .replace(/\s*\[ITEM:[a-zA-Z0-9\-]+\]\s*/g, " ")
    .replace(/\*\*\s+/g, "**")
    .replace(/\s+\*\*/g, "**")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  const referenced = items.filter((it) => itemIds.includes(it.id));
  return (
    <div>
      <div className="aria-md">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p style={{ margin: "0 0 0.5rem" }}>{children}</p>,
            ul: ({ children }) => <ul style={{ margin: "0.25rem 0 0.5rem", paddingLeft: "1.1rem", listStyle: "disc" }}>{children}</ul>,
            ol: ({ children }) => <ol style={{ margin: "0.25rem 0 0.5rem", paddingLeft: "1.2rem" }}>{children}</ol>,
            li: ({ children }) => <li style={{ margin: "0.1rem 0" }}>{children}</li>,
            strong: ({ children }) => <strong style={{ color: "var(--gold)" }}>{children}</strong>,
          }}
        >
          {stripped}
        </ReactMarkdown>
      </div>
      {referenced.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {referenced.map((it) => (
            <Link
              key={it.id}
              href="/studio"
              onClick={() => useAppStore.getState().setSelected([it.id])}
              className="flex items-center gap-2 px-2 py-1 rounded-md text-xs"
              style={{ background: "var(--surface3)", color: "var(--text)", textDecoration: "none" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.image_url} alt={it.name} style={{ width: 24, height: 24, objectFit: "cover", borderRadius: 4 }} />
              <span>{it.name}</span>
            </Link>
          ))}
        </div>
      )}

      {referenced.length > 0 && onManifest && (
        <div className="mt-3">
          {manifestUrl ? (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={manifestUrl}
                alt="Your look"
                style={{ width: "100%", maxWidth: 280, borderRadius: 10, display: "block" }}
              />
              {onSaveOutfit && (
                <button
                  className="btn-secondary mt-2"
                  onClick={onSaveOutfit}
                  disabled={savedOutfit}
                  style={{ padding: "0.4rem 0.8rem", fontSize: "0.78rem" }}
                >
                  {savedOutfit ? (<><Check size={13} /> Saved to Outfits</>) : (<><Bookmark size={13} /> Save to Outfits</>)}
                </button>
              )}
            </div>
          ) : (
            <button
              className="btn-primary"
              onClick={onManifest}
              disabled={manifesting}
              style={{ padding: "0.5rem 0.9rem", fontSize: "0.8rem" }}
            >
              {manifesting ? (
                <><Loader2 size={14} className="spin" /> Manifesting your look…</>
              ) : (
                <><Sparkles size={14} /> Manifest this look</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
