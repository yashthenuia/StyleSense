import type { Metadata } from "next";

export const metadata: Metadata = { title: "Aria" };

export default function StylistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
