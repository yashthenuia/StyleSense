"use client";
import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Sidebar } from "@/components/layout/Sidebar";

export function LayoutClient({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Topbar onBrandClick={() => setIsSidebarOpen((v) => !v)} />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} />
        <main className="flex-1 min-h-0 overflow-y-auto px-8 pt-6 pb-16">{children}</main>
      </div>
    </div>
  );
}
