"use client";

import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b0d10] text-white">
      <DesktopShell />
      <MobileChrome />
      {children}
    </div>
  );
}
