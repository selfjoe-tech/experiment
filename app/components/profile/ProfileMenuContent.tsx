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
  Coins,
  X,
  ShieldCheck,
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

export default function ProfileMenuContent() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [verified, setVerified] = useState(false);
  const [avatar, setAvatar] = useState("");

  const [followCounts, setFollowCounts] = useState<FollowCounts | null>(null);
  const [followCountsLoading, setFollowCountsLoading] = useState(true);

  const [earnModalOpen, setEarnModalOpen] = useState(false);

  const handleLogout = async () => {
    await logoutAction();
    router.push("/auth/login");
    router.refresh();
  };

  const onEarnClick = () => {
    if (verified) {
      router.push("/earn");
    } else {
      setEarnModalOpen(true);
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [profile, counts] = await Promise.all([
          getUserProfileFromCookies(),
          getMyFollowCounts(),
        ]);

        const verifiedFlag = await getVerified(profile.username);

        if (cancelled) return;

        setUsername(profile.username ?? "");
        setAvatar(profile.avatarUrl ?? "");
        setVerified(verifiedFlag === true);
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
          alt={`${username}'s avatar on Upskirt Candy` || "Upskirt Candy avatar"}
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
            <span>Get</span> <span>Verified</span>
          </button>
        )}
      </div>

      <div className="px-4 pt-3 pb-6 max-h-[70vh] overflow-y-auto [-webkit-overflow-scrolling:touch]">
        <div className="grid gap-2">
          <Row icon={User2} label="My Profile" href={`/${username}`} />
          <Row icon={FolderCog} label="Manage" href={`/${username}/manage`} />

          {/* ✅ Earn row */}
          <button
            type="button"
            className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-gradient-to-r from-amber-400/10 via-white/5 to-emerald-400/10 hover:bg-white/5 px-3 py-3"
            onClick={onEarnClick}
          >
            <span className="flex items-center gap-2 text-sm">
              <Coins className="h-4 w-4 text-amber-200 opacity-90" />
              <span className="text-white">Earn</span>
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
            <ChevronRight className="h-4 w-4 opacity-60" />
          </button>

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
