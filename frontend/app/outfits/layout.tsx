import type { Metadata } from "next";

export const metadata: Metadata = { title: "Outfits" };

export default function OutfitsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
