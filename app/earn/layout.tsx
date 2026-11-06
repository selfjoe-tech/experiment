import type { ReactNode } from "react";
import DesktopShell from "@/app/components/feed/layout/DesktopShell";
import MobileChrome from "@/app/components/feed/layout/MobileChrome";

export default function EarnLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#0b0d10] text-white">
    <DesktopShell/>
    <MobileChrome/>
    {children}
  </div>;
}
