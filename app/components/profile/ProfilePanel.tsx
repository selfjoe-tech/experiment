"use client";

import * as React from "react";
import {
  ChevronRight,
  Settings,
  User2,
  Users,
  BarChart3,
  Bookmark,
  FolderCog,
  LogOut,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getUserProfileFromCookies, logoutAction } from "@/lib/actions/auth";
import { useEffect, useState } from "react";

const ACCENT = "pink";

type Row = { label: string;
   icon: React.ElementType;
    onClick?: () => void;
    link: string
  };

export function ProfilePanel({
  onClose,
  followers = 0,
  views = 5,
  id = "huhszfgizshfdluzusdvlizsdv",
}: {
  onClose?: () => void;
  username?: string;
  followers?: number;
  views?: number;
  id: string;
}) {
  

  const logOut = { label: "Log out", icon: LogOut }

  const router = useRouter()

  const handleLogout = async () => {
    await logoutAction();
    router.push("/auth/login");
    router.refresh();
  };

const [username, setUsername] = useState("")
const [avatar, setAvatar] = useState("")
  // fetch username + avatar from cookies via server action
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await getUserProfileFromCookies();
        if (!cancelled) {
          setUsername(result.username);
          setAvatar(result.avatarUrl)
        }
      } catch (err) {
        console.error("Failed to load profile from cookies", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const rows: Row[] = [
    { label: "My Profile", icon: User2, link: `/profile/${username}`},
    { label: "Manage", icon: FolderCog, link: `/profile/manage/${id}` },
    { label: "Saved", icon: Bookmark, link: `/profile/saved/${id}` },
    { label: "Settings", icon: Settings, link: `/profile/settings/${id}` },
    
  ];

  // const avatarUrl = profile.avatarUrl; // if you want to show an avatar somewhere

  return (
    <div className="h-full w-full bg-black text-white flex flex-col">
      {/* header */}
      <div className="p-4 border-b border-white/10 flex items-center gap-3">
        <div className="relative h-10 w-10 rounded-full bg-white/10 overflow-hidden">
          {/* Placeholder avatar */}
          <Image
            src={avatar || "/avatar-placeholder.png"}
            alt="avatar"
            fill
            sizes="40px"
            className="object-cover"
            onError={(e) => {
              // keep as gray circle on error
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div className="min-w-0">
          <div className="font-semibold truncate">{username || "Guest" }</div>
          <div className="text-xs text-white/70 flex items-center gap-3">
            <span>{followers} Followers</span>
            <span>{views} Views</span>
          </div>
        </div>
      </div>

      {/* verify */}
      <div className="p-4">
        <button
          className="w-full h-10 rounded-full text-black font-semibold"
          style={{ backgroundColor: ACCENT }}
          onClick={() => router.push("/verify")}
        >
          Get Verified
        </button>
      </div>

      {/* list */}
      <div className="px-2 pb-2 space-y-2 overflow-y-auto">
        {rows.map((r) => (
          <button
            key={r.label}
            type="button"
            className="w-full rounded-md bg-transparent hover:bg-white/5 border border-white/10 px-3 py-3 flex items-center justify-between"
            onClick={() => router.push(r.link)}
          >
            <span className="flex items-center gap-2">
              <r.icon className="h-4 w-4 opacity-80" />
              <span className="text-sm">{r.label}</span>
            </span>
            <ChevronRight className="h-4 w-4 opacity-60" />
          </button>
        ))}
        <button
            key={logOut.label}
            type="button"
            className="w-full rounded-md bg-transparent hover:bg-white/5 border border-white/10 px-3 py-3 flex items-center justify-between"
            onClick={handleLogout}
          >
            <span className="flex items-center gap-2">
              <logOut.icon className="h-4 w-4 opacity-80" />
              <span className="text-sm">{logOut.label}</span>
            </span>
            <ChevronRight className="h-4 w-4 opacity-60" />
          </button>

      </div>
    </div>
  );
}
