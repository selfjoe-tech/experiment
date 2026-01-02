"use client";

import * as React from "react";
import {
  ChevronRight,
  Settings,
  User2,
  Bookmark,
  FolderCog,
  LogOut,
  Coins,
  X,
  ShieldCheck,
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

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100]">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-3xl border border-white/10 bg-[#0b0b0b] shadow-2xl">
          <div className="flex items-start justify-between gap-3 p-4 border-b border-white/10">
            <div className="min-w-0">
              <div className="text-white font-semibold">{title}</div>
              <div className="text-xs text-white/60 mt-1">
                Verified creators can monetize profile traffic.
              </div>
            </div>
            <button
              onClick={onClose}
              className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/30 hover:bg-white/5"
            >
              <X className="h-4 w-4 text-white/80" />
            </button>
          </div>

          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  );
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

  const [earnModalOpen, setEarnModalOpen] = useState(false);

  const onEarnClick = () => {
    if (verified) {
      router.push("/earn");
    } else {
      setEarnModalOpen(true);
    }
  };

  // fetch username + avatar + stats from server actions
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [profile, counts] = await Promise.all([
          getUserProfileFromCookies(),
          getMyFollowCounts(),
        ]);

        if (cancelled) return;

        setUsername(profile.username ?? "");

        const verifiedFlag = await getVerified(profile.username);

        setAvatar(profile.avatarUrl ?? "");
        setVerified(verifiedFlag === true);
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
    { label: "My Profile", icon: User2, link: `/${username}` },
    { label: "Manage", icon: FolderCog, link: `/${username}/manage` },

    // ✅ Earn row (special handling, not a normal router.push row)
    // We'll render it separately so it can open a modal for non-verified users.

    { label: "Saved", icon: Bookmark, link: `/saved` },
    { label: "Settings", icon: Settings, link: `/settings` },
  ];

  const logOut = { label: "Log out", icon: LogOut };

  return (
    <div className="h-full w-full bg-black text-white flex flex-col">
      {/* header */}
      <div className="p-4 border-b border-white/10 flex items-center gap-3">
        <div className="relative h-10 w-10 rounded-full bg-white/10 overflow-hidden">
          <Image
            src={avatar || "/avatar-placeholder.png"}
            alt={`${username}'s avatar on Upskirt Candy`}
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
                  {formatCount(followCounts?.followers ?? followers)} Followers
                </span>
                <span>
                  {formatCount(followCounts?.following ?? 0)} Following
                </span>
                <span>
                  {formatCount(followCounts?.views ?? views)} Views
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
        {/* standard rows up to Manage */}
        {rows.slice(0, 2).map((r) => (
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

        {/* ✅ Earn row */}
        <button
  type="button"
  onClick={onEarnClick}
  className="
    group relative w-full overflow-hidden rounded-md border border-white/10 px-3 py-3
    flex items-center justify-between
    bg-black/30 hover:border-white/20 transition
  "
>
  <span
    className="
      pointer-events-none absolute inset-0 opacity-80
      bg-[linear-gradient(90deg,rgba(251,191,36,.18),rgba(255,255,255,.06),rgba(52,211,153,.18),rgba(251,191,36,.18))]
      bg-[length:200%_100%]
      animate-shimmer
    "
  />
  <span className="pointer-events-none absolute inset-0 bg-black/20" />

  <span className="relative z-10 flex items-center gap-2">
    <Coins className="h-4 w-4 text-amber-200 opacity-90" />
    <span className="text-sm">Earn</span>
    {verified ? (
      <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-200">
        <ShieldCheck className="h-3 w-3" />
        Verified
      </span>
    ) : (
      <span className="ml-2 inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
        Locked
      </span>
    )}
  </span>

  <ChevronRight className="relative z-10 h-4 w-4 opacity-60 transition-transform duration-200 group-hover:translate-x-0.5" />
</button>


        {/* remaining standard rows (Saved + Settings) */}
        {rows.slice(2).map((r) => (
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

      {/* ✅ Not verified modal */}
      <Modal
        open={earnModalOpen}
        title="Monetisation is for verified users"
        onClose={() => setEarnModalOpen(false)}
      >
        <div className="space-y-3">
          <div className="text-sm text-white/70">
            To access <b className="text-white">Earn</b> and start getting paid for profile traffic, your account needs to be verified.
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white/70">
            Verification helps keep payouts safe and reduces fraud.
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => {
                setEarnModalOpen(false);
                router.push("/verify");
              }}
              className="h-11 flex-1 rounded-2xl font-semibold text-black"
              style={{ backgroundColor: ACCENT }}
            >
              Get verified
            </button>

            <button
              onClick={() => setEarnModalOpen(false)}
              className="h-11 px-4 rounded-2xl border border-white/15 bg-black/30 text-white font-semibold hover:bg-white/5"
            >
              Not now
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
