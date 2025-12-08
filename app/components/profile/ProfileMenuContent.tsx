"use client";

import { getUserProfileFromCookies, logoutAction } from "@/lib/actions/auth";
import { ChevronRight, BarChart2, Bookmark, LogOut, Settings, User2, Users, FolderCog, Heart, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ACCENT = "pink";

const Row = ({
    icon: Icon,
    label,
    href
  }: {
    icon: React.ComponentType<any>;
    label: string;
    href: string
  }) => {
        const router = useRouter();
    return (
      <button
        type="button"
        className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-black/30 hover:bg-white/5 px-3 py-3"
        onClick={() => router.push(href)}
      >
      <span className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 opacity-80" />
        {label}
      </span>
      <ChevronRight className="h-4 w-4 opacity-60" />
    </button>
    )
    
  }

export default function ProfileMenuContent() {
  const router = useRouter();
    const [username, setUsername] = useState("")

  const handleLogout = async () => {
    await logoutAction();
    router.push("/");
    router.refresh();
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await getUserProfileFromCookies();
        if (!cancelled) {
          setUsername(result.username);

        }
      } catch (err) {
        console.error("Failed to load profile from cookies", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  
  // const avatarUrl = profile.avatarUrl; // if you want to show an avatar somewhere

  

  return (
    <div className="p-4 space-y-4">
      {/* header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-white/10" />
        <div className="min-w-0">
          <div className="font-semibold truncate">{username || "Guest"}</div>
          <div className="text-xs text-white/60">0 Followers · 5 Views</div>
        </div>
        <button
          className="ml-auto rounded-full px-4 py-2 text-sm font-semibold text-black"
          onClick={() => router.push("/verify")}
          style={{ backgroundColor: ACCENT }}
        >
          Get Verified
        </button>
      </div>
        <div className="px-4 pt-3 pb-6 max-h-[70vh] overflow-y-auto [-webkit-overflow-scrolling:touch]">
        <div className="grid gap-2">
            <Row icon={User2} label="My Profile" href={`/${username}`} />
            <Row icon={FolderCog} label="Manage" href={`/${username}/manage`} />
            <Row icon={Bookmark} label="Saved" href={`/${username}/saved`} />
            <Row icon={Settings} label="Settings" href={`/${username}/settings`} />

            <button
              type="button"
              className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-black/30 hover:bg-white/5 px-3 py-3"
              onClick={handleLogout}
            >
              <span className="flex items-center gap-2 text-sm">
                <LogOut className="h-4 w-4 opacity-80" />
                Log Out
              </span>
              <ChevronRight className="h-4 w-4 opacity-60" />
            </button>
            
        </div>
        </div>
    </div>
  );
}
