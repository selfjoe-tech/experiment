// components/layout/MobileChrome.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Compass,
  Home,
  LogIn,
  LucidePlusCircle,
  Plus,
  PlusCircle,
  PlusCircleIcon,
  Search,
  Sparkles,
  Upload as UploadIcon,
  User2,
} from "lucide-react";
import * as React from "react";
import type { FeedTab } from "@/app/components/feed/types";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { ProfilePanel } from "@/app/components/profile/ProfilePanel";
import Image from "next/image";
import { useEffect, useState } from "react";
import { getIsLoggedInFromCookies } from "@/lib/actions/auth";
type Props = {
  activeTab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
  isSearching: boolean;
  onSearchOpen: () => void;
  onSearchClose: () => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  isLoggedIn?: boolean;
};

import SearchOverlay from "@/app/components/search/SearchOverlay";
import { ShortLogo } from "../../icons/ShortLogo";
import { MobileAd } from "../../ads/AdCard";


export default function MobileChrome(props: Props) {
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
      <MobileTopBar {...props} />
      <MobileBottomNav isAuthed={isLoggedIn} />
    </>
  );
}

function MobileTopBar({
  activeTab,
  onTabChange,
  isSearching,
  onSearchOpen,
  onSearchClose,
  searchQuery,
  setSearchQuery,
}: Omit<Props, "setSearchQuery" | "isAuthed"> & {
  setSearchQuery: (v: string) => void;
}) {
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-black via-black/90 to-transparent">
      {isSearching ? (
        <div className="px-3 pt-2 pb-1">
          <div className="flex items-center w-full gap-2">
            <button
              type="button"
              onClick={onSearchClose}
              className="rounded-full bg-white/10 h-9 w-9 flex items-center justify-center"
              aria-label="Close search"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 relative">
              <div className="flex items-center rounded-full bg-white/10 px-3 py-1.5">
                <Search className="mr-2 text-white/70" size={20}/>
                <input
                  className="bg-transparent outline-none text-sm flex-1 placeholder:text-white/50"
                  placeholder="Search naughty naughty stuff..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Suggestions for mobile */}
              {searchQuery.trim().length > 0 && (
                <SearchOverlay
                  query={searchQuery}
                  onItemSelected={onSearchClose}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-3 h-14 flex items-center justify-between gap-2">
          <Link
            href={"/"}
          
          >
            <ShortLogo />
          </Link>
          <MobileAd name="Advertise here" />

          <button
            type="button"
            onClick={onSearchOpen}
            className="rounded-full bg-white/10 h-9 w-9 flex items-center justify-center"
            aria-label="Search"
          >
            <Search className="h-6 w-6 text-pink-500" />
          </button>
        </div>
      )}
    </header>
  );
}

const NavLink = ({
    href,
    label,
    icon: Icon,
  }: {
    href: string;
    label: string;
    icon: any;
  }) => {
    const pathname = usePathname();
    const active = pathname === href || (href !== "/" && pathname.startsWith(href));
    return (
      <Link
        href={href}
        className={`flex flex-col items-center gap-0.5 ${
          active ? "text-pink-500" : "text-white/60"
        }`}
      >
        <Icon className="h-5 w-5" />
        <span>{label}</span>
      </Link>
    );
  };

function MobileBottomNav({ isAuthed = true }: { isAuthed?: boolean }) {
  const [showUploadAuthModal, setShowUploadAuthModal] = useState(false);


  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-black/95 border-t border-white/10 z-40">
      <div className="flex h-full items-center justify-around text-[11px]">
        <NavLink href="/" label="Home" icon={Home} />
        <NavLink href="/explore/gifs" label="Explore" icon={Compass} />
        {isAuthed ? (
          <NavLink href="/upload" label="Upload" icon={PlusCircleIcon} />
        ) : (
          <button
            type="button"
            onClick={() => setShowUploadAuthModal(true)}
            className="flex flex-col items-center gap-0.5 text-white/60"
          >
            <PlusCircleIcon className="h-5 w-5" />
            <span>Upload</span>
          </button>
        )}        

      <NavLink href="/explore/niches" label="Niches" icon={Sparkles} />

        {/* Last item: Log in or Profile Drawer */}
        {isAuthed ? (
          <Drawer>
            <DrawerTrigger asChild>
              <button className="flex flex-col items-center gap-0.5 text-white/60">
                <User2 className="h-5 w-5" />
                <span>Profile</span>
              </button>
            </DrawerTrigger>
            <DrawerContent className="bg-black text-white">
              <DrawerHeader>
                <DrawerTitle>Profile</DrawerTitle>
              </DrawerHeader>
              <div className="px-4 pb-4">
                <ProfilePanel />
                <DrawerClose asChild>
                  <button className="mt-4 w-full rounded-full border border-white/20 py-2 hover:bg-white/10">
                    Close
                  </button>
                </DrawerClose>
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <NavLink href="/auth/login" label="Log in" icon={LogIn} />
        )}
      </div>


      
      {showUploadAuthModal && (
  <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm lg:hidden">
    {/* backdrop click closes modal */}
    <button
      type="button"
      className="absolute inset-0 w-full h-full"
      onClick={() => setShowUploadAuthModal(false)}
    />

    <div
      className="
        relative w-full max-w-sm mx-6 rounded-3xl overflow-hidden
        border border-white/20 shadow-2xl
      "
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/images/mobile-upload-gate.jpg')", // 👈 change path
        }}
      />

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/65" />

      {/* Content */}
      <div className="relative px-5 py-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Sign in to upload</h2>
            <p className="mt-1 text-[11px] text-white/70">
              You need an account to upload content. Log in or sign up to start
              posting on UpskirtCandy.
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

        <div className="flex flex-col gap-2 pt-1">
          <Link
            href="/auth/login"
            className="w-full text-center rounded-full bg-white text-black text-xs font-semibold py-2.5 hover:bg-pink-500 hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/auth/signup"
            className="w-full text-center rounded-full border border-white/40 text-xs font-semibold py-2.5 hover:bg-white hover:text-black"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  </div>
)}
    </nav>
  );
}
