"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage } from "@/types";

/**
 * Aria chat history, persisted to localStorage so the conversation survives
 * navigation AND reloads. The stylist page seeds a greeting only when empty;
 * "New chat" calls reset(). History is client-side only (re-sent to /chat each
 * turn), so there's no backend involved.
 */
interface AriaChatState {
  messages: ChatMessage[];
  setMessages: (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  reset: () => void;
}

export const useAriaChat = create<AriaChatState>()(
  persist(
    (set) => ({
      messages: [],
      setMessages: (updater) =>
        set((s) => ({
          messages: typeof updater === "function" ? (updater as (p: ChatMessage[]) => ChatMessage[])(s.messages) : updater,
        })),
      reset: () => set({ messages: [] }),
    }),
    {
      name: "stylesense-aria-chat",
      // Clear any stuck "manifesting" spinners on rehydrate (the in-flight fetch
      // from a previous page load is gone).
      onRehydrateStorage: () => (state) => {
        if (state?.messages?.some((m) => m.manifesting)) {
          state.setMessages((prev) => prev.map((m) => (m.manifesting ? { ...m, manifesting: false } : m)));
        }
      },
    }
  )
);
