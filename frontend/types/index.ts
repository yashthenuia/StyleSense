export interface WardrobeItem {
  id: string;
  user_id: string;
  name: string;
  category: "tops" | "bottoms" | "dresses" | "outerwear" | "shoes" | "accessories";
  occasion?: "casual" | "formal" | "evening" | "sport" | "beach" | "any";
  color?: string | null;
  brand?: string | null;
  tags: string[];
  image_url: string;
  source_url?: string | null;
  created_at: string;
}

export interface TryOnResult {
  id: string;
  user_id: string;
  wardrobe_item_id: string | null;
  result_image_url: string;
  result_video_url: string | null;
  event_scene_url: string | null;
  event_context: string | null;
  prompt_used: string | null;
  model_used: string | null;
  status: "pending" | "processing" | "done" | "failed";
  created_at: string;
}

export interface Outfit {
  id: string;
  user_id: string;
  name: string;
  item_ids: string[];
  occasion: string | null;
  preview_image_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestedItemIds?: string[];
}

export interface DetectedItem {
  name: string;
  category: WardrobeItem["category"];
  color?: string | null;
  brand?: string | null;
  occasion?: WardrobeItem["occasion"];
  position?: string | null;
}
