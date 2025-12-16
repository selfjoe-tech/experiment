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
  Menu,
  Plus,
  PlusCircle,
  PlusCircleIcon,
  Search,
  Sparkles,
  Upload as UploadIcon,
  User2,
  X,
  Mail
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
import { ContactUs } from "../../ui/ContactUs";


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


function RedditIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C18.6274 0 24 5.37258 24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0ZM17.9912 4.81299C17.3275 4.81303 16.7554 5.20422 16.4907 5.76611L13.5342 5.07373C13.3383 5.028 13.1396 5.14045 13.0796 5.33154L11.9375 8.92383C9.98502 8.962 8.21371 9.48712 6.88623 10.3232C6.53818 10.0306 6.08885 9.85308 5.59912 9.85303C4.49656 9.85322 3.59961 10.7462 3.59961 11.8438C3.59963 12.5425 3.96386 13.1568 4.51221 13.5117C4.48426 13.6899 4.46924 13.8705 4.46924 14.0532C4.46924 16.8836 7.92123 19.1865 12.1646 19.1865C16.4074 19.1865 19.8594 16.8836 19.8594 14.0532C19.8594 13.8838 19.8468 13.7161 19.8228 13.5503C20.406 13.2031 20.7998 12.5693 20.7998 11.8438C20.7998 10.7462 19.9029 9.85303 18.8003 9.85303C18.296 9.85303 17.8359 10.0418 17.4839 10.3496C16.2312 9.54847 14.5752 9.0273 12.7412 8.93604L13.7056 5.90137L16.3369 6.51807C16.3664 7.40205 17.0959 8.11274 17.9912 8.11279C18.905 8.11279 19.6484 7.37282 19.6484 6.46289C19.6484 5.553 18.9047 4.81299 17.9912 4.81299Z" fill="#BAB9C0"></path><path d="M19.6116 12.7601C19.3304 12.0392 18.8183 11.3797 18.1328 10.8179C18.3251 10.6932 18.5542 10.62 18.8005 10.62C19.4783 10.62 20.0297 11.1689 20.0297 11.8438C20.0293 12.2087 19.8671 12.536 19.6116 12.7601Z" fill="#BAB9C0"></path><path d="M17.9919 5.58008C18.4811 5.58008 18.879 5.97647 18.879 6.46354C18.879 6.95061 18.4811 7.3468 17.9919 7.3468C17.5024 7.3468 17.1045 6.95061 17.1045 6.46354C17.1045 5.97647 17.5024 5.58008 17.9919 5.58008Z" fill="#BAB9C0"></path><path d="M12.165 9.68701C14.0549 9.68701 15.7704 10.1672 17.0205 10.9438C17.2493 11.0857 17.4619 11.238 17.6577 11.3989C18.2483 11.8833 18.68 12.4481 18.9077 13.062C18.9974 13.3052 19.0568 13.5556 19.0791 13.812C19.0859 13.8924 19.0903 13.9726 19.0903 14.0537C19.0903 16.461 15.983 18.4199 12.165 18.4199C8.34651 18.4199 5.24023 16.4612 5.24023 14.0537C5.24023 13.9689 5.24502 13.8852 5.25244 13.8018C5.27569 13.5459 5.33483 13.2956 5.42529 13.0532C5.66003 12.4247 6.1105 11.8477 6.72559 11.356C6.92241 11.1985 7.13597 11.0499 7.36426 10.9111C8.61023 10.1541 10.3023 9.68704 12.165 9.68701ZM9.94727 15.9688C9.79696 15.8191 9.55308 15.819 9.40283 15.9688C9.25237 16.1187 9.25245 16.3615 9.40283 16.5107C9.98939 17.0949 10.9018 17.3794 12.1914 17.3794C12.1947 17.3794 12.1976 17.3784 12.2007 17.3784C12.2037 17.3785 12.2067 17.3794 12.21 17.3794C13.4992 17.3794 14.4114 17.0949 14.9985 16.5112C15.1492 16.3612 15.1493 16.1187 14.999 15.9692C14.8483 15.8195 14.6043 15.8193 14.4536 15.9688C14.018 16.4019 13.2847 16.6123 12.21 16.6123C12.2067 16.6123 12.2037 16.6132 12.2007 16.6133C12.1974 16.6133 12.1945 16.6123 12.1914 16.6123C11.1164 16.6123 10.3823 16.4019 9.94727 15.9688ZM9.6333 11.9419C8.984 11.9419 8.43945 12.4844 8.43945 13.1309C8.43949 13.7771 8.98422 14.3018 9.6333 14.3018C10.2828 14.301 10.8095 13.7771 10.8096 13.1309C10.8096 12.4844 10.2828 11.9419 9.6333 11.9419ZM14.7856 11.9414C14.1364 11.9414 13.59 12.4835 13.5898 13.1299C13.5898 13.7765 14.1363 14.3013 14.7856 14.3013C15.435 14.3012 15.9619 13.7768 15.9619 13.1299C15.9614 12.4832 15.435 11.9415 14.7856 11.9414Z" fill="#BAB9C0"></path><path d="M4.37009 11.8437C4.37009 11.1691 4.92147 10.6199 5.59911 10.6199C5.82799 10.6199 6.04181 10.684 6.22574 10.7931C5.53989 11.3479 5.02662 12.0008 4.73715 12.7144C4.51062 12.4923 4.37009 12.1843 4.37009 11.8437Z" fill="#BAB9C0"></path></svg>
  );
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C18.6272 1.07194e-07 24 5.37301 24 12.0005H23.9985C23.9985 18.0612 19.5059 23.0716 13.6699 23.8848C13.1242 23.9604 12.5657 24 11.999 24C11.345 24 10.7026 23.948 10.0771 23.8472C4.36388 22.9273 3.26157e-05 17.9729 0 12.0005C0 5.37301 5.37276 0 12 0ZM10.6606 12.5791L5.99805 17.6167H7.04785L11.1304 13.2065L14.4287 17.6167H18L13.106 11.0723L17.4458 6.38379H16.3965L12.6367 10.4453L9.59912 6.38379H6.02686L10.6606 12.5791ZM16.4556 16.8433H14.8149L7.57031 7.15674H9.21045L16.4556 16.8433Z" fill="#BAB9C0"></path></svg>
  );
}

function DiscordIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C18.6274 0 24 5.37258 24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0ZM13.5786 7.17529C15.4548 7.74225 16.3308 8.55925 16.3379 8.56592C15.1854 7.94192 14.0552 7.63507 13.0024 7.51465C12.2046 7.42707 11.4397 7.44904 10.7637 7.53662C10.6973 7.53664 10.642 7.54767 10.5757 7.55859C10.1878 7.59143 9.24571 7.73358 8.06006 8.24805C7.65448 8.43214 7.41147 8.5631 7.40625 8.56592C7.41355 8.55907 8.33402 7.69836 10.3208 7.13135L10.21 7C10.208 6.99996 8.69046 6.96833 7.0957 8.1499C7.08047 8.17727 5.50003 11.0241 5.5 14.5322C5.5033 14.5378 6.4352 16.1198 8.87988 16.1963C8.8847 16.1905 9.29208 15.7011 9.62256 15.2876C8.21518 14.8716 7.68311 13.9956 7.68311 13.9956C7.68311 13.9956 7.79377 14.0727 7.99316 14.1821C8.00423 14.1931 8.0155 14.2039 8.0376 14.2148C8.07083 14.2367 8.10446 14.2477 8.1377 14.2695C8.4146 14.4227 8.69152 14.5431 8.94629 14.6416C9.40064 14.8168 9.94403 14.9919 10.5757 15.1123C11.4068 15.2655 12.382 15.3206 13.4458 15.1235C13.9666 15.0359 14.4987 14.8827 15.0527 14.6528C15.4406 14.5105 15.8728 14.3024 16.3271 14.0068C16.3271 14.0068 15.7729 14.9045 14.3213 15.3096C14.6517 15.7231 15.048 16.1907 15.0527 16.1963C17.4898 16.1199 18.4343 14.5474 18.4434 14.5322C18.4433 11.0195 16.8588 8.16994 16.8477 8.1499C15.259 6.97283 13.7473 6.99973 13.7339 7L13.5786 7.17529ZM10.2114 11.2822C10.838 11.2823 11.3434 11.8458 11.3325 12.5332C11.3325 13.2207 10.838 13.7846 10.2114 13.7847C9.59573 13.7847 9.08984 13.2208 9.08984 12.5332C9.08998 11.8458 9.58482 11.2822 10.2114 11.2822ZM14.2241 11.2822C14.8507 11.2823 15.3451 11.8458 15.3452 12.5332C15.3452 13.2207 14.8507 13.7846 14.2241 13.7847C13.6084 13.7847 13.1025 13.2208 13.1025 12.5332C13.1027 11.8458 13.5975 11.2822 14.2241 11.2822Z" fill="#BAB9C0"></path></svg>
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
  const [menuOpen, setMenuOpen] = useState(false);

  // lock body scroll while panel is open
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  // close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-black via-black/90 to-transparent">
      {/* Slide-in panel (always mounted for smooth close animation) */}
      <div
        className={`fixed inset-0 z-[9999] ${
          menuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!menuOpen}
      >
        {/* backdrop */}
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
            menuOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Close menu"
        />

        {/* panel */}
        <aside
          className={`absolute right-0 top-0 h-full w-[86%] max-w-sm bg-[#0b0b0b] border-l border-white/10 shadow-2xl
                      transition-transform duration-300 ease-in-out
                      ${menuOpen ? "translate-x-0" : "translate-x-full"}`}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div className="h-14 px-4 flex items-center justify-between border-b border-white/10">
            <div className="text-sm font-semibold text-white">Menu</div>
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


        </aside>
      </div>

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
                <Search className="mr-2 text-white/70" size={20} />
                <input
                  className="bg-transparent outline-none text-sm flex-1 placeholder:text-white/50"
                  placeholder="Search naughty naughty stuff..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              {searchQuery.trim().length > 0 && (
                <SearchOverlay query={searchQuery} onItemSelected={onSearchClose} />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-3 h-14 flex items-center justify-between gap-2">
          <Link href={"/"}>
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
        relative w-full h-100 max-w-sm mx-6 rounded-3xl overflow-hidden
        border border-white/20 shadow-2xl
      "
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/images/unlock-1.png')", // 👈 change path
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
