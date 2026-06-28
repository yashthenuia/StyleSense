"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  selectedItemIds: string[]; // Studio multi-select (max 6)
  toggleSelected: (id: string) => void;
  clearSelected: () => void;
  setSelected: (ids: string[]) => void;
  // Cached selfie URL (the user's primary selfie - used by try-on, dashboard avatar)
  // The stylist character is shared admin-side via STYLIST_CHARACTER_ID env var.
  avatarSelfieUrl: string | null;
  setSelfieOnly: (selfieUrl: string) => void;
  // Stylized full-body editorial-3D avatar (auto-generated from primary selfie).
  // Shown as the Studio idle hero + 'before' in the compare slider.
  stylizedAvatarUrl: string | null;
  stylizedAvatarStatus: "idle" | "generating" | "ready" | "failed" | "no_selfie" | null;
  setStylized: (url: string | null, status: AppState["stylizedAvatarStatus"]) => void;
  // Per-user ramp-walking video (chained after the still). Used as the
  // Dashboard hero once ready; until then the dashboard shows Aria's video.
  stylizedVideoUrl: string | null;
  stylizedVideoStatus: "idle" | "generating" | "ready" | "failed" | "no_selfie" | null;
  setStylizedVideo: (url: string | null, status: AppState["stylizedVideoStatus"]) => void;
  // User-selected Runway models for Studio (persisted). See frontend/lib/models.ts.
  tryonModel: string;
  videoModel: string;
  setTryonModel: (id: string) => void;
  setVideoModel: (id: string) => void;
  // Wipe per-user data (called when the signed-in account changes / on logout).
  // Keeps model preferences, which aren't user-identifying.
  resetUserData: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedItemIds: [],
      avatarSelfieUrl: null,
      stylizedAvatarUrl: null,
      stylizedAvatarStatus: null,
      stylizedVideoUrl: null,
      stylizedVideoStatus: null,
      tryonModel: "gen4_image",
      videoModel: "veo3.1",
      setTryonModel: (id) => set({ tryonModel: id }),
      setVideoModel: (id) => set({ videoModel: id }),
      toggleSelected: (id) =>
        set((s) => ({
          selectedItemIds: s.selectedItemIds.includes(id)
            ? s.selectedItemIds.filter((x) => x !== id)
            : [...s.selectedItemIds, id].slice(-6),
        })),
      clearSelected: () => set({ selectedItemIds: [] }),
      setSelected: (ids) => set({ selectedItemIds: ids.slice(0, 6) }),
      setSelfieOnly: (selfieUrl) => set({ avatarSelfieUrl: selfieUrl }),
      setStylized: (url, status) => set({ stylizedAvatarUrl: url, stylizedAvatarStatus: status }),
      setStylizedVideo: (url, status) => set({ stylizedVideoUrl: url, stylizedVideoStatus: status }),
      resetUserData: () => set({
        selectedItemIds: [],
        avatarSelfieUrl: null,
        stylizedAvatarUrl: null,
        stylizedAvatarStatus: null,
        stylizedVideoUrl: null,
        stylizedVideoStatus: null,
      }),
    }),
    {
      name: "styleai-app-state",
      partialize: (s) => ({
        avatarSelfieUrl: s.avatarSelfieUrl,
        stylizedAvatarUrl: s.stylizedAvatarUrl,
        stylizedAvatarStatus: s.stylizedAvatarStatus,
        stylizedVideoUrl: s.stylizedVideoUrl,
        stylizedVideoStatus: s.stylizedVideoStatus,
        tryonModel: s.tryonModel,
        videoModel: s.videoModel,
      }),
    }
  )
);
