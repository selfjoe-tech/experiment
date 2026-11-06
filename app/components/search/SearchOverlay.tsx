"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowUpLeft, Clock3, Eye, Hash, ImageIcon, Play, Search, UserRound, X,
} from "lucide-react";
import {
  globalSearch, getSearchSuggestions,
  type CreatorSearchResult, type GlobalSearchResult, type MediaSearchResult,
  type TagSearchResult,
} from "@/lib/actions/search";
import { VerifiedBadgeIcon } from "@/app/components/icons/VerifiedBadgeIcon";

type TabKey = "top" | "videos" | "images" | "creators" | "niches";
type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  onItemSelected?: () => void;
};
const RECENTS_KEY = "goongram:recent-searches:v1";
const EMPTY: GlobalSearchResult = { creators: [], tags: [], images: [], videos: [] };
const numberLabel = (n: number) => new Intl.NumberFormat("en", {
  notation: "compact", maximumFractionDigits: 1,
}).format(n || 0);
function getRecent(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter((x): x is string => typeof x === "string").slice(0, 8) : [];
  } catch { return []; }
}
function storeRecent(entries: string[]) {
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(entries)); }
  catch { /* Browser storage can be unavailable. */ }
}

function CreatorRow({ value, onClick }: { value: CreatorSearchResult; onClick: () => void }) {
  return <a href={`/${encodeURIComponent(value.username)}`} onClick={onClick}
    className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/[.06]">
    <Image unoptimized src={value.avatarUrl || "/avatar-placeholder.png"} alt=""
      width={44} height={44} className="h-11 w-11 shrink-0 rounded-full border border-white/15 object-cover"/>
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
        <span className="truncate">{value.username}</span>
        {value.verified && <VerifiedBadgeIcon/>}
      </div>
      <div className="mt-0.5 text-[11px] text-white/45">
        {numberLabel(value.followerCount)} followers
      </div>
    </div>
    <UserRound size={17} className="shrink-0 text-white/30 transition group-hover:text-white/60"/>
  </a>;
}

function NicheRow({ value, onClick }: { value: TagSearchResult; onClick: () => void }) {
  return <a href={`/explore/niches/${encodeURIComponent(value.slug)}`} onClick={onClick}
    className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/[.06]">
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[.07]">
      <Hash size={21} className="text-white/75"/>
    </div>
    <div className="min-w-0 flex-1">
      <div className="truncate text-[13px] font-semibold">#{value.label}</div>
      <div className="mt-0.5 text-[11px] text-white/45">{numberLabel(value.postCount)} posts</div>
    </div>
    <ArrowUpLeft size={15} className="rotate-90 text-white/30 transition group-hover:text-white/75"/>
  </a>;
}

function MediaTile({ value, onSelect, onImage }: {
  value: MediaSearchResult;
  onSelect: () => void;
  onImage: (value: MediaSearchResult) => void;
}) {
  const title = value.title || value.description || (value.mediaType === "video" ? "Watch video" : "View image");
  const picture = <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[#1e2025]">
    {value.mediaType === "image" ?
      <Image unoptimized src={value.src} alt={title} width={320} height={180}
        className="h-full w-full object-cover transition group-hover:scale-[1.025]"/> :
      <video src={value.src} muted playsInline preload="metadata" aria-label={title}
        className="h-full w-full object-cover transition group-hover:opacity-80"
        onMouseEnter={event => { void event.currentTarget.play().catch(() => {}); }}
        onMouseLeave={event => { event.currentTarget.pause(); event.currentTarget.currentTime = 0; }}/>}
    <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px]">
      {value.mediaType === "video" ? <Play size={11} fill="currentColor"/> : <ImageIcon size={11}/>}
      {numberLabel(value.views)}
    </span>
  </div>;
  const info = <div className="min-w-0 pt-2">
    <p className="line-clamp-2 text-xs font-medium leading-[1.35] text-white/90">{title}</p>
    <p className="mt-1 truncate text-[11px] text-white/45">@{value.username}</p>
  </div>;

  return value.mediaType === "video"
    ? <a href={`/watch/${value.id}`} onClick={onSelect}
        className="group min-w-0 rounded-lg transition hover:brightness-110">
        {picture}{info}
      </a>
    : <button type="button" onClick={() => onImage(value)}
        className="group min-w-0 rounded-lg text-left transition hover:brightness-110">
        {picture}{info}
      </button>;
}

export default function SearchOverlay({ query, onQueryChange, onItemSelected }: Props) {
  const [tab, setTab] = useState<TabKey>("top");
  const [results, setResults] = useState<GlobalSearchResult>(EMPTY);
  const [suggested, setSuggested] = useState<GlobalSearchResult>(EMPTY);
  const [recent, setRecent] = useState<string[]>([]);
  const [debounced, setDebounced] = useState(query.trim());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openedImage, setOpenedImage] = useState<MediaSearchResult | null>(null);
  const cleaned = query.trim();

  useEffect(() => {
    setRecent(getRecent());
    let active = true;
    getSearchSuggestions()
      .then(value => { if (active) setSuggested(value); })
      .catch(() => { /* Show recent searches when discovery is unavailable. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(cleaned), 240);
    return () => window.clearTimeout(id);
  }, [cleaned]);

  useEffect(() => {
    let active = true;
    if (debounced.length < 2) {
      setResults(EMPTY);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    globalSearch(debounced).then(value => {
      if (active) setResults(value);
    }).catch(() => {
      if (active) {
        setResults(EMPTY);
        setError("Search is temporarily unavailable. Please try again.");
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [debounced]);

  useEffect(() => {
    if (!openedImage) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenedImage(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [openedImage]);

  const saveSearch = () => {
    if (cleaned.length < 2) return;
    const next = [cleaned, ...recent.filter(x => x.toLowerCase() !== cleaned.toLowerCase())].slice(0, 8);
    setRecent(next);
    storeRecent(next);
  };
  const selected = () => { saveSearch(); onItemSelected?.(); };
  const changeSearch = (value: string) => { setTab("top"); onQueryChange(value); };
  const clearRecent = () => { setRecent([]); storeRecent([]); };
  const removeRecent = (value: string) => {
    const next = recent.filter(x => x !== value);
    setRecent(next);
    storeRecent(next);
  };
  const hasInput = cleaned.length > 0;
  const pending = cleaned !== debounced || loading;
  const data = hasInput ? results : suggested;
  const counts = useMemo(() => ({
    top: data.creators.length + data.tags.length + data.videos.length + data.images.length,
    creators: data.creators.length,
    niches: data.tags.length,
    videos: data.videos.length,
    images: data.images.length,
  }), [data]);
  const sectionTitle = hasInput ? "Top results" : "Suggested for you";
  const hasResults = counts.top > 0;
  const tiles = (values: MediaSearchResult[]) =>
    <div className="grid grid-cols-2 gap-x-3 gap-y-4 p-3 sm:gap-x-4">
      {values.map(item => <MediaTile key={`${item.mediaType}-${item.id}`}
        value={item} onSelect={selected} onImage={setOpenedImage}/>)}
    </div>;
  const creators = (values: CreatorSearchResult[]) =>
    <div className="px-2 py-1">{values.map(value =>
      <CreatorRow key={value.id} value={value} onClick={selected}/>)}</div>;
  const niches = (values: TagSearchResult[]) =>
    <div className="px-2 py-1">{values.map(value =>
      <NicheRow key={value.slug} value={value} onClick={selected}/>)}</div>;
  const heading = (text: string, category?: TabKey) =>
    <div className="flex items-center justify-between px-3 pb-1 pt-4">
      <h3 className="text-[13px] font-semibold text-white/90">{text}</h3>
      {category && <button type="button" onClick={() => setTab(category)}
        className="text-[11px] font-medium text-pink-400 hover:text-pink-300">See all</button>}
    </div>;
  const skeleton = <div className="space-y-3 p-4" aria-label="Loading search results">
    {Array.from({ length: 4 }, (_, i) => <div key={i} className="flex animate-pulse items-center gap-3">
      <div className="h-11 w-11 rounded-lg bg-white/10"/>
      <div className="flex-1 space-y-2">
        <div className="h-3 w-3/5 rounded bg-white/10"/><div className="h-3 w-2/5 rounded bg-white/[.06]"/>
      </div>
    </div>)}
  </div>;

  return <div className="flex min-h-0 flex-1 flex-col text-white">
    {!hasInput && recent.length > 0 && <section className="shrink-0 border-b border-white/10 pb-2">
      <div className="flex items-center justify-between px-3 pt-5">
        <h3 className="text-[13px] font-semibold">Recent</h3>
        <button type="button" onClick={clearRecent} className="text-[11px] font-medium text-pink-400 hover:text-pink-300">Clear all</button>
      </div>
      <div className="mt-2 space-y-0.5">
        {recent.slice(0, 5).map(item => <div key={item} className="flex items-center gap-1 px-1.5">
          <button type="button" onClick={() => changeSearch(item)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left text-[13px] hover:bg-white/[.06]">
            <Clock3 size={17} className="shrink-0 text-white/40"/>
            <span className="truncate">{item}</span>
          </button>
          <button type="button" aria-label={`Remove recent search ${item}`}
            onClick={() => removeRecent(item)} className="rounded-lg p-2 text-white/45 hover:bg-white/[.06]">
            <X size={15}/>
          </button>
        </div>)}
      </div>
    </section>}

    <div className="shrink-0 border-b border-white/10">
      <div role="tablist" aria-label="Search categories"
        className="flex w-full items-center gap-5 overflow-x-auto px-3 pt-4 [scrollbar-width:none]">
        {([
          ["top", "Top"], ["creators", "Accounts"], ["videos", "Videos"],
          ["images", "Images"], ["niches", "Niches"],
        ] as [TabKey, string][]).map(([value, label]) =>
          <button key={value} type="button" role="tab" aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`shrink-0 border-b-2 pb-3 text-xs font-semibold transition
              ${tab === value ? "border-white text-white" : "border-transparent text-white/45 hover:text-white/80"}`}>
            {label}
          </button>)}
      </div>
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-8">
      {pending && cleaned.length >= 2 ? skeleton :
        error ? <div role="alert" className="px-4 py-10 text-center text-xs text-rose-300">{error}</div> :
        cleaned.length === 1 ? <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
          <Search size={25} className="text-white/35"/>
          <p className="text-sm text-white/65">Type another letter to search</p>
        </div> :
        !hasResults ? <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
          <Search size={26} className="text-white/30"/>
          <p className="text-sm font-semibold">{hasInput ? "No results found" : "Nothing to suggest yet"}</p>
          <p className="max-w-[240px] text-xs leading-5 text-white/50">Try a creator name, part of a description, or a niche hashtag.</p>
        </div> :
        tab === "top" ? <div className="pb-4">
          {heading(sectionTitle)}
          {data.creators.length > 0 && <>{heading("Accounts", "creators")}{creators(data.creators.slice(0, 3))}</>}
          {data.tags.length > 0 && <>{heading("Niches and related tags", "niches")}{niches(data.tags.slice(0, 4))}</>}
          {data.videos.length > 0 && <>{heading("Videos", "videos")}{tiles(data.videos.slice(0, 4))}</>}
          {data.images.length > 0 && <>{heading("Images", "images")}{tiles(data.images.slice(0, 4))}</>}
        </div> :
        (tab === "creators" && data.creators.length ? creators(data.creators) :
          tab === "niches" && data.tags.length ? niches(data.tags) :
          tab === "videos" && data.videos.length ? tiles(data.videos) :
          tab === "images" && data.images.length ? tiles(data.images) :
          <p className="px-4 py-12 text-center text-xs text-white/55">No {tab} found for this search.</p>)}
    </div>

    {openedImage && <div className="fixed inset-0 z-[160] flex flex-col items-center justify-center bg-black/95 p-4 sm:p-8"
      role="dialog" aria-modal="true" aria-label="Image preview" onMouseDown={e => {
        if (e.target === e.currentTarget) setOpenedImage(null);
      }}>
      <button type="button" aria-label="Close image preview" onClick={() => setOpenedImage(null)}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"><X size={20}/></button>
      <Image unoptimized src={openedImage.src} alt={openedImage.title || "Search result image"}
        width={1200} height={1200} className="max-h-[78dvh] w-auto max-w-full rounded-md object-contain"/>
      <div className="mt-4 flex max-w-[580px] flex-wrap items-center gap-3 text-center text-sm">
        <a href={`/${encodeURIComponent(openedImage.username)}`} onClick={selected}
          className="font-semibold hover:underline">@{openedImage.username}</a>
        {openedImage.title && <span className="text-white/65">{openedImage.title}</span>}
      </div>
      {openedImage.tags.length > 0 && <div className="mt-3 flex max-w-lg flex-wrap justify-center gap-2">
        {openedImage.tags.slice(0, 7).map(t => <button key={t} type="button"
          onClick={() => { setOpenedImage(null); changeSearch(t.replace(/^#/, "")); }}
          className="rounded-full bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20">#{t.replace(/^#/, "")}</button>)}
      </div>}
    </div>}
  </div>;
}
