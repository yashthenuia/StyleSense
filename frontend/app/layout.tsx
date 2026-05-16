import type { Metadata } from "next";
import "./globals.css";
import "@runwayml/avatars-react/styles.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Toaster } from "@/components/ui/Toast";
import { AuthProvider } from "@/components/AuthProvider";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "StyleAI — Your Digital Runway",
  description: "AI-powered wardrobe and virtual try-on. Compose looks, see them on your avatar, animate them as video, and ask an AI stylist that actually knows your closet.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  let profile = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    profile = data;
  }

  return (
    <html lang="en">
      <body>
        <AuthProvider initialUser={user} initialProfile={profile}>
          {user ? (
            <div className="flex min-h-screen">
              <Sidebar />
              <div className="flex-1 flex flex-col" style={{ marginLeft: "var(--sidebar-width)" }}>
                <Topbar />
                <main className="flex-1 px-8 pt-6 pb-16">{children}</main>
              </div>
            </div>
          ) : (
            // Login/signup pages render without sidebar
            <>{children}</>
          )}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
