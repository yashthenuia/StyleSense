import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StyleSense — AI Wardrobe & Virtual Try-On",
    short_name: "StyleSense",
    description: "AI-powered wardrobe, virtual try-on, and personal stylist.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f1ea",
    theme_color: "#c9a84c",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
