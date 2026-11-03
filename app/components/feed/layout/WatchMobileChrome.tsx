"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Compass,
  Home,
  LogIn,
  Menu,
  PlusCircleIcon,
  Search,
  Sparkles,
  User2,
  X,
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
import SearchOverlay from "@/app/components/search/SearchOverlay";

import { ShortLogo } from "../../icons/ShortLogo";
import { ContactUs } from "../../ui/ContactUs";

import { useEffect, useRef, useState } from "react";
import { getIsLoggedInFromCookies } from "@/lib/actions/auth";

import Script from "next/script";

declare global {
  interface Window {
    adsbyjuicy?: any[];
  }
}

type Props = {
  activeTab: FeedTab;
  onTabChange: (tab: FeedTab) => void;

  isSearching: boolean;
  onSearchOpen: () => void;
  onSearchClose: () => void;

  searchQuery: string;
  setSearchQuery: (value: string) => void;

  isLoggedIn?: boolean;
  bottomNavHidden?: boolean;
};

export default function WatchMobileChrome(props: Props) {
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
      <WatchMobileTopBar {...props} />

      <WatchMobileBottomNav
        isAuthed={isLoggedIn}
        hidden={!!props.bottomNavHidden}
      />
    </>
  );
}

/*
 * ============================================================
 * WATCH MOBILE JUICY ADS
 * Ad zone: 1125710
 * Size: 308x2592
 * ============================================================
 */

export function WatchMobileJuicyAd() {
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;

    didInit.current = true;

    window.adsbyjuicy = window.adsbyjuicy || [];

    window.adsbyjuicy.push({
      adzone: 1125710,
    });
  }, []);

  return (
    <>
      <Script
        id="watch-mobile-juicyads-jads-1125710"
        src="https://poweredby.jads.co/js/jads.js"
        strategy="afterInteractive"
        data-cfasync="false"
        async
      />

      <ins
        id="1125710"
        data-width="308"
        data-height="2592"
      />
    </>
  );
}

export function WatchMobileAdsColumn() {
  return (
    <aside
      className="
        w-[308px]
        max-w-full
        flex
        flex-col
        bg-black/95
        border
        border-white/10
        rounded-2xl
        px-4
        py-6
        z-30
        max-h-[400px]
        overflow-y-auto
      "
    >
      <h2 className="text-sm font-semibold mb-4">
        Sponsored
      </h2>

      <div className="w-full flex justify-center overflow-hidden">
        <WatchMobileJuicyAd />
      </div>
    </aside>
  );
}

function WatchMobileTopBar({
  isSearching,
  onSearchOpen,
  onSearchClose,
  searchQuery,
  setSearchQuery,
}: Omit<Props, "setSearchQuery" | "isAuthed"> & {
  setSearchQuery: (v: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const prev = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-black via-black/90 to-transparent">
      {/* =====================================================
          MOBILE SLIDE-IN MENU
          ===================================================== */}

      <div
        className={`fixed inset-0 z-[9999] ${
          menuOpen
            ? "pointer-events-auto"
            : "pointer-events-none"
        }`}
        aria-hidden={!menuOpen}
      >
        {/* Backdrop */}

        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
            menuOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Close menu"
        />

        {/* Panel */}

        <aside
          className={`absolute right-0 top-0 h-full w-[86%] max-w-sm bg-[#0b0b0b] border-l border-white/10 shadow-2xl
            transition-transform duration-300 ease-in-out
            ${
              menuOpen
                ? "translate-x-0"
                : "translate-x-full"
            }`}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div className="h-14 px-4 flex items-center justify-between border-b border-white/10">
            <div className="text-sm font-semibold text-white">
              Menu
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="rounded-full bg-white/10 h-9 w-9 flex items-center justify-center"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-white/80" />
            </button>
          </div>

          <ContactUs />

          {/* =================================================
              WATCH MOBILE AD
              Zone: 1125710
              Scrollable container
              ================================================= */}

          <div className="w-full flex justify-center px-3 pb-4">
            <WatchMobileAdsColumn />
          </div>
        </aside>
      </div>

      {/* =====================================================
          SEARCH MODE
          ===================================================== */}

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
                <Search
                  className="mr-2 text-white/70"
                  size={20}
                />

                <input
                  className="bg-transparent outline-none text-sm flex-1 placeholder:text-white/50"
                  placeholder="Search naughty stuff..."
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchQuery(e.target.value)
                  }
                  autoFocus
                />
              </div>

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
        /* ===================================================
           NORMAL MOBILE HEADER
           =================================================== */

        <div className="px-3 h-14 flex items-center justify-between gap-2">
          <Link href="/">
            <ShortLogo />
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSearchOpen}
              className="rounded-full bg-white/10 h-9 w-9 flex items-center justify-center"
              aria-label="Search"
            >
              <Search className="h-6 w-6 text-pink-500" />
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="rounded-full bg-white/10 h-9 w-9 flex items-center justify-center"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6 text-white/80" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

const WatchNavLink = ({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: any;
}) => {
  const pathname = usePathname();

  const active =
    pathname === href ||
    (href !== "/" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-0.5 ${
        active ? "text-pink-500" : "text-white/60"
      }`}
    >
      {label ? (
        <Icon className="h-5 w-5" />
      ) : (
        <Icon className="h-10 w-10" />
      )}

      {label && <span>{label}</span>}
    </Link>
  );
};

function WatchMobileBottomNav({
  isAuthed = true,
  hidden = false,
}: {
  isAuthed?: boolean | null;
  hidden?: boolean;
}) {
  const [showUploadAuthModal, setShowUploadAuthModal] =
    useState(false);

  return (
    <nav
      className={[
        "lg:hidden fixed bottom-0 left-0 right-0 h-16",
        "bg-black/95 border-t border-white/10 z-40",
        "transition-transform duration-200 ease-out will-change-transform",
        hidden
          ? "translate-y-full"
          : "translate-y-0",
      ].join(" ")}
    >
      <div className="flex h-full items-center justify-around text-[11px]">
        <WatchNavLink
          href="/"
          label="Home"
          icon={Home}
        />

        <WatchNavLink
          href="/explore/gifs"
          label="Explore"
          icon={Compass}
        />

        {isAuthed ? (
          <WatchNavLink
            href="https://upload.goongram.com/upload"
            label=""
            icon={PlusCircleIcon}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowUploadAuthModal(true)}
            className="flex flex-col items-center gap-0.5 text-white/60"
          >
            <PlusCircleIcon className="h-10 w-10" />
          </button>
        )}

        <WatchNavLink
          href="/explore/niches"
          label="Niches"
          icon={Sparkles}
        />

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
                <DrawerTitle>
                  Profile
                </DrawerTitle>
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
          <WatchNavLink
            href="/auth/login"
            label="Log in"
            icon={LogIn}
          />
        )}
      </div>

      {/* =====================================================
          UPLOAD AUTH MODAL
          ===================================================== */}

      {showUploadAuthModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            className="absolute inset-0 w-full h-full"
            onClick={() =>
              setShowUploadAuthModal(false)
            }
          />

          <div
            className="
              relative w-full h-100 max-w-sm mx-6 rounded-3xl overflow-hidden
              border border-white/20 shadow-2xl
            "
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('/images/unlock-1.png')",
              }}
            />

            <div className="absolute inset-0 bg-black/65" />

            <div className="relative px-5 py-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">
                    Sign in to upload
                  </h2>

                  <p className="mt-1 text-[11px] text-white/70">
                    You need an account to upload
                    content. Log in or sign up to
                    start posting on goongram.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowUploadAuthModal(false)
                  }
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