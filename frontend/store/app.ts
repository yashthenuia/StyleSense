"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  selectedItemIds: string[]; // Studio multi-select (max 2)
  toggleSelected: (id: string) => void;
  clearSelected: () => void;
  setSelected: (ids: string[]) => void;
  // Cached avatar (synced from /users row, mirror in localStorage for instant UI)
  avatarCharacterId: string | null;
  avatarSelfieUrl: string | null;
  setAvatar: (characterId: string | null, selfieUrl: string | null) => void;
  setSelfieOnly: (selfieUrl: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedItemIds: [],
      avatarCharacterId: null,
      avatarSelfieUrl: null,
      toggleSelected: (id) =>
        set((s) => ({
          selectedItemIds: s.selectedItemIds.includes(id)
            ? s.selectedItemIds.filter((x) => x !== id)
            : [...s.selectedItemIds, id].slice(-2),
        })),
      clearSelected: () => set({ selectedItemIds: [] }),
      setSelected: (ids) => set({ selectedItemIds: ids.slice(0, 2) }),
      setAvatar: (characterId, selfieUrl) =>
        set({ avatarCharacterId: characterId, avatarSelfieUrl: selfieUrl }),
      setSelfieOnly: (selfieUrl) => set({ avatarSelfieUrl: selfieUrl }),
    }),
    {
      name: "styleai-app-state",
      partialize: (s) => ({
        avatarCharacterId: s.avatarCharacterId,
        avatarSelfieUrl: s.avatarSelfieUrl,
      }),
    }
  )
);
