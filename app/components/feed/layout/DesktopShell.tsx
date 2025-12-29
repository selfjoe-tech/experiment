"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRightFromSquare,
  BadgeCheck,
  ChartBarIcon,
  ChartGantt,
  ChartLine,
  Compass,
  Eye,
  Home,
  Link2,
  Link2Icon,
  Link2Off,
  LucideLink2,
  MessageCircleWarning,
  Scale,
  Search,
  Sparkles,
  Upload as UploadIcon,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import ProfileAside from "@/app/components/profile/ProfileAside";
import Image from "next/image";
import { getIsLoggedInFromCookies, getUserProfileFromCookies } from "@/lib/actions/auth";
import SearchOverlay from "@/app/components/search/SearchOverlay";
import { LongLogo } from "../../icons/LongLogo";
import { useRouter } from "next/navigation";
import { buildPublicUrl } from "@/lib/actions/mediaFeed";
import { supabase } from "@/lib/supabaseClient";
import { fetchDesktopSidebarAds } from "@/lib/actions/ads";
import { ContactUs } from "../../ui/ContactUs";
import Script from "next/script";

declare global {
  interface Window {
    adsbyjuicy?: any[];
  }
}



type SidebarAd = {
  id: number;
  storage_path: string;
  media_type: "image" | "video";
  landing_url: string | null;
  owner_username?: string | null;
};

type AdCardProps = {
  name?: string;        // fallback label (for "Advertise here")
  ad?: SidebarAd | null;
};


type CookieProfile = {
  username: string | null;
  avatarUrl: string | null;
};

type Props = {
  navHidden: boolean;
  /** When true, replace “Log in” with a Profile button (no href). */
  isLoggedIn?: boolean;
  onProfileClick: () => void;
};

export default function DesktopShell({ navHidden}: Props) {
  const [profileOpen, setProfileOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const [logged] = await Promise.all([
        getIsLoggedInFromCookies(),
     ]);
      setIsLoggedIn(logged);
    })();
  }, [isLoggedIn]);
    

  return (
    <>
      <DesktopSidebar
        isLoggedIn={isLoggedIn}
        onProfileClick={() => setProfileOpen((v) => !v)}
      />
      <DesktopTopNav hidden={navHidden} />
      <DesktopAdsColumn />
      <ProfileAside open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

 function DesktopSidebar({ isLoggedIn, onProfileClick }: Props) {
  const pathname = usePathname();

  const [profile, setProfile] = useState<CookieProfile>({ username: null, avatarUrl: null });


  const [showUploadAuthModal, setShowUploadAuthModal] = useState(false);

  // fetch username + avatar from cookies via server action
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
  // const avatarUrl = profile.avatarUrl; // if you want to show an avatar somewhere

  const uploadItem = isLoggedIn
  ? { label: "Upload", icon: UploadIcon, href: "https://upload.upskirtcandy.com/upload" }
  : { label: "Upload", icon: UploadIcon, onClick: () => setShowUploadAuthModal(true) };

const items: {
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
}[] = [
  { label: "Home", icon: Home, href: "/" },
  { label: "Explore", icon: Compass, href: "/explore/gifs" },
  uploadItem, // 👈 use this
  { label: "Niches", icon: Sparkles, href: "/explore/niches" },
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
            <SidebarItem
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
    {/* Click outside to close */}
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
      {/* Background image layer */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/images/unlock-1.png')", // 👈 change path
        }}
      />

      {/* Dark overlay so text is readable */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Content */}
      <div className="relative p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Sign/Login in to upload</h2>
            <p className="mt-1 text-xs text-white/70">
              You need an UpskirtCandy account to upload content.
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

function SidebarItem({
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
        active ? "bg-white text-pink-500 font-semibold" : "text-white/80 hover:bg-white/10"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}

function DesktopTopNav({ hidden }: { hidden: boolean }) {
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

        {/* Suggestions dropdown */}
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

export function JuicyAd() {
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    window.adsbyjuicy = window.adsbyjuicy || [];
    window.adsbyjuicy.push({ adzone: 1107435 });
  }, []);

  return (
    <>
      <Script
        src="https://poweredby.jads.co/js/jads.js"
        strategy="afterInteractive"
        data-cfasync="false"
      />

    <ins id="1107435" data-width="308" data-height="786"></ins>
    </>
  );
}

export function DesktopAdsColumn() {
  return (
    <aside className="hidden lg:flex fixed inset-y-0 right-0 w-80 flex-col bg-black/95 border-l border-white/10 px-4 py-6 z-30 h-500 overflow-y-auto">
      <h2 className="text-sm font-semibold mb-4">Sponsored</h2>

      {/* JuicyAds v3.0 */}
      <Script
        id="juicyads-jads"
        src="https://poweredby.jads.co/js/jads.js"
        strategy="afterInteractive"
        data-cfasync="false"
        async
      />

      <div className="rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
        {/* Ad slot (308x1044) */}
        <ins id="1108076" data-width="308" data-height="1044"></ins>
      </div>

      <Script
        id="juicyads-init-1108076"
        strategy="afterInteractive"
        data-cfasync="false"
        dangerouslySetInnerHTML={{
          __html: `(adsbyjuicy = window.adsbyjuicy || []).push({'adzone':1108076});`,
        }}
      />
      {/* JuicyAds END */}
    </aside>
  );
}

function AdCard({ name, ad }: AdCardProps) {
  const hrefRaw =
    ad?.landing_url && ad.landing_url.trim().length > 0
      ? ad.landing_url.trim()
      : "/ads";

  const href = hrefRaw;
  const isExternal = href.startsWith("http://") || href.startsWith("https://");

  const mediaUrl =
    ad?.storage_path && ad.storage_path.length > 0
      ? buildPublicUrl(ad.storage_path)
      : null;

  const isVideo = ad?.media_type === "video";

  const displayName =
    ad?.owner_username || name || "Sponsored";

    const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    // Make sure it's muted before trying to play
    el.muted = true;

    const tryPlay = async () => {
      try {
        await el.play();
      } catch (err) {
        console.error("Autoplay failed:", err);
        // some browsers require a user gesture; then it will play on tap
      }
    };

    tryPlay();
  }, [mediaUrl]);

  return (
    <Link
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="flex flex-col gap-2"
    >
      <div className="rounded-2xl overflow-hidden bg-white/5 border border-white/10">
        <div className="relative h-40 bg-gradient-to-br from-purple-500 to-pink-500">
          {mediaUrl && (
            <>
              {isVideo ? (
                <video
                  ref={videoRef}
                  src={mediaUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 h-full w-full"

                />
              ) : (
                <img
                  src={mediaUrl}
                  alt={displayName}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
            </>
          )}
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm truncate">
              {displayName}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-yellow-300 border border-yellow-400/60 bg-yellow-400/10 px-2 py-0.5 rounded-full">
              Ad
            </span>
          </div>
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-full bg-white text-black py-1.5"
          >
            Visit Page
            <ArrowUpRightFromSquare size={16} />
          </button>
        </div>
      </div>
    </Link>
  );
}
