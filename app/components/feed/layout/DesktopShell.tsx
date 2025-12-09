"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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

  const items: {
    label: string;
    icon: LucideIcon;
    href?: string;
    onClick?: () => void;
  }[] = [
    { label: "Home", icon: Home, href: "/" },
    { label: "Explore", icon: Compass, href: "/explore/gifs" },
    { label: "Upload", icon: UploadIcon, href: "/upload" },
    { label: "Niches", icon: Sparkles, href: "/explore/niches" },
    isLoggedIn && username
      ? {
          label: "Profile",
          icon: UserRound,
          onClick: onProfileClick,
        }
      : 
      {
        label: "Log in", 
        icon: UserRound, 
        href: "/auth/login" 
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

      <div className="mt-auto space-y-1 text-[11px] text-white/60">
        <button className="block text-left hover:text-white">For business contact sales@upskirtcandy.com</button>
        
      </div>
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

      <Link
        href="/ads"
        className="ml-4 rounded-full bg-white text-black text-sm font-semibold px-4 py-2 flex items-center gap-2"
      >
        <ChartLine className="h-4 w-4" />
        Boost Views
      </Link>
    </header>
  );
}

function DesktopAdsColumn() {
  return (
    <aside className="hidden lg:flex fixed inset-y-0 right-0 w-80 flex-col bg-black/95 border-l border-white/10 px-4 py-6 z-30 overflow-y-auto">
      <h2 className="text-sm font-semibold mb-4">Sponsored</h2>
      <div className="space-y-4">
        <AdCard name="Advertise Here" />
        <AdCard name="Advertise Here" />
        <AdCard name="Advertise Here" />
        <AdCard name="Advertise Here" />
        <AdCard name="Advertise Here" />

      </div>
    </aside>
  );
}

function AdCard({ name }: { name: string }) {

  const router = useRouter();
  return (
    <Link 
      href={"/ads"}
      className="flex flex-col gep-2"
    >
    
    <div className="rounded-2xl overflow-hidden bg-white/5 border border-white/10">
      <div className="h-40 bg-gradient-to-br from-purple-500 to-pink-500" />
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">{name}</span>
          
        </div>
        <button 
        onClick={() => {router.push("/ads")}}
        className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-full bg-white text-black py-1.5">
          Visit Page
          <ArrowUpRightFromSquare size={20} />
        </button>
      </div>
    </div>
    </Link>
  );
}
