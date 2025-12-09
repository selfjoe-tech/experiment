"use client";

import {
  getUserProfileFromCookies,
  getVerified,
  logoutAction,
} from "@/lib/actions/auth";
import {
  ChevronRight,
  Bookmark,
  LogOut,
  Settings,
  User2,
  FolderCog,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { VerifiedBadgeIcon } from "../icons/VerifiedBadgeIcon";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyFollowCounts, type FollowCounts } from "@/lib/actions/social";

const ACCENT = "pink";

const Row = ({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ComponentType<any>;
  label: string;
  href: string;
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
  );
};

function formatCount(n?: number | null): string {
  const num = n ?? 0;
  if (num >= 1_000_000) return `${Math.floor(num / 1_000_000)}M`;
  if (num >= 1_000) return `${Math.floor(num / 1_000)}k`;
  return num.toString();
}

export default function ProfileMenuContent() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [verified, setVerified] = useState(false);
  const [avatar, setAvatar] = useState("");

  const [followCounts, setFollowCounts] = useState<FollowCounts | null>(null);
  const [followCountsLoading, setFollowCountsLoading] = useState(true);

  const handleLogout = async () => {
    await logoutAction();
    router.push("/auth/login");
    router.refresh();
  };

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
        console.error("Failed to load profile menu data", err);
      } finally {
        if (!cancelled) setFollowCountsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-4 space-y-4">
      {/* header */}
      <div className="flex items-center gap-3">
        <Image
          className="h-10 w-10 rounded-full bg-white/10"
          src={avatar || "/avatar-placeholder.png"}
          width={40}
          height={40}
          alt={username || "avatar"}
        />
        <div className="min-w-0">
          <div className="font-semibold truncate flex items-center gap-2">
            {username || "Guest"}
            {verified && <VerifiedBadgeIcon />}
          </div>

          {followCountsLoading ? (
            <div className="mt-1 flex gap-2">
              <Skeleton className="h-3 w-20 bg-white/10" />
              <Skeleton className="h-3 w-20 bg-white/10" />
              <Skeleton className="h-3 w-20 bg-white/10" />
            </div>
          ) : (
            <div className="text-xs text-white/60">
              {formatCount(followCounts?.followers)} Followers ·{" "}
              {formatCount(followCounts?.following)} Following ·{" "}
              {formatCount(followCounts?.views)} Views
            </div>
          )}
        </div>

        {!verified && (
          <button
            className="ml-auto flex gap-2 items-center rounded-full px-4 py-2 text-sm font-semibold text-black"
            onClick={() => router.push("/verify")}
            style={{ backgroundColor: ACCENT }}
          >
            <VerifiedBadgeIcon />
            Get Verified
          </button>
        )}
      </div>

      <div className="px-4 pt-3 pb-6 max-h-[70vh] overflow-y-auto [-webkit-overflow-scrolling:touch]">
        <div className="grid gap-2">
          <Row icon={User2} label="My Profile" href={`/${username}`} />
          <Row icon={FolderCog} label="Manage" href={`/${username}/manage`} />
          <Row icon={Bookmark} label="Saved" href={`/saved`} />
          <Row icon={Settings} label="Settings" href={`/settings`} />

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
