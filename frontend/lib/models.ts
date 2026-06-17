// Shared catalog of selectable Runway models for try-on (image) and video.
// Mirrored server-side by an allowlist in backend/services/runway_service.py.
// Verified against docs.dev.runwayml.com (June 2026).

export type ModelTier = "fast" | "standard" | "premium";

export interface ModelOption {
  id: string;
  label: string;
  blurb: string;
  tier: ModelTier;
}

// Try-on / image generation models. gen4_image is the default.
export const TRYON_MODELS: ModelOption[] = [
  { id: "gen4_image_turbo", label: "Gen-4 Turbo", blurb: "Fast & cheap draft quality", tier: "fast" },
  { id: "gen4_image", label: "Gen-4", blurb: "Balanced default quality", tier: "standard" },
  { id: "gemini_image3_pro", label: "Gemini 3 Pro", blurb: "Best identity, many references", tier: "premium" },
  { id: "gpt_image_2", label: "GPT Image 2", blurb: "Strong prompt control", tier: "premium" },
  { id: "gemini_2.5_flash", label: "Gemini 2.5 Flash", blurb: "Quick image generation", tier: "fast" },
];

// Image-to-video models. veo3.1 is the default.
export const VIDEO_MODELS: ModelOption[] = [
  { id: "veo3.1", label: "Veo 3.1", blurb: "Realistic default motion", tier: "standard" },
  { id: "veo3.1_fast", label: "Veo 3.1 Fast", blurb: "Faster, lower cost", tier: "fast" },
  { id: "seedance2", label: "Seedance 2.0", blurb: "Consistent character motion", tier: "premium" },
  { id: "seedance2_fast", label: "Seedance 2.0 Fast", blurb: "Faster Seedance", tier: "standard" },
  { id: "gen4.5", label: "Gen-4.5", blurb: "Runway native fallback", tier: "standard" },
];

export const DEFAULT_TRYON_MODEL = "gen4_image";
export const DEFAULT_VIDEO_MODEL = "veo3.1";
