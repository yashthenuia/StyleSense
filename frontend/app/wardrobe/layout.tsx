import type { Metadata } from "next";

export const metadata: Metadata = { title: "Wardrobe" };

export default function WardrobeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
