"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRightFromSquare,
  Compass,
  Home,
  Search,
  Sparkles,
  Upload as UploadIcon,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import ProfileAside from "@/app/components/profile/ProfileAside";
import {
  getIsLoggedInFromCookies,
  getUserProfileFromCookies,
} from "@/lib/actions/auth";
import SearchOverlay from "@/app/components/search/SearchOverlay";
import { LongLogo } from "../../icons/LongLogo";
import { ContactUs } from "../../ui/ContactUs";
import Script from "next/script";

declare global {
  interface Window {
    adsbyjuicy?: any[];
  }
}

type CookieProfile = {
  username: string | null;
  avatarUrl: string | null;
};

type Props = {
  navHidden?: boolean;
  isLoggedIn?: boolean | null;
  onProfileClick?: () => void;
};

export default function WatchDesktopShell({
  navHidden = false,
}: Props) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const logged = await getIsLoggedInFromCookies();

      if (!cancelled) {
        setIsLoggedIn(logged);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <WatchDesktopSidebar
        isLoggedIn={isLoggedIn}
        onProfileClick={() => setProfileOpen((v) => !v)}
      />

      <WatchDesktopTopNav hidden={navHidden} />

      <WatchDesktopAdsColumn />

      <ProfileAside
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </>
  );
}

function WatchDesktopSidebar({
  isLoggedIn,
  onProfileClick,
}: {
  isLoggedIn: boolean | null;
  onProfileClick: () => void;
}) {
  const pathname = usePathname();

  const [profile, setProfile] = useState<CookieProfile>({
    username: null,
    avatarUrl: null,
  });

  const [showUploadAuthModal, setShowUploadAuthModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await getUserProfileFromCookies();

        if (!cancelled) {
          setProfile(result);
        }
      } catch (err) {
        console.error("Failed to load profile from cookies", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const username = profile.username;

  const uploadItem = isLoggedIn
    ? {
        label: "Upload",
        icon: UploadIcon,
        href: "https://upload.goongram.com/upload",
      }
    : {
        label: "Upload",
        icon: UploadIcon,
        onClick: () => setShowUploadAuthModal(true),
      };

  const items: {
    label: string;
    icon: LucideIcon;
    href?: string;
    onClick?: () => void;
  }[] = [
    {
      label: "Home",
      icon: Home,
      href: "/",
    },
    {
      label: "Explore",
      icon: Compass,
      href: "/explore/gifs",
    },
    uploadItem,
    {
      label: "Niches",
      icon: Sparkles,
      href: "/explore/niches",
    },
    isLoggedIn && username
      ? {
          label: "Profile",
          icon: UserRound,
          onClick: onProfileClick,
        }
      : {
          label: "Log in",
          icon: UserRound,
          href: "/auth/login",
        },
  ];

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-black/95 border-r border-white/10 px-5 py-6 z-30">
      <LongLogo />

      <nav className="space-y-2 text-sm">
        {items.map((item) =>
          item.href ? (
            <WatchSidebarItem
              key={item.label}
              label={item.label}
              icon={item.icon}
              href={item.href}
              active={
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href))
              }
            />
          ) : (
            <button
              key={item.label}
              onClick={item.onClick}
              type="button"
              className="w-full rounded-full px-4 py-2 flex items-center gap-3 text-white/80 hover:bg-white/10 transition-colors"
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          )
        )}
      </nav>

      <ContactUs />

      {showUploadAuthModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <button
            className="absolute inset-0 w-full h-full cursor-default"
            onClick={() => setShowUploadAuthModal(false)}
          />

          <div
            className="
              relative w-full h-100 max-w-sm mx-4 rounded-3xl overflow-hidden
              border border-white/15 shadow-2xl
            "
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: "url('/images/unlock-1.png')",
              }}
            />

            <div className="absolute inset-0 bg-black/60" />

            <div className="relative p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">
                    Sign/Login in to upload
                  </h2>

                  <p className="mt-1 text-xs text-white/70">
                    You need an goongram account to upload content.
                    Log in to start posting.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowUploadAuthModal(false)}
                  className="text-white/70 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Link
                  href="/auth/login"
                  className="w-full text-center rounded-full bg-white text-black text-xs font-semibold py-2 hover:bg-pink-500 hover:text-white"
                >
                  Log in
                </Link>

                <Link
                  href="/auth/signup"
                  className="w-full text-center rounded-full border border-white/40 text-xs font-semibold py-2 hover:bg-white hover:text-black"
                >
                  Sign up
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function WatchSidebarItem({
  label,
  icon: Icon,
  href,
  active = false,
}: {
  label: string;
  icon: LucideIcon;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`w-full rounded-full px-4 py-2 flex items-center gap-3 transition-colors ${
        active
          ? "bg-white text-pink-500 font-semibold"
          : "text-white/80 hover:bg-white/10"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}

function WatchDesktopTopNav({ hidden }: { hidden: boolean }) {
  const [query, setQuery] = useState("");

  return (
    <header
      className={`hidden lg:flex fixed top-0 left-64 right-80 h-16 items-center px-6
      bg-black/95 backdrop-blur border-b border-white/10 z-40
      transition-transform duration-200 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="flex-1 relative">
        <div className="flex items-center rounded-full bg-white/5 border border-white/15 px-4 py-2 text-sm">
          <Search className="mr-2 h-4 w-4 text-white/60" />

          <input
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-white/40"
            placeholder="Search naughty stuff..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {query.trim().length > 0 && (
          <SearchOverlay
            query={query}
            onItemSelected={() => setQuery("")}
          />
        )}
      </div>
    </header>
  );
}

/*
 * ============================================================
 * WATCH DESKTOP JUICY ADS
 * Ad zone: 1125709
 * Size: 308x2592
 * ============================================================
 */

export function WatchDesktopJuicyAd() {
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;

    didInit.current = true;

    window.adsbyjuicy = window.adsbyjuicy || [];

    window.adsbyjuicy.push({
      adzone: 1125709,
    });
  }, []);

  return (
    <>
      <Script
        id="watch-juicyads-jads-1125709"
        src="https://poweredby.jads.co/js/jads.js"
        strategy="afterInteractive"
        data-cfasync="false"
        async
      />

      <ins
        id="1125709"
        data-width="308"
        data-height="2592"
      />
    </>
  );
}

export function WatchDesktopAdsColumn() {
  return (
    <aside className="hidden lg:flex fixed inset-y-0 right-0 w-80 flex-col bg-black/95 border-l border-white/10 px-4 py-6 z-30 overflow-y-auto">
      <h2 className="text-sm font-semibold mb-4">
        Sponsored
      </h2>

      <div className="rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
        <WatchDesktopJuicyAd />
      </div>
    </aside>
  );
}