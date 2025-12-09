"use client";

import * as React from "react";
import {
  ChevronRight,
  Settings,
  User2,
  Bookmark,
  FolderCog,
  LogOut,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  getUserProfileFromCookies,
  getVerified,
  logoutAction,
} from "@/lib/actions/auth";
import { useEffect, useState } from "react";
import { VerifiedBadgeIcon } from "../icons/VerifiedBadgeIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyFollowCounts, type FollowCounts } from "@/lib/actions/social";

const ACCENT = "pink";

type Row = {
  label: string;
  icon: React.ElementType;
  onClick?: () => void;
  link: string;
};

function formatCount(n?: number | null): string {
  const num = n ?? 0;
  if (num >= 1_000_000) return `${Math.floor(num / 1_000_000)}M`;
  if (num >= 1_000) return `${Math.floor(num / 1_000)}k`;
  return num.toString();
}

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
  const router = useRouter();

  const handleLogout = async () => {
    await logoutAction();
    router.push("/auth/login");
    router.refresh();
  };

  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("");
  const [verified, setVerified] = useState(false);

  const [followCounts, setFollowCounts] = useState<FollowCounts | null>(null);
  const [followCountsLoading, setFollowCountsLoading] = useState(true);

  // fetch username + avatar + stats from server actions
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [profile, verifiedFlag, counts] = await Promise.all([
          getUserProfileFromCookies(),
          getVerified(),
          getMyFollowCounts(),
        ]);

        if (cancelled) return;

        setUsername(profile.username ?? "");
        setAvatar(profile.avatarUrl ?? "");
        if (verifiedFlag === true) {
          setVerified(true);
        }
        setFollowCounts(counts);
      } catch (err) {
        console.error("Failed to load profile panel data", err);
      } finally {
        if (!cancelled) setFollowCountsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const rows: Row[] = [
    { label: "My Profile", icon: User2, link: `/profile/${username}` },
    { label: "Manage", icon: FolderCog, link: `/profile/manage/${id}` },
    { label: "Saved", icon: Bookmark, link: `/profile/saved/${id}` },
    { label: "Settings", icon: Settings, link: `/settings/` },
  ];

  const logOut = { label: "Log out", icon: LogOut };

  return (
    <div className="h-full w-full bg-black text-white flex flex-col">
      {/* header */}
      <div className="p-4 border-b border-white/10 flex items-center gap-3">
        <div className="relative h-10 w-10 rounded-full bg-white/10 overflow-hidden">
          <Image
            src={avatar || "/avatar-placeholder.png"}
            alt="avatar"
            fill
            sizes="40px"
            className="object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div className="min-w-0">
          <div className="font-semibold truncate flex items-center gap-2">
            {username || "Guest"}
            {verified && <VerifiedBadgeIcon />}
          </div>
          <div className="text-xs text-white/70 flex items-center gap-3 mt-1">
            {followCountsLoading ? (
              <>
                <Skeleton className="h-3 w-16 bg-white/10" />
                <Skeleton className="h-3 w-20 bg-white/10" />
                <Skeleton className="h-3 w-16 bg-white/10" />
              </>
            ) : (
              <>
                <span>
                  {formatCount(
                    followCounts?.followers ?? followers
                  )}{" "}
                  Followers
                </span>
                <span>
                  {formatCount(
                    followCounts?.following ?? 0
                  )}{" "}
                  Following
                </span>
                <span>
                  {formatCount(
                    followCounts?.views ?? views
                  )}{" "}
                  Views
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* verify */}
      <div className="flex items-center justify-center p-4">
        {!verified && (
          <button
            className="flex items-center justify-center gap-2 w-full h-10 rounded-full text-black font-semibold"
            style={{ backgroundColor: ACCENT }}
            onClick={() => router.push("/verify")}
          >
            <VerifiedBadgeIcon />
            Get Verified
          </button>
        )}
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
