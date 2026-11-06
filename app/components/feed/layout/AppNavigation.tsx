"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Compass, Heart, Home, LogIn, Menu, PlusSquare, Search,
  Clapperboard, CircleDollarSign, X, type LucideIcon,
} from "lucide-react";
import { getUserProfileFromCookies } from "@/lib/actions/auth";
import SearchOverlay from "@/app/components/search/SearchOverlay";
import ProfileMenuContent from "@/app/components/profile/ProfileMenuContent";

type Viewer = { username: string | null; avatarUrl: string | null };
const EMPTY_VIEWER: Viewer = { username: null, avatarUrl: null };
const UPLOAD_URL = "/upload";

function useViewer() {
  const [viewer, setViewer] = useState<Viewer>(EMPTY_VIEWER);
  useEffect(() => {
    let active = true;
    getUserProfileFromCookies()
      .then((profile) => { if (active) setViewer(profile); })
      .catch(() => { if (active) setViewer(EMPTY_VIEWER); });
    return () => { active = false; };
  }, []);
  return viewer;
}

const NAV: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Home", href: "/", icon: Home },
  { label: "Search", href: "#search", icon: Search },
  { label: "Explore", href: "/explore/gifs", icon: Compass },
  { label: "Reels", href: "/reels", icon: Clapperboard },
  { label: "Earn", href: "/monetization", icon: CircleDollarSign },
  { label: "Liked", href: "/liked", icon: Heart },
  { label: "Create", href: "#create", icon: PlusSquare },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && href.startsWith("/") && pathname.startsWith(href + "/"));
}

function Avatar({ src, size = 27 }: { src?: string | null; size?: number }) {
  return <Image unoptimized src={src || "/avatar-placeholder.png"} alt="Profile" width={size} height={size}
    className="rounded-full object-cover border border-white/25" style={{ width: size, height: size }} />;
}

export function DesktopNavigation() {
  const pathname = usePathname();
  const viewer = useViewer();
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [navExpanded, setNavExpanded] = useState(false);

  useEffect(() => { setProfileOpen(false); setSearchOpen(false); }, [pathname]);

  return <>
    <aside
      onMouseEnter={() => setNavExpanded(true)}
      onMouseLeave={() => setNavExpanded(false)}
      onFocusCapture={() => setNavExpanded(true)}
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/10 bg-[#0b0d10] px-3 pb-5 pt-8 text-white transition-[width,box-shadow] duration-200 ease-out lg:flex ${navExpanded ? "w-[244px] shadow-[20px_0_55px_rgba(0,0,0,.32)]" : "w-[76px]"}`}
    >
      <a href="/" className={`mb-9 flex min-h-12 items-center ${navExpanded ? "justify-start px-3" : "justify-center"}`} aria-label="Goon Gram home">
        <Image unoptimized src="/icons/goon.png" width={150} height={65} alt="Goon Gram" className={`h-auto max-h-14 w-[145px] object-contain object-left ${navExpanded ? "block" : "hidden"}`} />
        <Image unoptimized src="/icons/logo7.png" width={42} height={42} alt="" aria-hidden="true" className={`h-10 w-10 object-contain ${navExpanded ? "hidden" : "block"}`} />
      </a>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Main navigation">
        {NAV.map(({ label, href, icon: Icon }) => {
          const selected = isActive(pathname, href) || (href === "/monetization" && pathname.startsWith("/earn"));
          const onClick = href === "#search" ? () => setSearchOpen(true) :
                          href === "#create" ? () => setCreateOpen(true) : undefined;
          const cls = `group flex h-[52px] w-full shrink-0 items-center gap-4 rounded-lg px-3 text-[15px] transition-colors duration-150 hover:bg-white/[.075] ${navExpanded ? "justify-start" : "justify-center"} ${selected ? "font-semibold text-white" : "font-normal text-white/75"}`;
          const inner = <><Icon size={25} strokeWidth={selected ? 2.5 : 1.8} className="shrink-0" /><span className={navExpanded ? "min-w-0 truncate whitespace-nowrap" : "hidden"}>{label}</span></>;
          return onClick ? <button key={label} type="button" aria-label={label} onClick={onClick} className={cls}>{inner}</button>
            : <a key={label} href={href} aria-label={label} aria-current={selected ? "page" : undefined} className={cls}>{inner}</a>;
        })}
        {viewer.username ? (
          <a href={`/${encodeURIComponent(viewer.username)}`} className={`group flex h-[52px] items-center gap-4 rounded-lg px-3 text-[15px] hover:bg-white/[0.07] ${navExpanded ? "justify-start" : "justify-center"}`}>
            <Avatar src={viewer.avatarUrl} /><span className={navExpanded ? "whitespace-nowrap" : "hidden"}>Profile</span>
          </a>
        ) : (
          <a href="/auth/login" className={`group flex h-[52px] items-center gap-4 rounded-lg px-3 text-[15px] hover:bg-white/[0.07] ${navExpanded ? "justify-start" : "justify-center"}`}><LogIn size={25} /><span className={navExpanded ? "whitespace-nowrap" : "hidden"}>Log in</span></a>
        )}
      </nav>
      <button type="button" aria-label="More" onClick={() => setProfileOpen(true)} className={`flex h-12 items-center gap-4 rounded-lg px-3 text-[15px] hover:bg-white/[0.07] ${navExpanded ? "justify-start" : "justify-center"}`}>
        <Menu size={25} strokeWidth={1.9} /><span className={navExpanded ? "whitespace-nowrap" : "hidden"}>More</span>
      </button>
    </aside>
    {searchOpen && <div className="fixed inset-0 z-[90] flex" role="dialog" aria-modal="true" aria-label="Search Goon Gram"
      onKeyDown={event => { if (event.key === "Escape") { setSearchOpen(false); setSearchQuery(""); } }}>
      <button type="button" aria-label="Close search" onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
        className="absolute inset-0 bg-black/65"/>
      <div className="relative ml-[76px] flex h-full w-[440px] max-w-[calc(100vw-76px)] min-w-0 flex-col border-r border-white/10 bg-[#111317] text-white shadow-2xl min-[1360px]:ml-[244px] min-[1360px]:max-w-[calc(100vw-244px)]">
        <div className="shrink-0 border-b border-white/10 px-5 pb-5 pt-7">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Search</h2>
            <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
              aria-label="Close search" className="rounded-full p-2 hover:bg-white/10"><X size={21}/></button>
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-xl bg-white/[.08] px-3 py-1">
            <Search size={19} className="shrink-0 text-white/45"/>
            <input autoFocus aria-label="Search videos, images, creators and niches"
              placeholder="Search videos, images, creators, niches"
              className="h-11 w-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            {searchQuery && <button type="button" aria-label="Clear search"
              onClick={() => setSearchQuery("")} className="rounded-full p-1 text-white/55 hover:bg-white/10"><X size={15}/></button>}
          </div>
        </div>
        <SearchOverlay query={searchQuery} onQueryChange={setSearchQuery}
          onItemSelected={() => { setSearchOpen(false); setSearchQuery(""); }} />
      </div>
    </div>}
    {profileOpen && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={e => { if(e.target===e.currentTarget) setProfileOpen(false); }}>
      <div role="dialog" aria-modal="true" aria-label="More menu" className="relative max-h-[90dvh] w-full max-w-[430px] overflow-y-auto rounded-2xl border border-white/10 bg-[#17181b] text-white shadow-[0_24px_100px_rgba(0,0,0,.75)]">
        <button type="button" aria-label="Close profile menu" onClick={() => setProfileOpen(false)} className="absolute right-3 top-3 z-10 rounded-full p-2 hover:bg-white/10"><X size={18}/></button>
        <div className="border-b border-white/10 px-5 py-4 text-sm font-semibold">More options</div>
        {viewer.username ? <ProfileMenuContent /> : <div className="p-8 text-center"><p className="mb-5 text-sm text-white/55">Log in to access your account settings.</p><a href="/auth/login" className="rounded-lg bg-pink-500 px-6 py-2.5 text-sm font-semibold">Log in</a></div>}
        <div className="border-t border-white/10 px-5 py-4 text-sm"><a href="/ads" onClick={() => setProfileOpen(false)} className="text-white/70 hover:text-white">Advertise on Goon Gram</a></div>
      </div>
    </div>}
    <CreatePrompt open={createOpen} onClose={() => setCreateOpen(false)} loggedIn={!!viewer.username}/>
  </>;
}

function CreatePrompt({open,onClose,loggedIn}:{open:boolean;onClose:()=>void;loggedIn:boolean}) {
  if(!open) return null;
  return <div className="fixed inset-0 z-[110] grid place-items-center bg-black/75 p-4" onMouseDown={e => {if(e.target===e.currentTarget)onClose();}}>
    <div role="dialog" aria-modal="true" aria-label="Create post" className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#17191d] p-7 text-center text-white shadow-[0_24px_100px_rgba(0,0,0,.75)]">
      <div className="flex justify-end"><button onClick={onClose} aria-label="Close"><X size={20}/></button></div>
      <PlusSquare size={42} strokeWidth={1.4} className="mx-auto mb-5"/>
      <h2 className="text-lg font-semibold">Create a post</h2>
      <p className="mb-6 mt-2 text-sm text-white/55">{loggedIn ? "Upload a video or images to share with the community." : "Log in to start sharing posts."}</p>
      <a href={loggedIn ? UPLOAD_URL : "/auth/login"} onClick={onClose} className="block rounded-lg bg-pink-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-pink-400">{loggedIn ? "Upload media" : "Log in"}</a>
    </div>
  </div>;
}

export function MobileNavigation({ hidden = false }: { hidden?: boolean }) {
  const pathname = usePathname();
  const viewer = useViewer();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); setSearchOpen(false); }, [pathname]);
  const tabs = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/reels", icon: Clapperboard, label: "Reels" },
    { href: "#create", icon: PlusSquare, label: "Upload" },
    { href: "/explore/gifs", icon: Compass, label: "Explore" },
    { href: "/monetization", icon: CircleDollarSign, label: "Earn" },
  ];
  return <>
    <header className="fixed inset-x-0 top-0 z-40 flex h-[58px] items-center justify-between gap-1 border-b border-white/10 bg-[#0b0d10]/95 px-2 text-white backdrop-blur-xl sm:px-4 lg:hidden">
      <a href="/" className="min-w-0 shrink" aria-label="Goon Gram home">
        <Image unoptimized src="/icons/goon.png" width={119} height={50} alt="Goon Gram" className="h-auto max-h-10 w-[90px] object-contain object-left sm:w-[119px]"/>
      </a>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button type="button" aria-label="Search" onClick={() => setSearchOpen(true)} className="grid h-9 w-8 place-items-center"><Search size={23} strokeWidth={1.8}/></button>
        <button type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)} className="grid h-9 w-8 place-items-center"><Menu size={24} strokeWidth={1.8}/></button>
        <a href={viewer.username ? `/${encodeURIComponent(viewer.username)}` : "/auth/login"}
          aria-label={viewer.username ? "Open my profile" : "Log in"}
          className="grid h-9 w-9 place-items-center rounded-full">
          {viewer.username ? <Avatar src={viewer.avatarUrl} size={28}/> : <LogIn size={23} strokeWidth={1.8}/>}
        </a>
      </div>
    </header>
    <nav aria-label="Mobile navigation" className={`fixed inset-x-0 bottom-0 z-40 flex h-[calc(61px+env(safe-area-inset-bottom))] items-start justify-around border-t border-white/10 bg-[#0b0d10]/95 pt-1.5 pb-[env(safe-area-inset-bottom)] text-white backdrop-blur-xl transition-transform duration-300 lg:hidden ${hidden?"translate-y-full":"translate-y-0"}`}>
      {tabs.map(({href,icon:Icon,label}) => {
        const selected = isActive(pathname,href) || (href === "/monetization" && pathname.startsWith("/earn"));
        return href === "#create" ?
          <button key={label} type="button" aria-label="Upload" title="Upload" onClick={() => setCreateOpen(true)}
            className="flex h-[48px] w-14 items-center justify-center" >
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/[.09]">
              <Icon size={25} strokeWidth={2}/>
            </span>
          </button> :
          <a key={label} href={href} aria-label={label} aria-current={selected ? "page" : undefined}
            className={`flex h-[49px] w-14 flex-col items-center justify-start gap-0.5 pt-1 ${selected ? "text-white" : "text-white/55"}`}>
            <Icon size={23} strokeWidth={selected?2.5:1.8} className="shrink-0 transition-transform active:scale-90"/>
            <span className={`max-w-full truncate text-[10px] leading-[14px] ${selected ? "font-semibold" : "font-normal"}`}>{label}</span>
          </a>;
      })}
    </nav>
    {searchOpen && <div className="fixed inset-0 z-[100] flex min-h-0 flex-col bg-[#0b0d10] text-white lg:hidden"
      role="dialog" aria-modal="true" aria-label="Search Goon Gram"
      onKeyDown={event => { if (event.key === "Escape") { setSearchOpen(false); setQuery(""); } }}>
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 pb-4 pt-[calc(14px+env(safe-area-inset-top))]">
        <button type="button" aria-label="Back" onClick={() => { setSearchOpen(false); setQuery(""); }}
          className="rounded-full p-1"><X size={23}/></button>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white/[.09] px-3">
          <Search size={18} className="shrink-0 text-white/50"/>
          <input autoFocus aria-label="Search videos, images, creators and niches"
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search videos, creators, niches"
            className="h-11 w-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/40"/>
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"
            className="rounded-full p-1 text-white/60"><X size={15}/></button>}
        </div>
      </div>
      <SearchOverlay query={query} onQueryChange={setQuery}
        onItemSelected={() => { setSearchOpen(false); setQuery(""); }} />
    </div>}
    {menuOpen && <div className="fixed inset-0 z-[100] text-white lg:hidden" role="dialog" aria-modal="true" aria-label="More options">
      <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setMenuOpen(false)}/>
      <div className="absolute inset-y-0 right-0 w-[min(360px,94vw)] overflow-y-auto overscroll-contain border-l border-white/10 bg-[#17181b] shadow-2xl">
        <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/10 bg-[#17181b] px-5">
          <h2 className="text-base font-semibold">More</h2>
          <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="rounded-full p-2 hover:bg-white/10"><X size={23}/></button>
        </div>
        <div className="space-y-1 border-b border-white/10 p-4 text-sm">
          {viewer.username ? <ProfileMenuContent/> : <>
            <a href="/auth/login" onClick={() => setMenuOpen(false)} className="block rounded-lg px-4 py-3 hover:bg-white/10">Log in</a>
            <a href="/explore/gifs" onClick={() => setMenuOpen(false)} className="block rounded-lg px-4 py-3 hover:bg-white/10">Explore</a>
          </>}
          <a href="/ads" onClick={() => setMenuOpen(false)} className="block rounded-lg px-4 py-3 text-white/75 hover:bg-white/10">Advertise</a>
        </div>
      </div>
    </div>}
    <CreatePrompt open={createOpen} onClose={()=>setCreateOpen(false)} loggedIn={!!viewer.username}/>
  </>;
}
