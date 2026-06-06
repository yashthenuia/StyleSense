import type { Metadata } from "next";

export const metadata: Metadata = { title: "Avatar Setup" };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
