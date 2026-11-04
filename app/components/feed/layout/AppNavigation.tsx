"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bookmark, Compass, Heart, Home, LogIn, Menu, PlusSquare, Search,
  Clapperboard, Settings, X, type LucideIcon,
} from "lucide-react";
import { getUserProfileFromCookies } from "@/lib/actions/auth";
import SearchOverlay from "@/app/components/search/SearchOverlay";
import ProfileMenuContent from "@/app/components/profile/ProfileMenuContent";
import { MobileMenuAds } from "@/app/components/ads/AdPlacements";

type Viewer = { username: string | null; avatarUrl: string | null };
const EMPTY_VIEWER: Viewer = { username: null, avatarUrl: null };
const UPLOAD_URL = "https://upload.goongram.com/upload";

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

  return <>
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-[76px] min-[1360px]:w-[244px] flex-col border-r border-white/10 bg-[#0b0d10] px-3 pb-5 pt-8 text-white">
      <Link href="/" className="mb-9 flex min-h-12 items-center justify-center min-[1360px]:justify-start min-[1360px]:px-3" aria-label="Goon Gram home">
        <Image unoptimized src="/icons/goon.png" width={150} height={65} alt="Goon Gram" className="hidden h-auto max-h-14 w-[145px] object-contain object-left min-[1360px]:block" />
        <Image unoptimized src="/icons/logo7.png" width={42} height={42} alt="" aria-hidden="true" className="h-10 w-10 object-contain min-[1360px]:hidden" />
      </Link>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Main navigation">
        {NAV.map(({ label, href, icon: Icon }) => {
          const selected = isActive(pathname, href);
          const onClick = href === "#search" ? () => setSearchOpen(true) :
                          href === "#create" ? () => setCreateOpen(true) : undefined;
          const cls = `group flex h-[52px] w-full items-center justify-center min-[1360px]:justify-start gap-4 rounded-xl px-3 text-[15px] transition-all duration-200 hover:bg-white/[0.075] active:scale-[.98] ${selected ? "font-bold text-white" : "font-normal text-white/90"}`;
          const inner = <><Icon size={25} strokeWidth={selected ? 2.6 : 1.9} className="shrink-0 transition-transform duration-200 group-hover:scale-110" /><span className="hidden min-[1360px]:inline">{label}</span></>;
          return onClick ? <button key={label} type="button" onClick={onClick} className={cls}>{inner}</button>
            : <Link key={label} href={href} className={cls}>{inner}</Link>;
        })}
        {viewer.username ? (
          <button type="button" className="group flex h-[52px] items-center justify-center min-[1360px]:justify-start gap-4 rounded-lg px-3 text-[15px] hover:bg-white/[0.07]" onClick={() => setProfileOpen(true)}>
            <Avatar src={viewer.avatarUrl} /><span className="hidden min-[1360px]:inline">Profile</span>
          </button>
        ) : (
          <Link href="/auth/login" className="group flex h-[52px] items-center gap-4 rounded-lg px-3 text-[15px] hover:bg-white/[0.07]"><LogIn size={25} /><span className="hidden min-[1360px]:inline">Log in</span></Link>
        )}
      </nav>
      <button type="button" onClick={() => setProfileOpen(true)} className="flex h-12 items-center justify-center min-[1360px]:justify-start gap-4 rounded-lg px-3 text-[15px] hover:bg-white/[0.07]">
        <Menu size={25} strokeWidth={1.9} /><span className="hidden min-[1360px]:inline">More</span>
      </button>
    </aside>
    {searchOpen && <div className="fixed inset-0 z-[90] flex">
      <button type="button" aria-label="Close search" onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="absolute inset-0 bg-black/65" />
      <div className="relative ml-[76px] min-[1360px]:ml-[244px] h-full w-[390px] max-w-[calc(100vw-76px)] min-[1360px]:max-w-[calc(100vw-244px)] border-r border-white/10 bg-[#111317] p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Search</h2><button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(""); }} aria-label="Close search"><X size={22}/></button></div>
        <div className="relative mt-6"><input autoFocus placeholder="Search creators, posts or tags" className="w-full rounded-lg bg-white/10 px-4 py-3 text-sm outline-none placeholder:text-white/40" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          {searchQuery.trim() && <SearchOverlay query={searchQuery} onItemSelected={() => { setSearchOpen(false); setSearchQuery(""); }} />}
        </div>
      </div>
    </div>}
    {profileOpen && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={e => { if(e.target===e.currentTarget) setProfileOpen(false); }}>
      <div role="dialog" aria-modal="true" aria-label="Profile menu" className="relative max-h-[90dvh] w-full max-w-[430px] overflow-y-auto rounded-2xl border border-white/10 bg-[#17181b] text-white shadow-[0_24px_100px_rgba(0,0,0,.75)]">
        <button type="button" aria-label="Close profile menu" onClick={() => setProfileOpen(false)} className="absolute right-3 top-3 z-10 rounded-full p-2 hover:bg-white/10"><X size={18}/></button>
        {viewer.username ? <ProfileMenuContent /> : <div className="p-8 text-center"><p className="mb-5 text-sm text-white/55">Log in to access your account settings.</p><Link href="/auth/login" className="rounded-lg bg-pink-500 px-6 py-2.5 text-sm font-semibold">Log in</Link></div>}
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
      <Link href={loggedIn ? UPLOAD_URL : "/auth/login"} onClick={onClose} className="block rounded-lg bg-pink-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-pink-400">{loggedIn ? "Upload media" : "Log in"}</Link>
    </div>
  </div>;
}

export function MobileNavigation({ hidden = false }: { hidden?: boolean }) {
  const pathname = usePathname();
  const viewer = useViewer();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [adsOpen, setAdsOpen] = useState(false);
  const tabs = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/explore/gifs", icon: Compass, label: "Explore" },
    { href: "/reels", icon: Clapperboard, label: "Reels" },
    { href: "#create", icon: PlusSquare, label: "Create" },
    { href: "#profile", icon: Settings, label: "Profile" },
  ];
  return <>
    <header className="fixed inset-x-0 top-0 z-40 flex h-[58px] items-center justify-between border-b border-white/10 bg-[#0b0d10]/95 px-4 text-white backdrop-blur-xl lg:hidden">
      <Link href="/" aria-label="Goon Gram home"><Image unoptimized src="/icons/goon.png" width={119} height={50} alt="Goon Gram" className="max-h-11 w-[119px] object-contain object-left" /></Link>
      <div className="flex items-center gap-4">
        <button type="button" aria-label="Search" onClick={() => setSearchOpen(true)}><Search size={25} strokeWidth={1.8}/></button>
        <Link href="/liked" aria-label="Liked posts"><Heart size={25} strokeWidth={1.8}/></Link>
        <button type="button" aria-label="Open sponsored and contact menu" onClick={() => setAdsOpen(true)}><Menu size={26} strokeWidth={1.8}/></button>
      </div>
    </header>
    <nav aria-label="Mobile navigation" className={`fixed inset-x-0 bottom-0 z-40 flex h-[calc(61px+env(safe-area-inset-bottom))] items-start justify-around border-t border-white/10 bg-[#0b0d10]/95 pt-3 pb-[env(safe-area-inset-bottom)] text-white backdrop-blur-xl transition-transform duration-300 lg:hidden ${hidden?"translate-y-full":"translate-y-0"}`}>
      {tabs.map(({href,icon:Icon,label})=>href.startsWith("#")?
        <button key={label} type="button" aria-label={label} onClick={()=> href==="#create" ? setCreateOpen(true):setProfileOpen(true)} className="grid h-9 w-12 place-items-center">
          {label==="Profile"&&viewer.username?<Avatar src={viewer.avatarUrl} />:<Icon size={26} strokeWidth={1.9}/>}
        </button>:
        <Link key={label} href={href} aria-label={label} className="grid h-9 w-12 place-items-center">
          <Icon size={26} strokeWidth={isActive(pathname,href)?2.9:1.8} className="transition-transform active:scale-90"/>
        </Link>
      )}
    </nav>
    {searchOpen && <div className="fixed inset-0 z-[100] bg-[#0b0d10] px-4 pt-5 text-white">
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Back" onClick={()=>{setSearchOpen(false);setQuery("");}}><X size={25}/></button>
        <div className="relative flex-1">
          <input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search creators, posts or tags" className="w-full rounded-lg bg-white/10 px-4 py-3 text-sm outline-none" />
          {query.trim() && <SearchOverlay query={query} onItemSelected={()=>{setSearchOpen(false);setQuery("");}} />}
        </div>
      </div>
    </div>}
    {profileOpen && <div className="fixed inset-0 z-[100] bg-black/80 text-white backdrop-blur-sm" onMouseDown={e=>{if(e.target===e.currentTarget)setProfileOpen(false);}}>
      <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#17181b] shadow-[0_-16px_70px_rgba(0,0,0,.65)]">
        <div className="flex justify-between border-b border-white/10 px-5 py-4"><span className="font-semibold">Account</span><button type="button" aria-label="Close" onClick={()=>setProfileOpen(false)}><X size={22}/></button></div>
        {viewer.username?<ProfileMenuContent/>:<div className="p-6 text-center"><Link href="/auth/login" className="rounded-lg bg-pink-500 px-6 py-3 text-sm font-semibold">Log in</Link></div>}
      </div>
    </div>}
    {adsOpen && <div className="fixed inset-0 z-[100] text-white lg:hidden" role="dialog" aria-modal="true" aria-label="Sponsored and contacts">
      <button type="button" aria-label="Close sponsored menu" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAdsOpen(false)}/>
      <div className="absolute inset-y-0 right-0 w-[min(360px,92vw)] overflow-y-auto border-l border-white/10 bg-[#17181b] shadow-2xl">
        <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/10 bg-[#111317] px-5">
          <h2 className="text-sm font-semibold">Sponsored & contact</h2>
          <button type="button" aria-label="Close" onClick={() => setAdsOpen(false)}><X size={23}/></button>
        </div>
        <div className="pt-6"><MobileMenuAds /></div>
      </div>
    </div>}
    <CreatePrompt open={createOpen} onClose={()=>setCreateOpen(false)} loggedIn={!!viewer.username}/>
  </>;
}
