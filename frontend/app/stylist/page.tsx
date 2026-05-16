"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Sparkles, MessageCircle, Mic } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppStore } from "@/store/app";
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: firstName
        ? `Hey ${firstName}, I've studied every piece in your closet. What vibe are we creating today?`
        : "Hey — I've studied every piece in your closet. What vibe are we creating today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    apiGet<WardrobeItem[]>(`/api/wardrobe`).then(setItems).catch(() => {});
  }, [user]);

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
      const res = await apiPost<{ reply: string; suggested_item_ids: string[] }>(
        "/api/stylist/chat",
        {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }
      );
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply, suggestedItemIds: res.suggested_item_ids }]);
    } catch (e) {
      toast.error(`Stylist failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="AI Stylist"
        title="Your personal stylist."
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

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8">
          {tab === "chat" ? (
            <div className="surface flex flex-col" style={{ height: 620 }}>
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
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        <FormattedReply
                          content={m.content}
                          itemIds={m.suggestedItemIds || []}
                          items={items}
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
  );
}

function FormattedReply({ content, itemIds, items }: { content: string; itemIds: string[]; items: WardrobeItem[] }) {
  // Strip the [ITEM:id] tokens from the displayed text but show them as cards below
  const stripped = content.replace(/\s*\[ITEM:[a-zA-Z0-9\-]+\]/g, "");
  const referenced = items.filter((it) => itemIds.includes(it.id));
  return (
    <div>
      <div>{stripped}</div>
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
              <span style={{ color: "var(--gold)" }}>Try on →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
